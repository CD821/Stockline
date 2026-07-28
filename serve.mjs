import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { databaseHealth, pool, requirePool, withTransaction } from "./lib/db.mjs";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "./lib/security.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4387);
const host = process.env.HOST || "127.0.0.1";
const sessionHours = Number(process.env.SESSION_HOURS || 12);
const cookieSecure = process.env.COOKIE_SECURE === "true";
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const publicFiles = new Set([
  "index.html",
  "app.js",
  "styles.css",
  "design-concept.png",
  "qa-desktop.png",
  "qa-mobile.png",
]);

const permissionColumns = {
  manageInventory: "manage_inventory",
  dispatchInventory: "dispatch_inventory",
  viewLogs: "view_logs",
  manageUsers: "manage_users",
};

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("=");
        return separator < 0
          ? [entry, ""]
          : [
              decodeURIComponent(entry.slice(0, separator)),
              decodeURIComponent(entry.slice(separator + 1)),
            ];
      }),
  );
}

async function readJson(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 1_000_000) {
      throw httpError(413, "Request body is too large.");
    }
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw httpError(400, "Request body must be valid JSON.");
  }
}

function requireText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw httpError(400, `${label} is required.`);
  return text;
}

function requireNonnegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw httpError(400, `${label} must be a nonnegative whole number.`);
  }
  return number;
}

