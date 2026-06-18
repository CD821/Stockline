const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  box: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v9"/><path d="M3 8v9l9 5 9-5V8"/>',
  truck: '<path d="M10 17h4V5H2v12h3"/><path d="M14 9h4l4 4v4h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  logout: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  restock: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/><path d="M17 3v6M14 6h6"/>',
  userPlus: '<path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8" cy="7" r="4"/><path d="M19 8v6M16 11h6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  archive: '<path d="M3 6h18v4H3z"/><path d="M5 10v10h14V10M9 14h6"/>',
  trash: '<path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 11v6M14 11v6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
};

const icon = (name, className = "") =>
  `<svg aria-hidden="true" class="icon ${className}" viewBox="0 0 24 24">${icons[name]}</svg>`;

const DIVISIONS = ["TTS", "Bespoke"];
const ITEM_STATUSES = ["Active", "Discontinued", "Archived"];
const INVENTORY_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const ROLE_NAMES = ["Administrator", "Warehouse", "Viewer"];
const PERMISSIONS = [
  ["manageInventory", "Edit inventory"],
  ["dispatchInventory", "Dispatch and receive"],
  ["viewLogs", "View Dispatch Log"],
  ["manageUsers", "Manage users and roles"],
];
const DEFAULT_ROLES = {
  Administrator: {
    manageInventory: true,
    dispatchInventory: true,
    viewLogs: true,
    manageUsers: true,
  },
  Warehouse: {
    manageInventory: true,
    dispatchInventory: true,
    viewLogs: true,
    manageUsers: false,
  },
  Viewer: {
    manageInventory: false,
    dispatchInventory: false,
    viewLogs: true,
    manageUsers: false,
  },
};

const ui = {
  page: "inventory",
  search: "",
  division: "All divisions",
  stock: "All stock levels",
  lifecycle: "Current inventory",
  inventoryPage: 1,
  rowsPerPage: 50,
  dispatchSearch: "",
  logSearch: "",
  logUser: "All users",
  logAction: "All actions",
  logSort: "newest",
  modal: null,
  selectedId: null,
  mobileMenu: false,
  loginError: "",
  loading: true,
  systemError: "",
};

function normalizeDivision(value, itemId) {
  if (DIVISIONS.includes(value)) return value;
  if (value === "Trim" || itemId === "inv-2" || itemId === "inv-5") return "Bespoke";
  return "TTS";
}

let state = {
  inventory: [],
  users: [],
  roles: structuredClone(DEFAULT_ROLES),
  logs: [],
};
let currentUserId = null;

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "The server could not complete the request.");
    error.status = response.status;
    error.detail = result.detail;
    throw error;
  }
  return result;
}

async function refreshState() {
  const snapshot = await apiRequest("/api/state");
  state = {
    inventory: snapshot.inventory,
    users: snapshot.users,
    roles: snapshot.roles,
    logs: snapshot.logs,
  };
  currentUserId = snapshot.currentUser.id;
  ui.loading = false;
  ui.systemError = "";
  render();
}

async function bootstrap() {
  try {
    await refreshState();
  } catch (error) {
    ui.loading = false;
    if (error.status === 401) {
      currentUserId = null;
      render();
      return;
    }
    ui.systemError = error.detail || error.message;
    render();
  }
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function available(item) {
  return Math.max(0, Number(item.quantity) - Number(item.reserved || 0));
}

function isLow(item) {
  return (
    item.status === "Active" &&
    Number(item.minimum) > 0 &&
    available(item) <= Number(item.minimum)
  );
}

function isCurrent(item) {
  return item.status !== "Archived";
}

function currentUser() {
  return state.users.find((user) => user.id === currentUserId);
}

function can(permission) {
  const user = currentUser();
  return Boolean(user && state.roles[user.role]?.[permission]);
}

function formatNumber(value) {
  return Number(value).toLocaleString();
}

function formatDate(value, withDate = false) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: withDate ? "short" : undefined,
    day: withDate ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(title, message, type = "success") {
  const region = document.querySelector("#toast-region");
  const node = document.createElement("div");
  node.className = `toast ${type === "error" ? "error" : ""}`;
  node.innerHTML = `${icon(type === "error" ? "alert" : "check", "icon-sm")}<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></div>`;
  region.appendChild(node);
  window.setTimeout(() => node.remove(), 3500);
}

function render() {
  const app = document.querySelector("#app");
  if (ui.loading) {
    app.innerHTML = `
      <main class="loading-page">
        <div class="loading-card"><strong>Loading Stockline</strong><span>Connecting to the inventory database…</span></div>
      </main>
    `;
    return;
  }
  const user = currentUser();
  if (!user || !user.active) {
    currentUserId = null;
    app.innerHTML = loginView();
    bindLogin();
    return;
  }

  app.innerHTML = shellView(user);
  bindShell();
}

function loginView() {
  return `
    <main class="login-page">
      <section class="login-brand-panel">
        <div class="login-brand">
          <span class="brand-mark" aria-hidden="true">
            <span class="brand-layer"></span><span class="brand-layer"></span><span class="brand-layer"></span>
          </span>
          Stockline
        </div>
        <div class="login-message">
          <h1>Know what you have. Move it with confidence.</h1>
          <p>One clear place to track inventory, dispatch materials, receive stock, and see who changed what.</p>
        </div>
        <div class="login-foot">Local inventory workspace · Every change is recorded</div>
      </section>
      <section class="login-form-panel">
        <form class="login-card" id="login-form">
          <h2>Welcome back</h2>
          <p>Sign in to your PostgreSQL-backed inventory workspace.</p>
          ${
            ui.systemError
              ? `<div class="error-message" role="alert"><strong>Database unavailable</strong><br />${escapeHtml(ui.systemError)}</div>`
              : ""
          }
          <div class="form-group">
            <label for="username">Username</label>
            <input class="field" id="username" name="username" autocomplete="username" required />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input class="field" id="password" name="password" type="password" autocomplete="current-password" required />
          </div>
          ${ui.loginError ? `<div class="error-message" role="alert">${escapeHtml(ui.loginError)}</div>` : ""}
          <button class="button primary" type="submit" ${ui.systemError ? "disabled" : ""}>Sign in</button>
          <div class="demo-credentials">Accounts, inventory, permissions, and audit history are stored in PostgreSQL.</div>
        </form>
      </section>
    </main>
  `;
}

function bindLogin() {
  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest("/api/login", {
        method: "POST",
        body: {
          username: String(data.get("username")).trim(),
          password: String(data.get("password")),
        },
      });
      ui.loginError = "";
      await refreshState();
    } catch (error) {
      ui.loginError = error.message;
      render();
    }
  });
}

const navItems = [
  ["overview", "Overview", "home", null],
  ["inventory", "Inventory", "box", null],
  ["logs", "Dispatch Log", "truck", "viewLogs"],
  ["team", "Team & Access", "users", "manageUsers"],
];

