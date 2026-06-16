import { requirePool } from "../lib/db.mjs";
import { hashPassword } from "../lib/security.mjs";
import { REAL_INVENTORY_ROWS } from "../db/seed/inventory-data.mjs";

const database = requirePool();
const client = await database.connect();

const roles = [
  ["Administrator", true, true, true, true],
  ["Warehouse", true, true, true, false],
  ["Viewer", false, false, true, false],
];
const isProduction = process.env.NODE_ENV === "production";
const initialAdminPassword =
  process.env.INITIAL_ADMIN_PASSWORD || (isProduction ? "" : "admin123");

if (!initialAdminPassword) {
  throw new Error(
    "INITIAL_ADMIN_PASSWORD is required when NODE_ENV=production.",
  );
}
if (isProduction && initialAdminPassword.length < 12) {
  throw new Error(
    "INITIAL_ADMIN_PASSWORD must contain at least 12 characters in production.",
  );
}

const users = [
  [
    process.env.INITIAL_ADMIN_NAME || "Carlos Lopez",
    process.env.INITIAL_ADMIN_USERNAME || "carlos",
    initialAdminPassword,
    "Administrator",
  ],
];
if (!isProduction) {
  users.push(
    ["Sarah Miller", "sarah", "stock123", "Warehouse"],
    ["James Turner", "james", "stock123", "Viewer"],
  );
}

try {
  await client.query("begin");
  for (const role of roles) {
    await client.query(
      `
        insert into roles (
          name, manage_inventory, dispatch_inventory, view_logs, manage_users
        )
        values ($1, $2, $3, $4, $5)
        on conflict (name) do nothing
      `,
      role,
    );
  }

  const existingUsers = await client.query(
    "select count(*)::integer as count from users",
  );
  if (existingUsers.rows[0].count === 0) {
    for (const [name, username, password, roleName] of users) {
      const passwordHash = await hashPassword(password);
      await client.query(
        `
          insert into users (name, username, password_hash, role_name)
          values ($1, lower($2), $3, $4)
        `,
        [name, username, passwordHash, roleName],
      );
    }
  }

  for (const [name, idNumber, quantity, sourceRow] of REAL_INVENTORY_ROWS) {
    await client.query(
      `
        insert into inventory_items (
          source_key, name, id_number, quantity, division
        )
        values ($1, $2, $3, $4, 'TTS')
        on conflict (source_key) do nothing
      `,
      [`sharepoint-${sourceRow}`, name, idNumber, quantity],
    );
  }

  const importLog = await client.query(
    "select 1 from audit_logs where action = 'Inventory imported' limit 1",
  );
  if (!importLog.rowCount) {
    await client.query(
      `
        insert into audit_logs (
          user_name_snapshot, action, item, quantity, details
        )
        values ('System', 'Inventory imported', 'SharePoint Inventory', $1,
                'Available imported as On hand from INVENTORY.xlsx')
      `,
      [REAL_INVENTORY_ROWS.length],
    );
  }

  await client.query("commit");
  console.log(
    `Seeded defaults and ${REAL_INVENTORY_ROWS.length} inventory lines.`,
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await database.end();
}