function sessionCookie(token, maxAgeSeconds) {
  const secure = cookieSecure ? "; Secure" : "";
  return `stockline_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearSessionCookie() {
  return sessionCookie("", 0);
}

function mapPermissions(row) {
  return {
    manageInventory: Boolean(row.manage_inventory),
    dispatchInventory: Boolean(row.dispatch_inventory),
    viewLogs: Boolean(row.view_logs),
    manageUsers: Boolean(row.manage_users),
  };
}

function mapUser(row) {
  return {
    id: String(row.id),
    name: row.name,
    username: row.username,
    role: row.role_name,
    active: row.active,
    archived: row.archived,
  };
}

function mapInventory(row) {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    idNumber: row.id_number,
    quantity: row.quantity,
    reserved: row.reserved,
    minimum: row.minimum,
    division: row.division,
    notes: row.notes,
    status: row.status,
  };
}

function mapLog(row) {
  return {
    id: String(row.id),
    timestamp: row.created_at,
    user: row.user_name_snapshot,
    action: row.action,
    item: row.item,
    quantity: row.quantity,
    details: row.details,
  };
}

async function authenticate(request) {
  const token = parseCookies(request).stockline_session;
  if (!token) return null;
  const result = await requirePool().query(
    `
      select
        u.id, u.name, u.username, u.role_name, u.active, u.archived,
        r.manage_inventory, r.dispatch_inventory, r.view_logs, r.manage_users
      from sessions s
      join users u on u.id = s.user_id
      join roles r on r.name = u.role_name
      where s.token_hash = $1
        and s.expires_at > now()
        and u.active = true
        and u.archived = false
    `,
    [hashSessionToken(token)],
  );
  if (!result.rowCount) return null;
  return {
    ...mapUser(result.rows[0]),
    permissions: mapPermissions(result.rows[0]),
    tokenHash: hashSessionToken(token),
  };
}

function requirePermission(user, permission) {
  if (!user?.permissions?.[permission]) {
    throw httpError(403, "Your account does not have permission for this action.");
  }
}

async function writeAudit(
  client,
  user,
  action,
  item,
  quantity,
  details,
) {
  await client.query(
    `
      insert into audit_logs (
        user_id, user_name_snapshot, action, item, quantity, details
      )
      values ($1, $2, $3, $4, $5, $6)
    `,
    [user?.id || null, user?.name || "System", action, item, quantity, details || ""],
  );
}

async function loadApplicationState(user) {
  const database = requirePool();
  const [inventory, users, roles, logs] = await Promise.all([
    database.query("select * from inventory_items order by id"),
    user.permissions.manageUsers
      ? database.query(
          `
            select id, name, username, role_name, active, archived
            from users
            order by archived, id
          `,
        )
      : database.query(
          `
            select id, name, username, role_name, active, archived
            from users
            where id = $1
          `,
          [user.id],
        ),
    user.permissions.manageUsers
      ? database.query("select * from roles order by name")
      : database.query("select * from roles where name = $1", [user.role]),
    user.permissions.viewLogs
      ? database.query(
          `
            select id, created_at, user_name_snapshot, action, item, quantity, details
            from audit_logs
            order by created_at desc, id desc
            limit 5000
          `,
        )
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    currentUser: {
      ...mapUser(user),
      permissions: user.permissions,
    },
    inventory: inventory.rows.map(mapInventory),
    users: users.rows.map(mapUser),
    roles: Object.fromEntries(
      roles.rows.map((role) => [role.name, mapPermissions(role)]),
    ),
    logs: logs.rows.map(mapLog),
  };
}

function inventoryValues(body) {
  const status = ["Active", "Discontinued", "Archived"].includes(body.status)
    ? body.status
    : "Active";
  const division = ["TTS", "Bespoke"].includes(body.division)
    ? body.division
    : "TTS";
  const quantity = requireNonnegativeInteger(body.quantity, "Quantity on hand");
  const reserved = requireNonnegativeInteger(body.reserved, "Reserved");
  const minimum = requireNonnegativeInteger(body.minimum, "Minimum quantity");
  if (reserved > quantity) {
    throw httpError(400, "Reserved quantity cannot exceed on-hand quantity.");
  }
  if (status === "Archived" && (quantity > 0 || reserved > 0)) {
    throw httpError(
      400,
      "Dispatch or clear all on-hand and reserved stock before archiving.",
    );
  }
  return {
    name: requireText(body.name, "Name"),
    description: String(body.description || "").trim(),
    idNumber: String(body.idNumber || "").trim(),
    quantity,
    reserved,
    minimum,
    division,
    notes: String(body.notes || "").trim(),
    status,
  };
}

async function activeAdministratorCount(client) {
  const result = await client.query(
    `
      select count(*)::integer as count
      from users
      where role_name = 'Administrator'
        and active = true
        and archived = false
    `,
  );
  return result.rows[0].count;
}

async function guardLastAdministrator(client, target, nextState) {
  if (
    target.role_name !== "Administrator" ||
    !target.active ||
    target.archived
  ) {
    return;
  }
  const remainsActiveAdministrator =
    nextState.roleName === "Administrator" &&
    nextState.active === true &&
    nextState.archived === false;
  if (remainsActiveAdministrator) return;
  await client.query(
    "select pg_advisory_xact_lock(hashtext('stockline_active_admin_guard'))",
  );
  if ((await activeAdministratorCount(client)) <= 1) {
    throw httpError(409, "At least one active administrator must remain.");
  }
}

async function handleApi(request, response, url) {
  const path = url.pathname;
  const method = request.method || "GET";

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const origin = request.headers.origin;
    const forwardedProtocol = request.headers["x-forwarded-proto"];
    const expectedOrigin = `${forwardedProtocol || "http"}://${request.headers.host}`;
    if (origin && origin !== expectedOrigin) {
      throw httpError(403, "Cross-site requests are not allowed.");
    }
  }

  if (path === "/api/health" && method === "GET") {
    const health = await databaseHealth();
    return sendJson(response, health.connected ? 200 : 503, health);
  }

  if (path === "/api/login" && method === "POST") {
    const body = await readJson(request);
    const username = requireText(body.username, "Username").toLowerCase();
    const password = requireText(body.password, "Password");
    const result = await requirePool().query(
      `
        select u.*, r.manage_inventory, r.dispatch_inventory, r.view_logs,
               r.manage_users
        from users u
        join roles r on r.name = u.role_name
        where lower(u.username) = $1
          and u.active = true
          and u.archived = false
      `,
      [username],
    );
    const row = result.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      throw httpError(401, "That username or password is not valid.");
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000);
    await requirePool().query("delete from sessions where expires_at <= now()");
    await requirePool().query(
      `
        insert into sessions (token_hash, user_id, expires_at)
        values ($1, $2, $3)
      `,
      [hashSessionToken(token), row.id, expiresAt],
    );
    return sendJson(
      response,
      200,
      { user: mapUser(row) },
      { "Set-Cookie": sessionCookie(token, sessionHours * 60 * 60) },
    );
  }

  const user = await authenticate(request);
  if (!user) {
    throw httpError(401, "Sign in is required.");
  }

  if (path === "/api/logout" && method === "POST") {
    await requirePool().query("delete from sessions where token_hash = $1", [
      user.tokenHash,
    ]);
    return sendJson(
      response,
      200,
      { ok: true },
      { "Set-Cookie": clearSessionCookie() },
    );
  }

  if (path === "/api/state" && method === "GET") {
    return sendJson(response, 200, await loadApplicationState(user));
  }

  if (path === "/api/inventory" && method === "POST") {
    requirePermission(user, "manageInventory");
    const values = inventoryValues(await readJson(request));
    const item = await withTransaction(async (client) => {
      const result = await client.query(
        `
          insert into inventory_items (
            name, description, id_number, quantity, reserved, minimum,
            division, notes, status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, 'Active')
          returning *
        `,
        [
          values.name,
          values.description,
          values.idNumber,
          values.quantity,
          values.reserved,
          values.minimum,
          values.division,
          values.notes,
        ],
      );
      await client.query(
        `
          insert into inventory_movements (
            item_id, user_id, movement_type, quantity_delta, details
          )
          values ($1, $2, 'Created', $3, $4)
        `,
        [result.rows[0].id, user.id, values.quantity, `${values.division} inventory`],
      );
      await writeAudit(
        client,
        user,
        "Item created",
        values.name,
        values.quantity,
        `${values.division} inventory`,
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { item: mapInventory(item) });
  }

  const inventoryMatch = path.match(/^\/api\/inventory\/(\d+)$/);
  if (inventoryMatch && method === "PUT") {
    requirePermission(user, "manageInventory");
    const values = inventoryValues(await readJson(request));
    const item = await withTransaction(async (client) => {
      const current = await client.query(
        "select * from inventory_items where id = $1 for update",
        [inventoryMatch[1]],
      );
      if (!current.rowCount) throw httpError(404, "Inventory item not found.");
      const old = current.rows[0];
      const result = await client.query(
        `
          update inventory_items set
            name = $2, description = $3, id_number = $4, quantity = $5,
            reserved = $6, minimum = $7, division = $8, notes = $9, status = $10
          where id = $1
          returning *
        `,
        [
          inventoryMatch[1],
          values.name,
          values.description,
          values.idNumber,
          values.quantity,
          values.reserved,
          values.minimum,
          values.division,
          values.notes,
          values.status,
        ],
      );
      const changes = [];
      if (old.quantity !== values.quantity) {
        changes.push(`On hand ${old.quantity} -> ${values.quantity}`);
        await client.query(
          `
            insert into inventory_movements (
              item_id, user_id, movement_type, quantity_delta, details
            )
            values ($1, $2, 'Adjustment', $3, 'Manual inventory edit')
          `,
          [inventoryMatch[1], user.id, values.quantity - old.quantity],
        );
      }
      if (old.minimum !== values.minimum) {
        changes.push(`Minimum ${old.minimum} -> ${values.minimum}`);
      }
      if (old.division !== values.division) {
        changes.push(`Division ${old.division} -> ${values.division}`);
      }
      if (old.status !== values.status) {
        changes.push(`Status ${old.status} -> ${values.status}`);
      }
      await writeAudit(
        client,
        user,
        old.status !== values.status ? "Item status updated" : "Item edited",
        values.name,
        null,
        changes.join(" | ") || "Inventory details updated",
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { item: mapInventory(item) });
  }

  const dispatchMatch = path.match(/^\/api\/inventory\/(\d+)\/dispatch$/);
  if (dispatchMatch && method === "POST") {
    requirePermission(user, "dispatchInventory");
    const body = await readJson(request);
    const quantity = requireNonnegativeInteger(body.quantity, "Quantity");
    if (quantity < 1) throw httpError(400, "Quantity must be at least 1.");
    const details = [body.destination, body.notes]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" | ");
    const item = await withTransaction(async (client) => {
      const current = await client.query(
        "select * from inventory_items where id = $1 for update",
        [dispatchMatch[1]],
      );
      if (!current.rowCount) throw httpError(404, "Inventory item not found.");
      const row = current.rows[0];
      const available = row.quantity - row.reserved;
      if (row.status === "Archived" || quantity > available) {
        throw httpError(409, "Quantity must be within the available amount.");
      }
      const result = await client.query(
        `
          update inventory_items
          set quantity = quantity - $2
          where id = $1
          returning *
        `,
        [dispatchMatch[1], quantity],
      );
      await client.query(
        `
          insert into inventory_movements (
            item_id, user_id, movement_type, quantity_delta, details
          )
          values ($1, $2, 'Dispatch', $3, $4)
        `,
        [dispatchMatch[1], user.id, -quantity, details],
      );
      await writeAudit(
        client,
        user,
        "Dispatch",
        row.name,
        -quantity,
        details,
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { item: mapInventory(item) });
  }

  const restockMatch = path.match(/^\/api\/inventory\/(\d+)\/restock$/);
  if (restockMatch && method === "POST") {
    requirePermission(user, "dispatchInventory");
    const body = await readJson(request);
    const quantity = requireNonnegativeInteger(body.quantity, "Quantity");
    if (quantity < 1) throw httpError(400, "Quantity must be at least 1.");
    const details =
      [body.reference, body.notes]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" | ") || "Inventory received";
    const item = await withTransaction(async (client) => {
      const current = await client.query(
        "select * from inventory_items where id = $1 for update",
        [restockMatch[1]],
      );
      if (!current.rowCount) throw httpError(404, "Inventory item not found.");
      const row = current.rows[0];
      if (row.status !== "Active") {
        throw httpError(409, "Only Active items can receive new inventory.");
      }
      const result = await client.query(
        `
          update inventory_items
          set quantity = quantity + $2
          where id = $1
          returning *
        `,
        [restockMatch[1], quantity],
      );
      await client.query(
        `
          insert into inventory_movements (
            item_id, user_id, movement_type, quantity_delta, details
          )
          values ($1, $2, 'Restock', $3, $4)
        `,
        [restockMatch[1], user.id, quantity, details],
      );
      await writeAudit(
        client,
        user,
        "Restock",
        row.name,
        quantity,
        details,
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { item: mapInventory(item) });
  }

  if (path === "/api/users" && method === "POST") {
    requirePermission(user, "manageUsers");
    const body = await readJson(request);
    const password = requireText(body.password, "Password");
    if (password.length < 6) {
      throw httpError(400, "Password must be at least 6 characters.");
    }
    const role = ["Administrator", "Warehouse", "Viewer"].includes(body.role)
      ? body.role
      : "Viewer";
    try {
      const result = await withTransaction(async (client) => {
        const created = await client.query(
          `
            insert into users (
              name, username, password_hash, role_name, active, archived
            )
            values ($1, lower($2), $3, $4, true, false)
            returning id, name, username, role_name, active, archived
          `,
          [
            requireText(body.name, "Full name"),
            requireText(body.username, "Username"),
            await hashPassword(password),
            role,
          ],
        );
        await writeAudit(
          client,
          user,
          "Login created",
          created.rows[0].name,
          null,
          `${role} access`,
        );
        return created.rows[0];
      });
      return sendJson(response, 201, { user: mapUser(result) });
    } catch (error) {
      if (error.code === "23505") {
        throw httpError(409, "That username is already in use.");
      }
      throw error;
    }
  }

  const userMatch = path.match(/^\/api\/users\/(\d+)$/);
  if (userMatch && method === "PUT") {
    const body = await readJson(request);
    const isSelf = user.id === userMatch[1];
    if (!isSelf) requirePermission(user, "manageUsers");
    try {
      const updated = await withTransaction(async (client) => {
        const current = await client.query(
          "select * from users where id = $1 for update",
          [userMatch[1]],
        );
        if (!current.rowCount) throw httpError(404, "User not found.");
        const target = current.rows[0];
        const role =
          isSelf || !["Administrator", "Warehouse", "Viewer"].includes(body.role)
            ? target.role_name
            : body.role;
        await guardLastAdministrator(client, target, {
          roleName: role,
          active: target.active,
          archived: target.archived,
        });
        if (body.password && String(body.password).length < 6) {
          throw httpError(400, "Password must be at least 6 characters.");
        }
        const passwordHash = body.password
          ? await hashPassword(String(body.password))
          : target.password_hash;
        const changes = [];
        const name = requireText(body.name, "Full name");
        const username = requireText(body.username, "Username").toLowerCase();
        if (target.name !== name) changes.push(`Name ${target.name} -> ${name}`);
        if (target.username !== username) {
          changes.push(`Username ${target.username} -> ${username}`);
        }
        if (target.role_name !== role) {
          changes.push(`Role ${target.role_name} -> ${role}`);
        }
        if (body.password) changes.push("Password reset");
        const result = await client.query(
          `
            update users set
              name = $2, username = $3, password_hash = $4, role_name = $5
            where id = $1
            returning id, name, username, role_name, active, archived
          `,
          [userMatch[1], name, username, passwordHash, role],
        );
        await writeAudit(
          client,
          user,
          "Login updated",
          name,
          null,
          changes.join(" | ") || "Account details reviewed",
        );
        return result.rows[0];
      });
      return sendJson(response, 200, { user: mapUser(updated) });
    } catch (error) {
      if (error.code === "23505") {
        throw httpError(409, "That username is already in use.");
      }
      throw error;
    }
  }

  const userStatusMatch = path.match(/^\/api\/users\/(\d+)\/status$/);
  if (userStatusMatch && method === "POST") {
    requirePermission(user, "manageUsers");
    const body = await readJson(request);
    if (!["activate", "deactivate", "archive", "restore"].includes(body.action)) {
      throw httpError(400, "Unknown account action.");
    }
    if (user.id === userStatusMatch[1]) {
      throw httpError(409, "You cannot disable or archive your own account.");
    }
    const updated = await withTransaction(async (client) => {
      const current = await client.query(
        "select * from users where id = $1 for update",
        [userStatusMatch[1]],
      );
      if (!current.rowCount) throw httpError(404, "User not found.");
      const target = current.rows[0];
      if (
        target.archived &&
        (body.action === "activate" || body.action === "deactivate")
      ) {
        throw httpError(409, "Restore the archived account before changing access.");
      }
      const next = {
        active:
          body.action === "activate" || body.action === "restore"
            ? true
            : false,
        archived: body.action === "archive" ? true : body.action === "restore" ? false : target.archived,
        roleName: target.role_name,
      };
      await guardLastAdministrator(client, target, next);
      const result = await client.query(
        `
          update users
          set active = $2, archived = $3
          where id = $1
          returning id, name, username, role_name, active, archived
        `,
        [userStatusMatch[1], next.active, next.archived],
      );
      const actionLabels = {
        activate: "Login activated",
        deactivate: "Login deactivated",
        archive: "Login archived",
        restore: "Login restored",
      };
      await writeAudit(
        client,
        user,
        actionLabels[body.action],
        target.name,
        null,
        `${target.role_name} account ${body.action}d`,
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { user: mapUser(updated) });
  }

  if (userMatch && method === "DELETE") {
    requirePermission(user, "manageUsers");
    if (user.id === userMatch[1]) {
      throw httpError(409, "You cannot delete your own account.");
    }
    await withTransaction(async (client) => {
      const current = await client.query(
        "select * from users where id = $1 for update",
        [userMatch[1]],
      );
      if (!current.rowCount) throw httpError(404, "User not found.");
      const target = current.rows[0];
      if (!target.archived) {
        throw httpError(409, "Archive the account before permanently deleting it.");
      }
      await guardLastAdministrator(client, target, {
        roleName: target.role_name,
        active: false,
        archived: true,
      });
      await writeAudit(
        client,
        user,
        "Login deleted",
        target.name,
        null,
        `${target.role_name} account permanently removed`,
      );
      await client.query("delete from users where id = $1", [userMatch[1]]);
    });
    return sendJson(response, 200, { ok: true });
  }

  const roleMatch = path.match(
    /^\/api\/roles\/(Administrator|Warehouse|Viewer)$/,
  );
  if (roleMatch && method === "PUT") {
    requirePermission(user, "manageUsers");
    const body = await readJson(request);
    if (
      roleMatch[1] === "Administrator" &&
      body.manageUsers === false
    ) {
      throw httpError(
        409,
        "Administrator user management permission is protected.",
      );
    }
    const values = {
      manageInventory: Boolean(body.manageInventory),
      dispatchInventory: Boolean(body.dispatchInventory),
      viewLogs: Boolean(body.viewLogs),
      manageUsers:
        roleMatch[1] === "Administrator" ? true : Boolean(body.manageUsers),
    };
    const result = await withTransaction(async (client) => {
      const updated = await client.query(
        `
          update roles set
            manage_inventory = $2,
            dispatch_inventory = $3,
            view_logs = $4,
            manage_users = $5
          where name = $1
          returning *
        `,
        [
          roleMatch[1],
          values.manageInventory,
          values.dispatchInventory,
          values.viewLogs,
          values.manageUsers,
        ],
      );
      await writeAudit(
        client,
        user,
        "Role permissions updated",
        roleMatch[1],
        null,
        "Role permissions saved",
      );
      return updated.rows[0];
    });
    return sendJson(response, 200, {
      role: { name: roleMatch[1], ...mapPermissions(result) },
    });
  }

  throw httpError(404, "API endpoint not found.");
}

function serveStatic(request, response, url) {
  const relative =
    url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
  const safeRelative = decodeURIComponent(relative);
  const requested = normalize(join(root, safeRelative));
  const file =
    publicFiles.has(safeRelative) &&
    requested.startsWith(root) &&
    existsSync(requested) &&
    statSync(requested).isFile()
      ? requested
      : join(root, "index.html");

  response.writeHead(200, {
    "Content-Type": types[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
  });
  createReadStream(file).pipe(response);
}

export async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
    } else {
      serveStatic(request, response, url);
    }
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error);
    sendJson(response, statusCode, {
      error:
        statusCode >= 500
          ? "The server could not complete the request."
          : error.message,
      ...(statusCode === 503 ? { detail: error.message } : {}),
    });
  }
}

export function createStocklineServer() {
  return createServer(handleRequest);
}

function isDirectRun() {
  return Boolean(
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href,
  );
}

let server;

if (isDirectRun()) {
  server = createStocklineServer();

  server.listen(port, host, () => {
    console.log(`Stockline listening on ${host}:${port}`);
    if (!pool) {
      console.warn(
        "DATABASE_URL is not configured. The UI will load, but database actions are unavailable.",
      );
    }
  });

  async function shutdown() {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool?.end();
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