function shellView(user) {
  const lowCount = state.inventory.filter(isLow).length;
  const visibleNavItems = navItems.filter(([, , , permission]) =>
    permission ? can(permission) : true,
  );
  if (!visibleNavItems.some(([page]) => page === ui.page)) ui.page = "inventory";
  return `
    <div class="app-shell">
      <aside class="sidebar ${ui.mobileMenu ? "open" : ""}" id="sidebar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">
            <span class="brand-layer"></span><span class="brand-layer"></span><span class="brand-layer"></span>
          </span>
          Stockline
        </div>
        <nav class="nav-list" aria-label="Primary">
          ${navItems
            .filter(([, , , permission]) => (permission ? can(permission) : true))
            .map(
              ([page, label, iconName]) => `
                <button class="nav-button ${ui.page === page ? "active" : ""}" data-page="${page}">
                  ${icon(iconName)}<span>${label}</span>
                </button>
              `,
            )
            .join("")}
        </nav>
        <div class="account-card">
          <span class="avatar">${initials(user.name)}</span>
          <span class="account-copy"><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.role)}</span></span>
          <button class="signout-button" id="signout" title="Sign out" aria-label="Sign out">${icon("logout", "icon-sm")}</button>
        </div>
      </aside>
      <main class="main-shell">
        <header class="topbar">
          <button class="icon-button mobile-menu-button" id="mobile-menu" aria-label="Open navigation">${icon("menu")}</button>
          <div class="topbar-actions">
            <button class="icon-button" id="notifications" aria-label="${lowCount} low stock notifications">
              ${icon("bell")}
              ${lowCount ? `<span class="notification-dot">${lowCount}</span>` : ""}
            </button>
            <button class="icon-button" id="help" aria-label="Help">${icon("info")}</button>
          </div>
        </header>
        ${pageView()}
      </main>
      ${modalView()}
    </div>
  `;
}

function pageView() {
  if (ui.page === "overview") return overviewView();
  if (ui.page === "logs") return logsView();
  if (ui.page === "team") return teamView();
  return inventoryView();
}

function pageHeader(title, subtitle, actions = "") {
  return `
    <div class="page-header">
      <div class="page-title"><h1>${title}</h1><p>${subtitle}</p></div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ""}
    </div>
  `;
}

