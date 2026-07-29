/**
 * Shared markup renderers. All return HTML strings for the caller to insert
 * via innerHTML; the caller is responsible for wiring up event listeners
 * afterward (e.g. on data-action attributes).
 *
 * Nav item list is derived from frontend/FRONTEND_SCREENS.md §3 (Screens by
 * Role) — every href below maps to a real, planned screen, nothing invented.
 */

const SIDEBAR_NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", href: "/html/app/dashboard.html", roles: ["employee", "manager", "hr_admin", "super_admin"] },
  { id: "my-profile", label: "My Profile", href: "/html/app/my-profile.html", roles: ["employee", "manager", "hr_admin", "super_admin"] },
  { id: "my-leave-requests", label: "My Leave Requests", href: "/html/app/my-leave-requests.html", roles: ["employee", "manager", "hr_admin", "super_admin"] },
  { id: "my-payslips", label: "My Payslips", href: "/html/app/my-payslips.html", roles: ["employee", "manager", "hr_admin", "super_admin"] },
  { id: "leave-policy", label: "Leave Policy", href: "/html/app/leave-policy.html", roles: ["employee", "manager", "hr_admin", "super_admin"] },
  { id: "team-directory", label: "Team Directory", href: "/html/app/team-directory.html", roles: ["employee", "manager", "hr_admin", "super_admin"] },
  { id: "my-team-roster", label: "My Team Roster", href: "/html/app/my-team-roster.html", roles: ["manager"] },
  { id: "team-leave-approvals", label: "Team Leave Approvals", href: "/html/app/team-leave-approvals.html", roles: ["manager"] },
  { id: "user-accounts", label: "User Accounts", href: "/html/app/user-accounts.html", roles: ["hr_admin", "super_admin"] },
  { id: "all-employees", label: "All Employees", href: "/html/app/all-employees.html", roles: ["hr_admin", "super_admin"] },
  { id: "teams", label: "Teams", href: "/html/app/teams.html", roles: ["hr_admin", "super_admin"] },
  { id: "leave-balances-admin", label: "Leave Balances", href: "/html/app/leave-balances-admin.html", roles: ["hr_admin", "super_admin"] },
  { id: "all-leave-requests", label: "All Leave Requests", href: "/html/app/all-leave-requests.html", roles: ["hr_admin", "super_admin"] },
  { id: "payroll-runs", label: "Payroll Runs", href: "/html/app/payroll-runs.html", roles: ["hr_admin", "super_admin"] },
  { id: "all-payslips", label: "All Payslips", href: "/html/app/all-payslips.html", roles: ["hr_admin", "super_admin"] },
];

const BADGE_STATUS_CLASSES = {
  pending: "badge-pending",
  approved: "badge-approved",
  rejected: "badge-rejected",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

/**
 * @param {string|string[]} role - one or more of the assigned role names
 * @param {string} activeItem - id of the currently active nav item
 */
function renderSidebar(role, activeItem) {
  const roles = Array.isArray(role) ? role : [role];

  const items = SIDEBAR_NAV_ITEMS.filter((item) =>
    item.roles.some((allowed) => roles.includes(allowed))
  )
    .map((item) => {
      const activeClass = item.id === activeItem ? " active" : "";
      return `<a class="sidebar-nav-item${activeClass}" href="${item.href}">${escapeHtml(item.label)}</a>`;
    })
    .join("");

  return `
    <nav class="sidebar">
      <div class="sidebar-brand">Vunoh HR</div>
      ${items}
      <a class="sidebar-nav-item" href="#" data-action="logout">Log out</a>
    </nav>
  `;
}

/**
 * @param {string} title
 * @param {{label: string, id?: string, variant?: string}} [actionButton]
 */
function renderTopbar(title, actionButton) {
  const button = actionButton
    ? `<button class="btn btn-${actionButton.variant || "primary"}" id="${actionButton.id || ""}">${escapeHtml(actionButton.label)}</button>`
    : "";

  return `
    <header class="topbar">
      <h1 class="topbar-title">${escapeHtml(title)}</h1>
      ${button}
    </header>
  `;
}

/** @param {string} status - "pending" | "approved" | "rejected" | anything else (renders neutral) */
function renderBadge(status) {
  const className = BADGE_STATUS_CLASSES[status] || "badge-neutral";
  return `<span class="badge ${className}">${escapeHtml(status)}</span>`;
}

/**
 * @param {string[]} headers
 * @param {string[][]} rows - each cell is an HTML string (already escaped by the caller if needed)
 */
function renderTable(headers, rows) {
  const head = headers.map((header) => `<th class="table-head">${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr class="table-row">${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");

  return `
    <table class="table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}