function summaryView() {
  const currentInventory = state.inventory.filter(isCurrent);
  const totalItems = currentInventory.length;
  const totalAvailable = currentInventory.reduce((sum, item) => sum + available(item), 0);
  const lowCount = state.inventory.filter(isLow).length;
  const today = new Date().toDateString();
  const activityToday = state.logs.filter(
    (entry) => new Date(entry.timestamp).toDateString() === today,
  ).length;

  const items = [
    ["box", "Total items", formatNumber(totalItems), ""],
    ["check", "Available units", formatNumber(totalAvailable), "green"],
    ["alert", "Low stock", formatNumber(lowCount), "amber"],
    ["clock", "Activity today", formatNumber(activityToday), ""],
  ];

  return `
    <section class="summary-band" aria-label="Inventory summary">
      ${items
        .map(
          ([iconName, label, value, tone]) => `
            <div class="summary-item">
              <span class="summary-icon ${tone}">${icon(iconName)}</span>
              <span class="summary-copy"><span>${label}</span><strong class="${tone === "amber" ? "warning" : ""}">${value}</strong></span>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function overviewView() {
  const lowItems = state.inventory.filter(isLow);
  const currentInventory = state.inventory.filter(isCurrent);
  const hasDispatchableItems = state.inventory.some(
    (item) => item.status !== "Archived" && available(item) > 0,
  );
  const divisionTotals = currentInventory.reduce((totals, item) => {
    totals[item.division] = (totals[item.division] || 0) + available(item);
    return totals;
  }, {});

  return `
    <section class="page">
      ${pageHeader("Overview", "A quick view of stock health and recent movement.", `
        <button class="button primary" data-open="dispatch" ${can("dispatchInventory") && hasDispatchableItems ? "" : "disabled"}>${icon("truck", "icon-sm")} Dispatch items</button>
      `)}
      ${summaryView()}
      <div class="overview-grid">
        <section class="section-card">
          <div class="section-heading"><div><h2>Stock by division</h2><p>Available units across active inventory.</p></div></div>
          <ul class="overview-list">
            ${Object.entries(divisionTotals)
              .map(
                ([division, amount]) => `
                  <li class="overview-row"><span><strong>${escapeHtml(division)}</strong><span>${currentInventory.filter((item) => item.division === division).length} inventory lines</span></span><span class="overview-number">${formatNumber(amount)}</span></li>
                `,
              )
              .join("")}
          </ul>
        </section>
        <section class="section-card">
          <div class="section-heading"><div><h2>Items to reorder</h2><p>At or below minimum quantity.</p></div><button class="text-button" data-open="purchase">View list</button></div>
          ${
            lowItems.length
              ? `<ul class="overview-list">${lowItems
                  .map(
                    (item) => `
                      <li class="overview-row"><span><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.idNumber)} · Minimum ${formatNumber(item.minimum)}</span></span><span class="status low">${formatNumber(available(item))} left</span></li>
                    `,
                  )
                  .join("")}</ul>`
              : `<div class="empty-state"><div><strong>Stock levels look healthy</strong><span>No items are at or below their minimum.</span></div></div>`
          }
        </section>
      </div>
    </section>
  `;
}

function filteredInventory() {
  const query = ui.search.trim().toLowerCase();
  return state.inventory.filter((item) => {
    const haystack = [
      item.name,
      item.description,
      item.idNumber,
      item.division,
      item.notes,
      item.status,
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesDivision =
      ui.division === "All divisions" || item.division === ui.division;
    const low = isLow(item);
    const matchesStock =
      ui.stock === "All stock levels" ||
      (ui.stock === "Low stock" && low) ||
      (ui.stock === "In stock" && !low);
    const matchesLifecycle =
      ui.lifecycle === "All statuses" ||
      (ui.lifecycle === "Current inventory" && isCurrent(item)) ||
      item.status === ui.lifecycle;
    return matchesQuery && matchesDivision && matchesStock && matchesLifecycle;
  });
}

function inventoryView() {
  const lowItems = state.inventory.filter(isLow);
  const filtered = filteredInventory();
  const pageSize = INVENTORY_PAGE_SIZE_OPTIONS.includes(Number(ui.rowsPerPage))
    ? Number(ui.rowsPerPage)
    : 50;
  ui.rowsPerPage = pageSize;
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / pageSize),
  );
  ui.inventoryPage = Math.min(Math.max(ui.inventoryPage, 1), totalPages);
  const pageStart = (ui.inventoryPage - 1) * pageSize;
  const pageItems = filtered.slice(
    pageStart,
    pageStart + pageSize,
  );
  const firstVisible = filtered.length ? pageStart + 1 : 0;
  const lastVisible = Math.min(
    pageStart + pageSize,
    filtered.length,
  );
  const canManageInventory = can("manageInventory");
  const canDispatchInventory = can("dispatchInventory");
  const canViewLogs = can("viewLogs");
  const hasDispatchableItems = state.inventory.some(
    (item) => item.status !== "Archived" && available(item) > 0,
  );

  return `
    <section class="page">
      ${pageHeader("Inventory", "Track stock, dispatch materials, and stay ahead of reorders.", `
        <button class="button primary" data-open="add" ${canManageInventory ? "" : "disabled"}>${icon("plus", "icon-sm")} Add inventory</button>
        <button class="button teal-outline" data-open="dispatch" ${canDispatchInventory && hasDispatchableItems ? "" : "disabled"}>${icon("truck", "icon-sm")} Dispatch items</button>
      `)}
      ${
        lowItems.length
          ? `
            <section class="alert-band">
              <span class="alert-icon">${icon("alert", "icon-lg")}</span>
              <span class="alert-copy"><strong>${lowItems.length} ${lowItems.length === 1 ? "item needs" : "items need"} attention</strong><span>Some items are at or below their minimum stock level.</span></span>
              <span class="alert-actions"><button class="button small" data-open="purchase">${icon("box", "icon-sm")} Create purchase list</button></span>
            </section>
          `
          : ""
      }
      ${summaryView()}
      <div class="inventory-layout ${canViewLogs ? "" : "single-column"}">
        <div class="inventory-main">
          <div class="toolbar">
            <label class="search-field">
              ${icon("search", "icon-sm")}
              <input id="inventory-search" type="search" placeholder="Search name, description, ID, or notes" value="${escapeHtml(ui.search)}" />
            </label>
            <select id="division-filter" aria-label="Filter by division">
              <option>All divisions</option>
              ${DIVISIONS.map((division) => `<option ${ui.division === division ? "selected" : ""}>${division}</option>`).join("")}
            </select>
            <select id="stock-filter" aria-label="Filter by stock level">
              ${["All stock levels", "In stock", "Low stock"].map((option) => `<option ${ui.stock === option ? "selected" : ""}>${option}</option>`).join("")}
            </select>
            <select id="lifecycle-filter" aria-label="Filter by item status">
              ${["Current inventory", "Active", "Discontinued", "Archived", "All statuses"].map((option) => `<option ${ui.lifecycle === option ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </div>
          <section class="table-wrap">
            <div class="table-scroller">
              <table class="data-table">
                <colgroup>
                  <col style="width: 100px" /><col style="width: 90px" /><col style="width: 78px" />
                  <col style="width: 70px" /><col style="width: 75px" /><col style="width: 62px" />
                  <col style="width: 70px" /><col style="width: 70px" /><col style="width: 64px" />
                  <col style="width: 132px" />
                </colgroup>
                <thead>
                  <tr><th>Name</th><th>Description</th><th>ID Number</th><th>Division</th><th>Notes</th><th>On hand</th><th>Available</th><th>Minimum</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  ${
                    pageItems.length
                      ? pageItems
                          .map((item) =>
                            inventoryRow(
                              item,
                              canManageInventory,
                              canDispatchInventory,
                              canViewLogs,
                            ),
                          )
                          .join("")
                      : `<tr><td colspan="10"><div class="empty-state"><div><strong>No inventory found</strong><span>Try a different search or filter.</span></div></div></td></tr>`
                  }
                </tbody>
              </table>
            </div>
            <div class="table-footer">
              <span>Showing ${firstVisible}–${lastVisible} of ${filtered.length} matching inventory lines (${state.inventory.length} total)</span>
              <div class="pagination-group">
                <label class="rows-per-page" for="inventory-page-size">
                  Rows
                  <select id="inventory-page-size" aria-label="Rows per page">
                    ${INVENTORY_PAGE_SIZE_OPTIONS.map(
                      (option) =>
                        `<option value="${option}" ${pageSize === option ? "selected" : ""}>${option}</option>`,
                    ).join("")}
                  </select>
                </label>
                <span class="pagination-controls">
                  <button class="button small" id="inventory-prev" ${ui.inventoryPage === 1 ? "disabled" : ""}>Previous</button>
                  <span>Page ${ui.inventoryPage} of ${totalPages}</span>
                  <button class="button small" id="inventory-next" ${ui.inventoryPage === totalPages ? "disabled" : ""}>Next</button>
                </span>
              </div>
            </div>
          </section>
          <div class="availability-note">${icon("info", "icon-sm")} Available = On hand − Reserved (dispatched or in progress). Every saved quantity change is added to the audit log.</div>
        </div>
        ${canViewLogs ? activityPanel() : ""}
      </div>
    </section>
  `;
}

function inventoryRow(item, canManageInventory, canDispatchInventory, canViewLogs) {
  const low = isLow(item);
  const discontinued = item.status === "Discontinued";
  const archived = item.status === "Archived";
  const statusLabel = archived
    ? "Archived"
    : discontinued
      ? "Discontinued"
      : low
        ? "Reorder"
        : "In stock";
  const statusClass = archived ? "archived" : discontinued ? "discontinued" : low ? "low" : "";
  const canDispatchItem =
    canDispatchInventory && !archived && available(item) > 0;
  const canRestockItem = canDispatchInventory && item.status === "Active";
  return `
    <tr class="${low ? "low-row" : ""} ${archived ? "archived-row" : ""}">
      <td><span class="item-name"><strong>${escapeHtml(item.name)}</strong></span></td>
      <td class="truncate" title="${escapeHtml(item.description)}">${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.idNumber)}</td>
      <td>${escapeHtml(item.division)}</td>
      <td class="truncate notes-cell" title="${escapeHtml(item.notes)}">${escapeHtml(item.notes) || "—"}</td>
      <td class="quantity-cell"><strong>${formatNumber(item.quantity)}</strong></td>
      <td class="quantity-cell"><strong>${formatNumber(available(item))}</strong></td>
      <td>${formatNumber(item.minimum)}</td>
      <td><span class="status ${statusClass}">${statusLabel}</span></td>
      <td>
        <span class="row-actions">
          <button class="action-button" data-action="dispatch" data-id="${item.id}" title="Dispatch ${escapeHtml(item.name)}" aria-label="Dispatch ${escapeHtml(item.name)}" ${canDispatchItem ? "" : "disabled"}>${icon("truck", "icon-sm")}</button>
          <button class="action-button" data-action="restock" data-id="${item.id}" title="Restock ${escapeHtml(item.name)}" aria-label="Restock ${escapeHtml(item.name)}" ${canRestockItem ? "" : "disabled"}>${icon("restock", "icon-sm")}</button>
          <button class="action-button" data-action="edit" data-id="${item.id}" title="Edit ${escapeHtml(item.name)}" aria-label="Edit ${escapeHtml(item.name)}" ${canManageInventory ? "" : "disabled"}>${icon("edit", "icon-sm")}</button>
          <button class="action-button" data-action="history" data-id="${item.id}" title="View log for ${escapeHtml(item.name)}" aria-label="View log for ${escapeHtml(item.name)}" ${canViewLogs ? "" : "disabled"}>${icon("history", "icon-sm")}</button>
        </span>
      </td>
    </tr>
  `;
}

function activityPanel() {
  return `
    <aside class="activity-panel">
      <div class="panel-header"><h2>Recent activity</h2><button class="text-button" data-page="logs">View all</button></div>
      <ol class="activity-list">
        ${state.logs.slice(0, 6).map(activityItem).join("")}
      </ol>
      <div class="activity-footnote">${icon("info", "icon-sm")}<span>All changes are recorded with user and timestamp for full auditability.</span></div>
    </aside>
  `;
}

function activityItem(entry) {
  const quantity =
    entry.quantity === null
      ? "—"
      : `${entry.quantity > 0 ? "+" : ""}${formatNumber(entry.quantity)}`;
  return `
    <li class="activity-item">
      <span class="avatar small">${initials(entry.user)}</span>
      <span class="activity-content">
        <span class="activity-heading"><strong>${escapeHtml(entry.action)} · ${escapeHtml(entry.item)}</strong><span>${quantity}</span></span>
        <span class="activity-meta">${escapeHtml(entry.user)} · ${escapeHtml(entry.details || "")}</span>
        <time class="activity-time">${formatDate(entry.timestamp, true)}</time>
      </span>
    </li>
  `;
}

function visibleLogs() {
  const query = ui.logSearch.trim().toLowerCase();
  const logs = state.logs.filter((entry) => {
    const matchesSearch = [entry.user, entry.action, entry.item, entry.details]
      .join(" ")
      .toLowerCase()
      .includes(query);
    const matchesUser = ui.logUser === "All users" || entry.user === ui.logUser;
    const matchesAction =
      ui.logAction === "All actions" || entry.action === ui.logAction;
    return matchesSearch && matchesUser && matchesAction;
  });

  const comparators = {
    newest: (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
    oldest: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    "user-asc": (a, b) => a.user.localeCompare(b.user),
    "action-asc": (a, b) => a.action.localeCompare(b.action),
    "item-asc": (a, b) => a.item.localeCompare(b.item),
    "quantity-desc": (a, b) => Number(b.quantity || 0) - Number(a.quantity || 0),
    "quantity-asc": (a, b) => Number(a.quantity || 0) - Number(b.quantity || 0),
  };
  return [...logs].sort(comparators[ui.logSort] || comparators.newest);
}

function logsView() {
  const logs = visibleLogs();
  const users = [...new Set(state.logs.map((entry) => entry.user))].sort();
  const actions = [...new Set(state.logs.map((entry) => entry.action))].sort();

  return `
    <section class="page">
      ${pageHeader("Dispatch Log", "A complete history of inventory movement and edits.", `
        <button class="button" id="export-log">${icon("download", "icon-sm")} Export CSV</button>
      `)}
      <section class="section-card log-card">
        <div class="log-toolbar">
          <label class="search-field">${icon("search", "icon-sm")}<input id="log-search" type="search" placeholder="Search user, action, item, or notes" value="${escapeHtml(ui.logSearch)}" /></label>
          <select class="field log-filter" id="log-user-filter" aria-label="Filter log by user">
            <option>All users</option>
            ${users.map((user) => `<option ${ui.logUser === user ? "selected" : ""}>${escapeHtml(user)}</option>`).join("")}
          </select>
          <select class="field log-filter" id="log-action-filter" aria-label="Filter log by action">
            <option>All actions</option>
            ${actions.map((action) => `<option ${ui.logAction === action ? "selected" : ""}>${escapeHtml(action)}</option>`).join("")}
          </select>
          <select class="field log-sort" id="log-sort" aria-label="Sort Dispatch Log">
            <option value="newest" ${ui.logSort === "newest" ? "selected" : ""}>Newest first</option>
            <option value="oldest" ${ui.logSort === "oldest" ? "selected" : ""}>Oldest first</option>
            <option value="user-asc" ${ui.logSort === "user-asc" ? "selected" : ""}>User A–Z</option>
            <option value="action-asc" ${ui.logSort === "action-asc" ? "selected" : ""}>Action A–Z</option>
            <option value="item-asc" ${ui.logSort === "item-asc" ? "selected" : ""}>Item A–Z</option>
            <option value="quantity-desc" ${ui.logSort === "quantity-desc" ? "selected" : ""}>Quantity high to low</option>
            <option value="quantity-asc" ${ui.logSort === "quantity-asc" ? "selected" : ""}>Quantity low to high</option>
          </select>
        </div>
        <div class="log-results">${logs.length} of ${state.logs.length} entries</div>
        <div class="log-row header"><span>Date & time</span><span>User</span><span>Action</span><span>Item / details</span><span>Quantity</span></div>
        <div>
          ${
            logs.length
              ? logs
                  .map(
                    (entry) => `
                      <div class="log-row">
                        <time>${formatDate(entry.timestamp, true)}</time>
                        <span>${escapeHtml(entry.user)}</span>
                        <span>${escapeHtml(entry.action)}</span>
                        <span><strong>${escapeHtml(entry.item)}</strong><br /><small>${escapeHtml(entry.details || "")}</small></span>
                        <span class="log-quantity ${Number(entry.quantity) < 0 ? "negative" : ""}">${entry.quantity === null ? "—" : `${entry.quantity > 0 ? "+" : ""}${formatNumber(entry.quantity)}`}</span>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="empty-state"><div><strong>No log entries found</strong><span>Try a different search.</span></div></div>`
          }
        </div>
      </section>
    </section>
  `;
}

function teamView() {
  const canManageUsers = can("manageUsers");
  const currentUsers = state.users.filter((user) => !user.archived);
  const archivedUsers = state.users.filter((user) => user.archived);
  return `
    <section class="page">
      ${pageHeader("Team & Access", "Edit logins, reset passwords, and control account access.", `
        <button class="button primary" data-open="user" ${canManageUsers ? "" : "disabled"}>${icon("userPlus", "icon-sm")} Create login</button>
      `)}
      <section class="section-card">
        <div class="section-heading">
          <div><h2>Current users</h2><p>Edit account details, roles, password resets, and login access.</p></div>
        </div>
        <div class="team-grid">
          ${currentUsers.map((user) => userCard(user, canManageUsers)).join("")}
        </div>
      </section>
      ${
        archivedUsers.length
          ? `
            <section class="section-card">
              <div class="section-heading">
                <div><h2>Archived users</h2><p>Archived accounts cannot sign in, but their audit history is preserved.</p></div>
              </div>
              <div class="team-grid">
                ${archivedUsers.map((user) => userCard(user, canManageUsers)).join("")}
              </div>
            </section>
          `
          : ""
      }
      <section class="section-card">
        <div class="section-heading"><div><h2>Role permissions</h2><p>Changes apply immediately to every user assigned to that role.</p></div></div>
        <div class="role-permission-grid">
          ${ROLE_NAMES.map((role) => rolePermissionCard(role, canManageUsers)).join("")}
        </div>
      </section>
    </section>
  `;
}

function roleOptions(selectedRole) {
  return ROLE_NAMES.map(
    (role) => `<option ${selectedRole === role ? "selected" : ""}>${role}</option>`,
  ).join("");
}

function userCard(user, canManageUsers) {
  const isSelf = user.id === currentUserId;
  const canSeeCredentials = currentUser()?.role === "Administrator";
  return `
    <article class="user-card ${user.archived ? "archived-user-card" : ""}">
      <div class="user-card-head">
        <span class="avatar">${initials(user.name)}</span>
        <span><h3>${escapeHtml(user.name)}${isSelf ? " <small>(You)</small>" : ""}</h3><p>@${escapeHtml(user.username)}</p></span>
      </div>
      ${
        canSeeCredentials
          ? `
            <div class="user-credentials">
              <span><small>Username</small><code>${escapeHtml(user.username)}</code></span>
              <span><small>Password</small><code>Securely hashed</code></span>
              <small class="credential-note">Use Edit to issue a new password. Existing passwords cannot be recovered.</small>
            </div>
          `
          : ""
      }
      <div class="user-card-meta">
        <span class="user-role-control">
          <label for="role-${user.id}">Role</label>
          <select class="field compact-select" id="role-${user.id}" data-user-role="${user.id}" aria-label="Role for ${escapeHtml(user.name)}" ${!canManageUsers || isSelf || user.archived ? "disabled" : ""}>${roleOptions(user.role)}</select>
          ${isSelf ? `<small>Your own role is protected.</small>` : ""}
        </span>
        <span class="user-card-actions">
          ${canManageUsers ? `<button class="button small" data-edit-user="${user.id}">${icon("edit", "icon-sm")} Edit</button>` : ""}
          ${
            canManageUsers && !isSelf && !user.archived
              ? `
                <button class="button small ${user.active ? "danger" : ""}" data-toggle-user="${user.id}">${user.active ? "Deactivate" : "Activate"}</button>
                <button class="button small" data-archive-user="${user.id}">${icon("archive", "icon-sm")} Archive</button>
              `
              : ""
          }
          ${
            canManageUsers && user.archived
              ? `
                <button class="button small" data-restore-user="${user.id}">Restore</button>
                <button class="button small danger" data-delete-user="${user.id}">${icon("trash", "icon-sm")} Delete</button>
              `
              : ""
          }
        </span>
      </div>
      <span class="status ${user.active && !user.archived ? "" : "inactive"}">${user.archived ? "Archived" : user.active ? "Active" : "Inactive"}</span>
    </article>
  `;
}

function rolePermissionCard(role, canManageUsers) {
  const userCount = state.users.filter(
    (user) => user.role === role && !user.archived,
  ).length;
  return `
    <article class="role-card">
      <div class="role-card-heading"><h3>${role}</h3><span>${userCount} ${userCount === 1 ? "user" : "users"}</span></div>
      <div class="permission-list">
        ${PERMISSIONS.map(([permission, label]) => {
          const protectedPermission =
            role === "Administrator" && permission === "manageUsers";
          return `
            <label class="permission-row">
              <span><strong>${label}</strong>${protectedPermission ? "<small>Protected to prevent lockout.</small>" : ""}</span>
              <input type="checkbox" data-role="${role}" data-permission="${permission}" ${state.roles[role][permission] ? "checked" : ""} ${!canManageUsers || protectedPermission ? "disabled" : ""} />
            </label>
          `;
        }).join("")}
      </div>
    </article>
  `;
}

function modalView() {
  if (!ui.modal) return "";
  if (ui.modal === "dispatch") return dispatchModal();
  if (ui.modal === "restock") return restockModal();
  if (ui.modal === "add" || ui.modal === "edit") return inventoryModal();
  if (ui.modal === "history") return historyModal();
  if (ui.modal === "purchase") return purchaseModal();
  if (ui.modal === "user" || ui.modal === "editUser") return userModal();
  if (ui.modal === "deleteUser") return deleteUserModal();
  if (ui.modal === "help") return helpModal();
  return "";
}

function selectedItem() {
  return state.inventory.find((item) => item.id === ui.selectedId);
}

function selectedUser() {
  return state.users.find((user) => user.id === ui.selectedId);
}

function itemOptions(items, selected = "", withMeta = false) {
  return items
    .map(
      (item) => {
        const label = withMeta
          ? `${item.name} | ${item.idNumber || "No ID"} | Available: ${formatNumber(available(item))}`
          : item.name;
        return `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
      },
    )
    .join("");
}

function dispatchSearchMatches(item, query) {
  if (!query) return true;
  return [
    item.name,
    item.description,
    item.idNumber,
    item.notes,
    item.division,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function modalShell(title, body, footer, wide = false) {
  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal-header"><h2 id="modal-title">${title}</h2><button class="modal-close" data-close aria-label="Close">${icon("close")}</button></header>
        ${body}
        ${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}
      </section>
    </div>
  `;
}

function dispatchModal() {
  const eligibleItems = state.inventory.filter(
    (entry) => entry.status !== "Archived" && available(entry) > 0,
  );
  const dispatchQuery = ui.dispatchSearch.trim().toLowerCase();
  const visibleItems = eligibleItems.filter((entry) =>
    dispatchSearchMatches(entry, dispatchQuery),
  );
  const item =
    visibleItems.find((entry) => entry.id === ui.selectedId) || visibleItems[0];
  const canDispatchSelection = Boolean(item);
  return modalShell(
    "Dispatch items",
    `
      <form id="dispatch-form">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full"><label for="dispatch-item-search">Search item</label><input class="field" id="dispatch-item-search" type="search" placeholder="Search by name, ID, description, or notes" value="${escapeHtml(ui.dispatchSearch)}" autocomplete="off" /><span class="help-text">${formatNumber(visibleItems.length)} matching dispatchable ${visibleItems.length === 1 ? "item" : "items"}</span></div>
            <div class="form-group full"><label for="dispatch-item">Choose item</label><select class="field" id="dispatch-item" name="itemId" ${canDispatchSelection ? "" : "disabled"}>${
              canDispatchSelection
                ? itemOptions(visibleItems, item.id, true)
                : `<option>No matching dispatchable items</option>`
            }</select></div>
            <div class="form-group"><label for="dispatch-quantity">Quantity</label><input class="field" id="dispatch-quantity" name="quantity" type="number" min="1" max="${canDispatchSelection ? available(item) : 1}" value="1" required ${canDispatchSelection ? "" : "disabled"} /><span class="help-text" id="available-help">Available: ${canDispatchSelection ? formatNumber(available(item)) : "0"}</span></div>
            <div class="form-group"><label for="destination">Division / destination</label><input class="field" id="destination" name="destination" value="Warehouse A" required /></div>
            <div class="form-group full"><label for="dispatch-notes">Notes</label><textarea class="field" id="dispatch-notes" name="notes" placeholder="Job number, recipient, or reason"></textarea></div>
          </div>
          <div class="form-note">${icon("info", "icon-sm")}<span>This action subtracts from on-hand stock and records your user and timestamp in the audit log.</span></div>
        </div>
      </form>
    `,
    `<button class="button" data-close>Cancel</button><button class="button primary" type="submit" form="dispatch-form" ${canDispatchSelection ? "" : "disabled"}>Confirm dispatch</button>`,
  );
}

function restockModal() {
  const eligibleItems = state.inventory.filter((entry) => entry.status === "Active");
  const item =
    eligibleItems.find((entry) => entry.id === ui.selectedId) || eligibleItems[0];
  if (!item) return "";
  return modalShell(
    "Add inventory",
    `
      <form id="restock-form">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full"><label for="restock-item">Existing inventory line</label><select class="field" id="restock-item" name="itemId">${itemOptions(eligibleItems, item.id)}</select></div>
            <div class="form-group"><label for="restock-quantity">Quantity received</label><input class="field" id="restock-quantity" name="quantity" type="number" min="1" value="1" required /></div>
            <div class="form-group"><label for="restock-reference">Order / PO reference</label><input class="field" id="restock-reference" name="reference" placeholder="PO-1048" /></div>
            <div class="form-group full"><label for="restock-notes">Notes</label><textarea class="field" id="restock-notes" name="notes" placeholder="Condition, supplier, or receiving notes"></textarea></div>
          </div>
          <div class="form-note">${icon("info", "icon-sm")}<span>Received stock is added to the same inventory line, preserving one complete movement history.</span></div>
        </div>
      </form>
    `,
    `<button class="button" data-close>Cancel</button><button class="button primary" type="submit" form="restock-form">Add to inventory</button>`,
  );
}

function inventoryModal() {
  const editing = ui.modal === "edit";
  const item = selectedItem() || {};
  return modalShell(
    editing ? "Edit inventory" : "Add inventory",
    `
      <form id="inventory-form">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group"><label for="item-name">Name</label><input class="field" id="item-name" name="name" value="${escapeHtml(item.name)}" required /></div>
            <div class="form-group"><label for="item-id-number">ID Number</label><input class="field" id="item-id-number" name="idNumber" value="${escapeHtml(item.idNumber)}" required /></div>
            <div class="form-group full"><label for="item-description">Description</label><input class="field" id="item-description" name="description" value="${escapeHtml(item.description)}" required /></div>
            <div class="form-group"><label for="item-division">Division</label><select class="field" id="item-division" name="division">${DIVISIONS.map((division) => `<option ${item.division === division ? "selected" : ""}>${division}</option>`).join("")}</select></div>
            ${
              editing
                ? `<div class="form-group"><label for="item-status">Item status</label><select class="field" id="item-status" name="status">${ITEM_STATUSES.map((status) => `<option ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}</select><span class="help-text">Discontinued stops restocking and reorder alerts. Archived hides the item by default and requires zero stock.</span></div>`
                : `<div class="form-group"><label>Item status</label><input type="hidden" name="status" value="Active" /><div class="field readonly-field">Active</div><span class="help-text">New inventory starts Active.</span></div>`
            }
            <div class="form-group"><label for="item-quantity">Quantity on hand</label><input class="field" id="item-quantity" name="quantity" type="number" min="0" value="${editing ? item.quantity : 0}" required /></div>
            <div class="form-group"><label for="item-reserved">Reserved</label><input class="field" id="item-reserved" name="reserved" type="number" min="0" value="${editing ? item.reserved : 0}" required /></div>
            <div class="form-group"><label for="item-minimum">Minimum quantity</label><input class="field" id="item-minimum" name="minimum" type="number" min="0" value="${editing ? item.minimum : 0}" required /></div>
            <div class="form-group full"><label for="item-notes">Notes</label><textarea class="field" id="item-notes" name="notes" placeholder="Supplier, storage location, handling notes, or other details">${escapeHtml(item.notes)}</textarea></div>
          </div>
          <div class="form-note">${icon("info", "icon-sm")}<span>Only Active items generate reorder notifications. Discontinued items can be dispatched until empty, then archived to keep the inventory list clean without losing history.</span></div>
        </div>
      </form>
    `,
    `<button class="button" data-close>Cancel</button><button class="button primary" type="submit" form="inventory-form">${editing ? "Save changes" : "Create inventory line"}</button>`,
    true,
  );
}

function historyModal() {
  const item = selectedItem();
  if (!item) return "";
  const logs = state.logs.filter((entry) => entry.item === item.name);
  return modalShell(
    `${escapeHtml(item.name)} log`,
    `
      <div class="modal-body">
        ${
          logs.length
            ? `<ol class="activity-list">${logs.map(activityItem).join("")}</ol>`
            : `<div class="empty-state"><div><strong>No changes recorded yet</strong><span>The first dispatch, restock, or edit will appear here.</span></div></div>`
        }
      </div>
    `,
    `<button class="button primary" data-close>Done</button>`,
  );
}

function purchaseModal() {
  const lowItems = state.inventory.filter(isLow);
  return modalShell(
    "Purchase list",
    `
      <div class="modal-body">
        ${
          lowItems.length
            ? `
              <table class="purchase-list">
                <thead><tr><th>Item</th><th>Available</th><th>Minimum</th><th>Suggested order</th></tr></thead>
                <tbody>
                  ${lowItems
                    .map((item) => {
                      const suggested = Math.max(item.minimum * 2 - available(item), item.minimum);
                      return `<tr><td><strong>${escapeHtml(item.name)}</strong><br /><small>${escapeHtml(item.idNumber)}</small></td><td>${formatNumber(available(item))}</td><td>${formatNumber(item.minimum)}</td><td><input class="field purchase-qty" type="number" min="1" value="${suggested}" data-item="${item.id}" /></td></tr>`;
                    })
                    .join("")}
                </tbody>
              </table>
              <div class="form-note">${icon("info", "icon-sm")}<span>Download this list as a CSV to send to purchasing or attach to an order.</span></div>
            `
            : `<div class="empty-state"><div><strong>No items need ordering</strong><span>All available quantities are above their minimum.</span></div></div>`
        }
      </div>
    `,
    lowItems.length
      ? `<button class="button" data-close>Cancel</button><button class="button primary" id="download-purchase">${icon("download", "icon-sm")} Download CSV</button>`
      : `<button class="button primary" data-close>Done</button>`,
    true,
  );
}

function userModal() {
  const editing = ui.modal === "editUser";
  const user = editing ? selectedUser() : null;
  if (editing && !user) return "";
  const isSelf = user?.id === currentUserId;
  return modalShell(
    editing ? `Edit ${escapeHtml(user.name)}` : "Create login",
    `
      <form id="user-form">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full"><label for="user-name">Full name</label><input class="field" id="user-name" name="name" value="${escapeHtml(user?.name || "")}" required /></div>
            <div class="form-group"><label for="user-username">Login username</label><input class="field" id="user-username" name="username" value="${escapeHtml(user?.username || "")}" autocomplete="off" required /></div>
            <div class="form-group"><label for="user-password">${editing ? "New password" : "Temporary password"}</label><input class="field" id="user-password" name="password" type="password" minlength="6" autocomplete="new-password" ${editing ? 'placeholder="Leave blank to keep the current password"' : "required"} /></div>
            ${
              isSelf
                ? `
                  <div class="form-group full">
                    <label>Role</label>
                    <input type="hidden" name="role" value="${escapeHtml(user.role)}" />
                    <div class="field readonly-field">${escapeHtml(user.role)}</div>
                    <span class="help-text">Your own role is protected to prevent account lockout.</span>
                  </div>
                `
                : `<div class="form-group full"><label for="user-role">Role</label><select class="field" id="user-role" name="role">${roleOptions(user?.role || "Warehouse")}</select></div>`
            }
          </div>
          <div class="form-note">${icon("info", "icon-sm")}<span>${editing ? "Leave the password blank to keep it unchanged. Entering a password securely resets it." : "The user can sign in immediately after the account is created."} Passwords are hashed and cannot be viewed after saving.</span></div>
        </div>
      </form>
    `,
    `<button class="button" data-close>Cancel</button><button class="button primary" type="submit" form="user-form">${editing ? "Save account" : "Create login"}</button>`,
  );
}

function deleteUserModal() {
  const user = selectedUser();
  if (!user) return "";
  return modalShell(
    "Permanently delete user",
    `
      <form id="delete-user-form">
        <div class="modal-body">
          <div class="delete-warning">
            ${icon("alert", "icon-lg")}
            <div>
              <strong>Delete ${escapeHtml(user.name)}?</strong>
              <p>This removes the login permanently. Existing inventory and audit-log entries will remain under the user’s recorded name.</p>
            </div>
          </div>
        </div>
      </form>
    `,
    `<button class="button" data-close>Cancel</button><button class="button danger" type="submit" form="delete-user-form">${icon("trash", "icon-sm")} Permanently delete</button>`,
  );
}

function helpModal() {
  return modalShell(
    "How Stockline works",
    `
      <div class="modal-body">
        <ul class="overview-list">
          <li class="overview-row"><span><strong>Dispatch stock</strong><span>Subtract material and record the destination and user.</span></span></li>
          <li class="overview-row"><span><strong>Add to an existing line</strong><span>Use the box-plus action to receive newly ordered stock.</span></span></li>
          <li class="overview-row"><span><strong>Set reorder levels</strong><span>Edit an item and set its minimum quantity.</span></span></li>
          <li class="overview-row"><span><strong>Review changes</strong><span>The Dispatch Log records every inventory movement and edit.</span></span></li>
        </ul>
      </div>
    `,
    `<button class="button primary" data-close>Got it</button>`,
  );
}

function openModal(modal, id = null) {
  const permissionByModal = {
    dispatch: "dispatchInventory",
    restock: "dispatchInventory",
    add: "manageInventory",
    edit: "manageInventory",
    history: "viewLogs",
    user: "manageUsers",
    editUser: "manageUsers",
    deleteUser: "manageUsers",
  };
  const requiredPermission = permissionByModal[modal];
  if (requiredPermission && !can(requiredPermission)) {
    toast("Access denied", "Your current role does not allow that action.", "error");
    return;
  }
  if (modal === "dispatch") ui.dispatchSearch = "";
  ui.modal = modal;
  ui.selectedId = id;
  render();
  window.setTimeout(() => {
    document.querySelector(".modal input, .modal select, .modal button")?.focus();
  });
}

function closeModal() {
  ui.modal = null;
  ui.selectedId = null;
  ui.dispatchSearch = "";
  render();
}

function bindShell() {
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.page = button.dataset.page;
      ui.mobileMenu = false;
      render();
    });
  });

  document.querySelector("#mobile-menu")?.addEventListener("click", () => {
    ui.mobileMenu = !ui.mobileMenu;
    render();
  });

  document.querySelector("#signout")?.addEventListener("click", async () => {
    try {
      await apiRequest("/api/logout", { method: "POST" });
    } finally {
      currentUserId = null;
      state = {
        inventory: [],
        users: [],
        roles: structuredClone(DEFAULT_ROLES),
        logs: [],
      };
      render();
    }
  });

  document.querySelector("#notifications")?.addEventListener("click", () => {
    const lowCount = state.inventory.filter(isLow).length;
    if (lowCount) openModal("purchase");
    else toast("Stock is healthy", "No inventory lines are at or below minimum.");
  });

  document.querySelector("#help")?.addEventListener("click", () => openModal("help"));

  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.open));
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () =>
      openModal(button.dataset.action, button.dataset.id),
    );
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  document.querySelector("#modal-backdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "modal-backdrop") closeModal();
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && ui.modal) closeModal();
    },
    { once: true },
  );

  bindInventoryControls();
  bindForms();
  bindLogControls();
  bindTeamControls();
  bindDownloads();
}

function bindInventoryControls() {
  const search = document.querySelector("#inventory-search");
  search?.addEventListener("input", (event) => {
    ui.search = event.target.value;
    ui.inventoryPage = 1;
    const cursor = event.target.selectionStart;
    render();
    const next = document.querySelector("#inventory-search");
    next?.focus();
    next?.setSelectionRange(cursor, cursor);
  });

  document.querySelector("#division-filter")?.addEventListener("change", (event) => {
    ui.division = event.target.value;
    ui.inventoryPage = 1;
    render();
  });

  document.querySelector("#stock-filter")?.addEventListener("change", (event) => {
    ui.stock = event.target.value;
    ui.inventoryPage = 1;
    render();
  });

  document.querySelector("#lifecycle-filter")?.addEventListener("change", (event) => {
    ui.lifecycle = event.target.value;
    ui.inventoryPage = 1;
    render();
  });

  document.querySelector("#inventory-prev")?.addEventListener("click", () => {
    ui.inventoryPage = Math.max(1, ui.inventoryPage - 1);
    render();
  });

  document.querySelector("#inventory-next")?.addEventListener("click", () => {
    ui.inventoryPage += 1;
    render();
  });

  document.querySelector("#inventory-page-size")?.addEventListener("change", (event) => {
    ui.rowsPerPage = Number(event.target.value);
    ui.inventoryPage = 1;
    render();
  });

  document.querySelector("#dispatch-item-search")?.addEventListener("input", (event) => {
    ui.dispatchSearch = event.target.value;
    ui.selectedId = null;
    const cursor = event.target.selectionStart;
    render();
    const next = document.querySelector("#dispatch-item-search");
    next?.focus();
    next?.setSelectionRange(cursor, cursor);
  });

  document.querySelector("#dispatch-item")?.addEventListener("change", (event) => {
    ui.selectedId = event.target.value;
    render();
  });

  document.querySelector("#restock-item")?.addEventListener("change", (event) => {
    ui.selectedId = event.target.value;
  });
}

function bindForms() {
  document.querySelector("#dispatch-form")?.addEventListener("submit", handleDispatch);
  document.querySelector("#restock-form")?.addEventListener("submit", handleRestock);
  document.querySelector("#inventory-form")?.addEventListener("submit", handleInventory);
  document.querySelector("#user-form")?.addEventListener("submit", handleUser);
  document
    .querySelector("#delete-user-form")
    ?.addEventListener("submit", handleDeleteUser);
}

function mutationError(title, error) {
  if (error.status === 401) {
    currentUserId = null;
    render();
  }
  toast(title, error.message, "error");
}

function dismissModal() {
  ui.modal = null;
  ui.selectedId = null;
  ui.dispatchSearch = "";
}

async function handleDispatch(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const item = state.inventory.find((entry) => entry.id === data.get("itemId"));
  const quantity = Number(data.get("quantity"));
  if (
    !item ||
    item.status === "Archived" ||
    quantity <= 0 ||
    quantity > available(item)
  ) {
    toast("Dispatch not saved", "Quantity must be within the available amount.", "error");
    return;
  }

  try {
    await apiRequest(`/api/inventory/${item.id}/dispatch`, {
      method: "POST",
      body: {
        quantity,
        destination: String(data.get("destination")).trim(),
        notes: String(data.get("notes")).trim(),
      },
    });
    dismissModal();
    await refreshState();
    toast("Items dispatched", `${quantity} ${item.name} removed from on-hand stock.`);
  } catch (error) {
    mutationError("Dispatch not saved", error);
  }
}

async function handleRestock(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const item = state.inventory.find((entry) => entry.id === data.get("itemId"));
  const quantity = Number(data.get("quantity"));
  if (!item || item.status !== "Active" || quantity <= 0) {
    toast(
      "Inventory not added",
      "Only Active items can receive new inventory.",
      "error",
    );
    return;
  }

  try {
    await apiRequest(`/api/inventory/${item.id}/restock`, {
      method: "POST",
      body: {
        quantity,
        reference: String(data.get("reference")).trim(),
        notes: String(data.get("notes")).trim(),
      },
    });
    dismissModal();
    await refreshState();
    toast("Inventory added", `${quantity} added to ${item.name}.`);
  } catch (error) {
    mutationError("Inventory not added", error);
  }
}

async function handleInventory(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const values = {
    name: String(data.get("name")).trim(),
    description: String(data.get("description")).trim(),
    idNumber: String(data.get("idNumber")).trim(),
    division: normalizeDivision(String(data.get("division")).trim()),
    notes: String(data.get("notes")).trim(),
    status: ITEM_STATUSES.includes(String(data.get("status")))
      ? String(data.get("status"))
      : "Active",
    quantity: Number(data.get("quantity")),
    reserved: Number(data.get("reserved")),
    minimum: Number(data.get("minimum")),
  };

  if (values.reserved > values.quantity) {
    toast("Changes not saved", "Reserved quantity cannot exceed on-hand quantity.", "error");
    return;
  }

  if (values.status === "Archived" && (values.quantity > 0 || values.reserved > 0)) {
    toast(
      "Item not archived",
      "Dispatch or clear all on-hand and reserved stock before archiving.",
      "error",
    );
    return;
  }

  try {
    if (ui.modal === "edit") {
      const item = selectedItem();
      await apiRequest(`/api/inventory/${item.id}`, {
        method: "PUT",
        body: values,
      });
      dismissModal();
      await refreshState();
      toast("Inventory updated", `${values.name} was saved.`);
      return;
    }

    await apiRequest("/api/inventory", {
      method: "POST",
      body: values,
    });
    dismissModal();
    await refreshState();
    toast("Inventory created", `${values.name} is ready to track.`);
  } catch (error) {
    mutationError("Changes not saved", error);
  }
}

async function handleUser(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const username = String(data.get("username")).trim().toLowerCase();
  const editing = ui.modal === "editUser";
  const existingUser = editing ? selectedUser() : null;
  const name = String(data.get("name")).trim();
  const password = String(data.get("password"));
  const requestedRole = ROLE_NAMES.includes(String(data.get("role")))
    ? String(data.get("role"))
    : "Viewer";

  try {
    if (editing) {
      if (!existingUser) return;
      await apiRequest(`/api/users/${existingUser.id}`, {
        method: "PUT",
        body: {
          name,
          username,
          password,
          role: requestedRole,
        },
      });
      dismissModal();
      await refreshState();
      toast("Account updated", `${name}'s login was saved.`);
      return;
    }

    await apiRequest("/api/users", {
      method: "POST",
      body: {
        name,
        username,
        password,
        role: requestedRole,
      },
    });
    dismissModal();
    await refreshState();
    toast("Login created", `${name} can now sign in.`);
  } catch (error) {
    mutationError("Account not saved", error);
  }
}

async function handleDeleteUser(event) {
  event.preventDefault();
  const user = selectedUser();
  if (!user) return;
  try {
    await apiRequest(`/api/users/${user.id}`, { method: "DELETE" });
    dismissModal();
    await refreshState();
    toast("User deleted", `${user.name}'s login was permanently removed.`);
  } catch (error) {
    mutationError("User not deleted", error);
  }
}

function bindLogControls() {
  const search = document.querySelector("#log-search");
  search?.addEventListener("input", (event) => {
    ui.logSearch = event.target.value;
    const cursor = event.target.selectionStart;
    render();
    const next = document.querySelector("#log-search");
    next?.focus();
    next?.setSelectionRange(cursor, cursor);
  });

  document.querySelector("#log-user-filter")?.addEventListener("change", (event) => {
    ui.logUser = event.target.value;
    render();
  });

  document.querySelector("#log-action-filter")?.addEventListener("change", (event) => {
    ui.logAction = event.target.value;
    render();
  });

  document.querySelector("#log-sort")?.addEventListener("change", (event) => {
    ui.logSort = event.target.value;
    render();
  });
}

function bindTeamControls() {
  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () =>
      openModal("editUser", button.dataset.editUser),
    );
  });

  document.querySelectorAll("[data-user-role]").forEach((select) => {
    select.addEventListener("change", async () => {
      const user = state.users.find((entry) => entry.id === select.dataset.userRole);
      const nextRole = select.value;
      if (
        !user ||
        user.archived ||
        !ROLE_NAMES.includes(nextRole) ||
        user.id === currentUserId
      ) {
        return;
      }
      try {
        await apiRequest(`/api/users/${user.id}`, {
          method: "PUT",
          body: {
            name: user.name,
            username: user.username,
            password: "",
            role: nextRole,
          },
        });
        await refreshState();
        toast("User role updated", `${user.name} is now assigned to ${nextRole}.`);
      } catch (error) {
        await refreshState().catch(() => {});
        mutationError("Role not changed", error);
      }
    });
  });

  document.querySelectorAll("[data-role][data-permission]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const role = checkbox.dataset.role;
      const permission = checkbox.dataset.permission;
      if (
        !ROLE_NAMES.includes(role) ||
        !PERMISSIONS.some(([key]) => key === permission) ||
        (role === "Administrator" && permission === "manageUsers")
      ) {
        return;
      }
      const permissions = {
        ...state.roles[role],
        [permission]: checkbox.checked,
      };
      const label = PERMISSIONS.find(([key]) => key === permission)?.[1] || permission;
      try {
        await apiRequest(`/api/roles/${role}`, {
          method: "PUT",
          body: permissions,
        });
        await refreshState();
        toast(
          "Role permissions updated",
          `${label} was ${checkbox.checked ? "enabled" : "disabled"} for ${role}.`,
        );
      } catch (error) {
        await refreshState().catch(() => {});
        mutationError("Role permissions not saved", error);
      }
    });
  });

  document.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const user = state.users.find((entry) => entry.id === button.dataset.toggleUser);
      if (!user || user.archived || user.id === currentUserId) return;
      const action = user.active ? "deactivate" : "activate";
      try {
        await apiRequest(`/api/users/${user.id}/status`, {
          method: "POST",
          body: { action },
        });
        await refreshState();
        toast(
          action === "activate" ? "Login activated" : "Login deactivated",
          `${user.name}'s access is now ${action === "activate" ? "active" : "inactive"}.`,
        );
      } catch (error) {
        mutationError("Login status not changed", error);
      }
    });
  });

  document.querySelectorAll("[data-archive-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const user = state.users.find(
        (entry) => entry.id === button.dataset.archiveUser,
      );
      if (!user || user.id === currentUserId || user.archived) return;
      try {
        await apiRequest(`/api/users/${user.id}/status`, {
          method: "POST",
          body: { action: "archive" },
        });
        await refreshState();
        toast(
          "User archived",
          `${user.name} can no longer sign in. Their history was preserved.`,
        );
      } catch (error) {
        mutationError("User not archived", error);
      }
    });
  });

  document.querySelectorAll("[data-restore-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const user = state.users.find(
        (entry) => entry.id === button.dataset.restoreUser,
      );
      if (!user || !user.archived) return;
      try {
        await apiRequest(`/api/users/${user.id}/status`, {
          method: "POST",
          body: { action: "restore" },
        });
        await refreshState();
        toast("User restored", `${user.name} can sign in again.`);
      } catch (error) {
        mutationError("User not restored", error);
      }
    });
  });

  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () =>
      openModal("deleteUser", button.dataset.deleteUser),
    );
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function bindDownloads() {
  document.querySelector("#export-log")?.addEventListener("click", () => {
    const logs = visibleLogs();
    downloadCsv("stockline-audit-log.csv", [
      ["Timestamp", "User", "Action", "Item", "Quantity", "Details"],
      ...logs.map((entry) => [
        entry.timestamp,
        entry.user,
        entry.action,
        entry.item,
        entry.quantity ?? "",
        entry.details,
      ]),
    ]);
    toast("Log exported", `${logs.length} visible log entries were downloaded.`);
  });

  document.querySelector("#download-purchase")?.addEventListener("click", () => {
    const quantities = new Map(
      [...document.querySelectorAll(".purchase-qty")].map((input) => [
        input.dataset.item,
        input.value,
      ]),
    );
    const lowItems = state.inventory.filter(isLow);
    downloadCsv("stockline-purchase-list.csv", [
      ["Name", "ID Number", "Division", "Notes", "Available", "Minimum", "Order Quantity"],
      ...lowItems.map((item) => [
        item.name,
        item.idNumber,
        item.division,
        item.notes,
        available(item),
        item.minimum,
        quantities.get(item.id),
      ]),
    ]);
    closeModal();
    toast("Purchase list ready", "The reorder CSV was downloaded.");
  });
}

bootstrap();
