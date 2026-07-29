# Vunoh HR Payroll — Frontend Screen Plan

This document is a discovery/planning artifact for building a plain HTML/CSS/JS frontend against the existing backend (`backend/v1`, Express 5 + TypeScript + Knex/PostgreSQL, JWT auth). It contains **no frontend code** — it's meant to be handed to a design/build agent as the source of truth for what screens exist, what they call, and what's still missing on the backend.

Items marked **(Planned)** are product-confirmed future work: the UI should render the control (visibly, not hidden) but disabled/labeled as coming soon, since no backend endpoint exists for it yet.

Source: full scan of `backend/v1/routers/*.ts`, `backend/v1/middlewares/{token,authorize}.ts`, `backend/v1/migrations/*.js`, `backend/v1/utils/validation.ts`, `backend/v1/types.ts`.

## Contents

1. [API Endpoint Inventory](#1-api-endpoint-inventory)
2. [Roles Overview](#2-roles-overview)
3. [Screens by Role](#3-screens-by-role)
4. [Navigation Map & User Flows](#4-navigation-map--user-flows)
5. [UX Constraints & Business Rules](#5-ux-constraints--business-rules)
6. [Gaps and Planned Enhancements](#6-gaps-and-planned-enhancements)

---

## 1. API Endpoint Inventory

All routes are mounted under `/v1`. Request pipeline for every `/v1/*` route: `authenticateToken()` (verifies `Authorization: Bearer <JWT>`, checks a blacklist) → `authorize()` (a hardcoded `{method, path, roles[]}` table — routes **not** in this table just need a valid token, any role). A handful of auth routes bypass `authenticateToken()` entirely (marked **public** below). `authLimiter` = 5 requests/15min, applied to signup/login/reset-password/forgot-password/token.

### Health

| Method + Path | Purpose | Auth | Key fields |
|---|---|---|---|
| `GET /health` | Liveness/dependency check | Public, no version gate | response: status of DB/cache deps |

### Auth

| Method + Path | Purpose | Auth | Key request/response fields |
|---|---|---|---|
| `POST /v1/login` | Authenticate, issue tokens | Public, rate-limited | req: `email`, `password`. res: `accessToken`, `refreshToken`. Access token JWT claims: `userId, email, role[], employeeId?` (`employeeId` present only when the account has a linked employee record; `POST /v1/token` re-derives all of these from the DB rather than trusting the refresh token's own minimal claims) |
| `POST /v1/logout` | Invalidate current token pair | Public (takes token from body, not header) | req: `token`, `refreshToken` |
| `POST /v1/token` | Exchange refresh token for new access token | Public, rate-limited | req: `refreshToken`. res: `accessToken` |
| `POST /v1/forgot-password` | Request a password-reset email | Public, rate-limited | req: `email`. res: emails a reset link (⚠ also returns the link in the JSON body, see [section 6](#6-gaps-and-planned-enhancements)) |
| `POST /v1/reset-password/:resetToken` | Set a new password from a reset link | Public (token itself is the credential), rate-limited | req: `password` |
| `POST /v1/signup` | Alias of `POST /v1/users` — register a new account | Public, rate-limited | see Users below |

### Users

Router: `usersRouter.ts`, mounted at `/v1/users` (and again at `/v1/signup`).

| Method + Path | Purpose | Auth | Key fields |
|---|---|---|---|
| `GET /v1/users` | List/search users (dual-mode via query string) | `super_admin`, `hr_admin`, `manager` | query: `type=multiple` (paginated, optional `status` filter) or `type=single&id=<uuid>` / `type=single&email=<email>` (lookup by id or email). res: `id, name, email, status, roles[]` |
| `POST /v1/users` | Register a new account | Public | req: `name`, `email`, `password`. Created with `status: "pending"`, no role assigned |
| `PUT /v1/users/:id` | Edit user — name/email/**status** (this is how signups get approved/rejected) | `super_admin`, `hr_admin` | req: any of `name`, `email`, `status` (`pending\|approved\|rejected`) |
| `DELETE /v1/users` | Delete (soft-delete) a user | `super_admin` | **Currently a stub** — no `:id` param, just returns a placeholder string and performs no DB write. **Intended behavior once implemented:** soft-delete — set a `deleted` flag on the user record (mirroring the Employee table's existing `deleted` boolean) rather than a hard delete. See [section 6.1](#6-gaps-and-planned-enhancements). |
| *(Planned)* `POST /v1/users/:id/activate` / `.../deactivate` | Suspend/restore a user's access, independent of approval `status` or soft-delete | `super_admin`, `hr_admin` | **No endpoint exists yet** — mirrors the Employee `is_active` activate/deactivate pattern. See [section 6.1](#6-gaps-and-planned-enhancements). |
| `POST /v1/users/:userId/role` | Assign a role (optionally team-scoped) | `super_admin`, `hr_admin` | req: `role` (`super_admin\|hr_admin\|manager\|employee`), `teamId?` |
| `POST /v1/users/:userId/role/:roleId` | Revoke a role assignment | `super_admin`, `hr_admin` | path params only |

### Teams

Router: `teamsRouter.ts`, mounted at `/v1/teams`.

| Method + Path | Purpose | Auth | Key fields |
|---|---|---|---|
| `GET /v1/teams` | List/search teams, paginated | Any authenticated role | query: `id?, name?, page?, limit?` |
| `GET /v1/teams/:id` | Fetch one team | Any authenticated role | res: `id, name` |
| `POST /v1/teams` | Create a team | `super_admin`, `hr_admin` | req: `name` (1–100 chars, unique) |
| `PATCH /v1/teams/:id` | Rename a team | `super_admin`, `hr_admin` | req: `name` |
| `DELETE /v1/teams/:id` | Delete a team | `super_admin`, `hr_admin` | **409 if employees are still assigned to it** (FK restrict) |

### Employees

Router: `employeesRouter.ts`, mounted at `/v1/employees`. Responses are joined to `users`, so every employee record includes `name`/`email` alongside the HR fields. Responses are sanitized per-viewer: `salary`, `resume`, `national_id` are stripped unless the caller is `super_admin`/`hr_admin` or viewing their own record (**note: `manager` is not in this allowlist** — a manager viewing a direct report does not see salary/resume/national_id either).

| Method + Path | Purpose | Auth | Key fields |
|---|---|---|---|
| `GET /v1/employees` | List/filter employees | `super_admin`, `hr_admin`, `manager` (unrestricted), `employee` (auto-scoped to their own `team_id`; any `team` query param they send is overridden server-side; 403 if the caller has no linked employee record) | query: `page, limit, team, manager, employmentType, isActive, search`. res per employee adds `name, email` (joined from `users`) |
| `GET /v1/employees/:employeeId` | Fetch one employee | `super_admin`, `hr_admin`, `manager`, `employee` (self/manager/privileged only, else 403 in-handler) | res: `name, email, jobTitle, teamId, managerId, startDate, salary*, employmentType, resume*, phone, profilePicture, nationalId*, isActive` (`*` = sanitized) |
| `POST /v1/employees` | Create an employee HR record | **Product decision: `super_admin` and `hr_admin` only.** ⚠ Backend's current `authorize()` table is broader — it technically permits `manager`/`employee` too (self-record only for non-privileged). The frontend must restrict the "Create Employee" screen to admins regardless, and the backend `authorize()` table should be tightened to match — see [section 6.1](#6-gaps-and-planned-enhancements). | req: `userId, jobTitle, teamId, managerId?, startDate, salary, employmentType, phone?, profilePicture?, nationalId?` |
| `PUT /v1/employees/:employeeId` | Edit an employee | Self or privileged | Self: restricted to `resume, phone, profilePicture` only. Privileged: full schema |
| `POST /v1/employees/:employeeId/activate` | Reactivate an employee | `super_admin`, `hr_admin` | sets `is_active = true` |
| `POST /v1/employees/:employeeId/deactivate` | Deactivate an employee | `super_admin`, `hr_admin` | sets `is_active = false`, records `updatedBy` |
| `DELETE /v1/employees/:employeeId` | Soft-delete an employee | `super_admin`, `hr_admin` | sets `deleted = true`, records `updatedBy`; record then excluded from all reads/filters and payroll runs. No corresponding "undelete" endpoint exists. |

`resume` and `profilePicture` are plain text/URL fields — there is no file-upload endpoint behind them yet. See [section 6.1](#6-gaps-and-planned-enhancements).

### Leave Types (reference data)

Router: `leaveTypesRouter.ts`, mounted at `/v1/leave-types`. **Read-only — no create/update/delete endpoints exist.**

| Method + Path | Purpose | Auth | Key fields |
|---|---|---|---|
| `GET /v1/leave-types` | List leave types | Any authenticated role | optional `code` filter. res per type: `code (annual\|sick\|unpaid), name, defaultAllowanceDays, prorateOnJoin, noticeDaysRequired, requiresCover` |
| `GET /v1/leave-types/:id` | Fetch one leave type | Any authenticated role | same fields |

### Leave Requests

Router: `leaveRequestsRouter.ts`, mounted at `/v1/leave-requests`. List/detail queries are scoped server-side: privileged users see all; a `manager` sees their own + their direct reports'; an `employee` sees only their own.

| Method + Path | Purpose | Auth | Key fields |
|---|---|---|---|
| `GET /v1/leave-requests` | List leave requests (scoped) | Any authenticated role, scope applied server-side | query: filters (status, employeeId for privileged, etc.) |
| `GET /v1/leave-requests/:id` | Fetch one request | Self / manager-of-employee / privileged | if pending and viewer is manager/privileged, also includes a team-coverage check |
| `POST /v1/leave-requests` | Submit a leave request | Any authenticated role (self, or `employeeId` for privileged) | req: `leaveTypeId, startDate, endDate, coverEmployeeId?`. Server enforces notice period, cover-employee requirement, balance availability, and auto-resolves `approverId` (employee's manager → team's manager-role holder → hr_admin). res adds: `workingDaysCount` (server-computed, excludes weekends + public holidays), `status: "pending"` |
| `PUT /v1/leave-requests/:id` | Edit a request | Self or privileged, **pending only** | req: any of `leaveTypeId, startDate, endDate, coverEmployeeId` |
| `POST /v1/leave-requests/:id/approve` | Approve a request | `super_admin`, `hr_admin`, `manager`-of-employee | pending only; deducts `workingDaysCount` from the matching leave balance |
| `POST /v1/leave-requests/:id/reject` | Reject a request | `super_admin`, `hr_admin`, `manager`-of-employee | pending only |
| `POST /v1/leave-requests/:id/cancel` | Cancel a request | Self or privileged, **pending only** | — |

### Leave Balances

Router: `leaveBalancesRouter.ts`, mounted at `/v1/leave-balances`. **No update endpoint** — balances are only created (allocation) or implicitly decremented by approving a leave request.

| Method + Path | Purpose | Auth | Key fields |
|---|---|---|---|
| `GET /v1/leave-balances` | List balances | Any authenticated role (non-privileged forced to their own `employeeId`, param ignored otherwise) | query: `employeeId?, leaveTypeId?, year?` |
| `GET /v1/leave-balances/:id` | Fetch one balance | Self or privileged | res: `year, allocated, used, remaining` |
| `POST /v1/leave-balances` | Allocate a balance | `super_admin`, `hr_admin` | req: `employeeId, leaveTypeId, year, allocated` (year 2000–2100, allocated ≥ 0) |

### Payslips

Router: `payslipsRouter.ts`, mounted at `/v1/payslips`. There's no separate `GET /:id` route, but `GET /v1/payslips` accepts a `payslipId` filter — passing it alone returns exactly one payslip, which is sufficient to fetch/deep-link a specific payslip's full detail. **PDF/document download is planned, not yet implemented** — payslips are JSON rows only today.

| Method + Path | Purpose | Auth | Key fields |
|---|---|---|---|
| `GET /v1/payslips` | List payslips, or fetch one via `payslipId` | Any authenticated role (non-privileged forced to their own employee) | query: `employeeId? (privileged only), periodMonth?, periodYear?, payslipId?`. res per row: `periodMonth, periodYear, grossPay, unpaidLeaveDays, nssf, shif, ahl, paye, netPay, version, generatedAt, generatedBy` |
| `GET /v1/payslips/latest` | Fetch the latest payslip for a period | Any authenticated role (privileged must pass `employeeId`, others get their own) | query: `periodMonth, periodYear, employeeId?` |
| *(Planned)* payslip PDF/download | Generate a downloadable payslip document | — | **No endpoint exists yet.** See [section 6.1](#6-gaps-and-planned-enhancements). |

### Payroll Runs

Router: `payrollRunsRouter.ts`, mounted at `/v1/payroll-runs`. Stateless batch action — no persisted "run" record or status workflow; it's fire-and-generate.

| Method + Path | Purpose | Auth | Key fields |
|---|---|---|---|
| `POST /v1/payroll-runs` | Generate payslips for every active employee for a period | `super_admin`, `hr_admin` | req: `periodMonth (1–12), periodYear (2000–2100)`. res: array of generated payslips + `errors[]` per employee that failed. **Re-running the same period creates a new `version` rather than erroring or overwriting** |

---

## 2. Roles Overview

Roles come from the `user_roles.role` enum — there are exactly four, and a user can hold more than one (optionally team-scoped):

| Role | Summary | Endpoint groups it can reach beyond self-service |
|---|---|---|
| `employee` | Base authenticated role. Self-service (own profile, own leave, own payslips) plus a read-only view of teammates. | `GET /employees` (list, auto-scoped to their own team) |
| `manager` | Everything `employee` has, plus oversight of direct reports (via `employees.manager_id`). | `GET /employees` (list), leave approve/reject for reports, `GET /employees/:id` for reports |
| `hr_admin` | Full HR & payroll administration. | Users, Teams, Employees (create/edit — see [section 6.1](#6-gaps-and-planned-enhancements) on creation being admin-only), Leave Balances (allocate), Payroll Runs, all Leave Requests, all Payslips |
| `super_admin` | Identical reach to `hr_admin`, plus the only role permitted to call `DELETE /v1/users`. | Same as `hr_admin` + user deletion |

Because `hr_admin` and `super_admin` reach the same screens, this document groups them as **"HR / Super Admin"** and calls out the one differing action (user deletion) inline.

There's also an implicit **Public** group (unauthenticated) for login/registration/password-reset screens.

---

## 3. Screens by Role

### 3.0 Public (Unauthenticated)

#### Login
- **Purpose:** Authenticate and land the user in the app.
- **Endpoints:** `POST /v1/login` on submit.
- **UI:** email + password fields, submit button, "Forgot password?" and "Register" links.
- **States:** empty (initial form) · loading (submitting) · error (invalid credentials, rate-limited) · success (redirect to role-aware landing screen, store `accessToken`/`refreshToken`).

#### Register / Sign Up
- **Purpose:** Create a new account (status starts `pending`, no role yet).
- **Endpoints:** `POST /v1/users` (aka `/v1/signup`) on submit.
- **UI:** name, email, password (+ confirm) fields, submit, link back to Login.
- **States:** empty · loading · error (email already taken, validation) · success (redirect to a "Registration submitted — pending approval" notice; do not auto-login, since the account has no role/employee record yet).

#### Forgot Password
- **Purpose:** Request a reset email.
- **Endpoints:** `POST /v1/forgot-password` on submit.
- **UI:** email field, submit.
- **States:** empty · loading · error · success ("check your email" message — do **not** surface the reset link the API returns in the response body, see [section 6.2](#6-gaps-and-planned-enhancements)).

#### Reset Password
- **Purpose:** Set a new password from the emailed link's token.
- **Endpoints:** `POST /v1/reset-password/:resetToken` on submit (token comes from the URL).
- **UI:** new password + confirm fields, submit.
- **States:** empty · loading · error (expired/invalid token — 15 min TTL) · success (redirect to Login).

---

### 3.1 Shared (All Authenticated Roles)

#### App Shell / Navigation
- **Purpose:** Persistent layout (header/sidebar) hosting role-aware nav links and a logout action.
- **Endpoints:** none on its own; `POST /v1/logout` on the logout action.
- **UI:** nav menu (items shown/hidden by the roles in the decoded JWT), user menu, logout button.
- **States:** n/a (structural), but should handle "session expired" globally (401/403 from any call → clear tokens, redirect to Login).

#### Dashboard
- **Purpose:** Role-aware landing screen after login. Composed entirely from existing list/filter endpoints — **no dedicated summary/aggregate endpoint is needed or expected**; each panel is just a pre-filtered call to a screen that also exists standalone.
- **Endpoints & panels (each loads independently, on page load):**
  - **Pending Leave Requests** — `GET /v1/leave-requests?status=pending`. Scoping is automatic and identical to the standalone list screens: `employee` gets their own only, `manager` gets their own + direct reports (server-side `scope: "managed"`), `hr_admin`/`super_admin` get all. Shows a compact count + top rows, with "View all" linking to My Leave Requests / Team Leave Approvals / All Leave Requests depending on role.
  - **My Leave Balances** — `GET /v1/leave-balances` (own, current year), for every role including admins — balances are always personal; there's no org-wide balance summary endpoint, so admins see their own balance here, not a company-wide rollup.
  - **Who's Out** — `GET /v1/leave-requests?status=approved`, filtered **client-side** by `startDate`/`endDate` overlapping the selected window (default: today; optionally a date-range picker for "this week"/"next 2 weeks"). There's no server-side date-range filter on this endpoint, so the client filters the returned (scoped) rows. **Manager and HR/Super Admin only** — the API scopes a plain `employee`'s leave-request list to `type: "own"` with no team-wide read, so a plain employee cannot see teammates' approved leave through this endpoint. For the `employee` role, this panel is replaced with **"My Upcoming Leave"** (their own future approved requests) instead.
  - **Payslip for a Period** — a month/year picker (default: current period) driving `GET /v1/payslips?periodMonth=&periodYear=`, scoped to the viewer's own payslip (privileged roles see their own here too, not an org-wide view — use the "View all payslips" link into the All Payslips screen for that).
- **UI:** four panel cards as described above, each with its own filter control (status is fixed per panel, period/date pickers where noted) and a "View all →" link into the corresponding full screen.
- **States:** each panel independently: loading · error · empty (e.g. "no pending requests," "no one out this week," "no payslip for this period yet") · success.

#### My Profile
- **Purpose:** View your own employee record.
- **Endpoints:** `GET /v1/employees/:employeeId` on load, using the `employeeId` claim decoded from the access token (present when the account has a linked employee record).
- **UI:** read-only profile card: name, email, job title, team, manager, start date, employment type, phone, profile picture; salary/resume/national ID shown only if the viewer is privileged (they will be for their own record).
- **States:** loading · error · **empty ("no employee record yet" — reachable if an approved user hasn't had an Employee record created for them yet)** · success.

#### Edit My Profile
- **Purpose:** Update your own limited self-service fields.
- **Endpoints:** `PUT /v1/employees/:employeeId` on submit.
- **UI:** form with only `resume`, `phone`, `profilePicture` fields (matches the server's `selfUpdateEmployeeSchema` — do not render salary/job title/team as editable here). `resume`/`profilePicture` are plain text/URL inputs today; render a file-picker/upload control alongside them **(Planned — disabled, labeled "Coming soon")** rather than omitting the concept, since real file upload isn't backed by an endpoint yet (see [section 6.1](#6-gaps-and-planned-enhancements)).
- **States:** loading · error (validation) · success (toast + return to My Profile).

#### Leave Policy Reference
- **Purpose:** Show the leave types and their rules so employees understand allowances/notice/cover requirements before requesting.
- **Endpoints:** `GET /v1/leave-types` on load.
- **UI:** simple table/cards — type name, default allowance days, notice days required, whether cover is required.
- **States:** loading · error · empty (unlikely, seeded data) · success. Likely also embedded inline inside the New Leave Request form, not just a standalone page.

#### Team Directory
- **Purpose:** Browse the list of teams (read-only for non-admins).
- **Endpoints:** `GET /v1/teams` on load, `GET /v1/teams/:id` on selecting a team (roster shown via `GET /v1/employees?team=:id`).
- **UI:** searchable/paginated list of team names; clicking one shows its roster (names/job titles only, respecting sanitization).
- **States:** loading · error · empty ("no teams yet") · success.

#### My Leave Balances
- **Purpose:** Show current-year allocated/used/remaining days per leave type.
- **Endpoints:** `GET /v1/leave-balances` (own, filterable by year) on load.
- **UI:** one card/row per leave type: allocated, used, remaining; year selector.
- **States:** loading · error · empty ("no balance allocated yet for this year") · success.

---

### 3.2 Employee

#### My Leave Requests (list)
- **Purpose:** See your own leave request history and status.
- **Endpoints:** `GET /v1/leave-requests` (scope=own) on load and on filter change.
- **UI:** table/cards (leave type, dates, working days, status badge), status filter, "New Request" button.
- **States:** loading · error · empty ("no leave requests yet — create one") · success.

#### New Leave Request
- **Purpose:** Submit a leave request.
- **Endpoints:** `GET /v1/leave-types` (populate type dropdown + rules) on load; `GET /v1/leave-balances` (own) on load to show remaining days; `GET /v1/employees` (team roster, to populate the cover-employee picker) on load if the selected type requires cover; `POST /v1/leave-requests` on submit.
- **UI:** leave-type select, date range picker, dynamically-shown cover-employee select (only if `requiresCover`), a computed/preview working-days estimate, remaining-balance indicator, submit button.
- **States:** loading (initial data fetch) · error (validation, server-side rejection — insufficient notice/balance/missing cover) · success (redirect to the created request's detail).

#### Leave Request Detail
- **Purpose:** View a single request; act on it while pending.
- **Endpoints:** `GET /v1/leave-requests/:id` on load; `PUT /v1/leave-requests/:id` on Edit submit (pending only); `POST /v1/leave-requests/:id/cancel` on Cancel (pending only).
- **UI:** full detail (type, dates, working days, status, cover employee, approver, decided-at); Edit and Cancel buttons **shown only while `status === "pending"`**.
- **States:** loading · error (not found / not authorized) · success. This screen is reused for Manager/Admin views — see 3.3/3.4 for the approve/reject variant.

#### My Payslips
- **Purpose:** Browse your own payslip history and view one in detail.
- **Endpoints:** `GET /v1/payslips` (own, filterable by period) on load; row click fetches `GET /v1/payslips?payslipId=:id` for a deep-linkable detail view; `GET /v1/payslips/latest` optionally for a "current period" shortcut.
- **UI:** table of periods (month/year, gross, net, version) with a row click opening a Payslip Detail view (full breakdown: NSSF, SHIF, AHL, PAYE, unpaid-leave-days) fetched by `payslipId`; a "Download PDF" button on the detail view **(Planned — disabled, labeled "Coming soon")**, since no document-generation endpoint exists yet.
- **States:** loading · error · empty ("no payslips yet") · success.

---

### 3.3 Manager

*A manager has every screen in 3.1 and 3.2 for their own profile/leave/payslips, plus:*

#### My Team Roster
- **Purpose:** See direct reports.
- **Endpoints:** `GET /v1/employees?manager=:managerId` on load.
- **UI:** table of direct reports (name, job title, employment type, active status), row click → Team Member Profile.
- **States:** loading · error · empty ("no direct reports") · success.

#### Team Member Profile
- **Purpose:** Read-only view of a direct report's record.
- **Endpoints:** `GET /v1/employees/:employeeId` on load.
- **UI:** same layout as My Profile, but **salary, resume, and national ID are not returned by the API for a manager viewing someone else's record** — omit those fields from this view entirely rather than showing them blank.
- **States:** loading · error (403 if not actually their manager) · success.

#### Team Leave Approvals
- **Purpose:** Review and decide on direct reports' pending leave requests.
- **Endpoints:** `GET /v1/leave-requests` (scope=managed) on load and on filter change; row click opens the shared Leave Request Detail with `POST /v1/leave-requests/:id/approve` / `.../reject` actions instead of Edit/Cancel.
- **UI:** table filtered to pending-by-default, with quick approve/reject actions inline or via the detail screen; detail screen additionally shows the team-coverage check the API returns for pending requests.
- **States:** loading · error · empty ("no pending requests") · success (after decide: remove from pending list / update status badge).

---

### 3.4 HR Admin / Super Admin

*Has every screen above (own profile/leave/payslips) plus full administrative reach. Screens below are identical for `hr_admin` and `super_admin` except where noted.*

#### User Accounts (list)
- **Purpose:** Find and manage user accounts, especially new signups awaiting approval.
- **Endpoints:** `GET /v1/users` (`type: "multiple"`, optional `status` filter) on load and on filter change.
- **UI:** table (name, email, status badge, assigned roles), status filter (`pending/approved/rejected`), search.
- **States:** loading · error · empty · success.

#### User Detail
- **Purpose:** Approve/reject a signup, manage role assignments, manage account access, (super_admin) delete.
- **Endpoints:** `GET /v1/users` (`type: "single"`) on load; `PUT /v1/users/:id` on status change; `POST /v1/users/:userId/role` on assigning a role; `POST /v1/users/:userId/role/:roleId` on revoking a role; `DELETE /v1/users` for super_admin only; `POST /v1/users/:id/activate` / `.../deactivate` **(Planned)**.
- **UI:**
  - status control (approve/reject)
  - roles list with add-role form (role select + optional team select, required when role is `manager`) and per-role revoke button
  - **Activate / Deactivate toggle (Planned — disabled, labeled "Coming soon")**, to suspend/restore account access without a full delete
  - **Delete button (super_admin only)** — label this clearly as a soft-delete ("marks the user as deleted") once implemented; today it calls a stub that does nothing, so keep it disabled/labeled "Coming soon" until the backend implements the `deleted`-flag behavior (see [section 6.1](#6-gaps-and-planned-enhancements))
- **States:** loading · error (duplicate role assignment conflict, 409) · success. After approving a user with no employee record yet, surface a prompt/link to "Create Employee Record" for them.

#### All Employees
- **Purpose:** Browse/search every employee record.
- **Endpoints:** `GET /v1/employees` on load and on filter change.
- **UI:** table (name, job title, team, manager, employment type, active status), filters (team, manager, employment type, active, search), "Create Employee" button, per-row Delete action (see Employee Detail below — same soft-delete semantics, admin only).
- **States:** loading · error · empty · success.

#### Employee Detail (admin view)
- **Purpose:** Full view of an employee, including privileged fields.
- **Endpoints:** `GET /v1/employees/:employeeId` on load; `DELETE /v1/employees/:employeeId` on Delete confirm.
- **UI:** all fields including salary, resume, national ID; Edit / Activate / Deactivate / Delete actions. Delete opens a confirmation modal warning that this is a soft delete (sets `deleted`, not a hard row removal) and is not reversible from the UI — there is no "undelete" endpoint. On success, redirect to All Employees.
- **States:** loading · error · success (delete removes the record from All Employees and any further `GET` returns 404).

#### Create Employee Record
- **Purpose:** Turn an approved user account into an HR employee record (onboarding). **Restricted to `super_admin`/`hr_admin` — this is a firm product rule, not just a UI convenience** (the backend's `authorize()` table is currently broader and should be tightened to match, see [section 6.1](#6-gaps-and-planned-enhancements)).
- **Endpoints:** `GET /v1/users` to pick the target user (if not pre-selected from User Detail); `GET /v1/teams` to populate team select; `GET /v1/employees` to populate manager select; `POST /v1/employees` on submit.
- **UI:** form — user (pre-filled if coming from User Detail), job title, team, manager (optional), start date, salary, employment type, phone (optional); `resume`/`profilePicture` as text/URL inputs with a file-picker/upload control shown **(Planned — disabled, labeled "Coming soon")**.
- **States:** loading · error (validation, duplicate `userId`, invalid team/manager FK) · success (redirect to Employee Detail).

#### Edit Employee (admin)
- **Purpose:** Edit any field on any employee.
- **Endpoints:** `PUT /v1/employees/:employeeId` on submit (full schema, unlike the self-service version).
- **UI:** full form — job title, team, manager, start date, salary, employment type, contact fields; same **(Planned)** upload control treatment as Create Employee Record for `resume`/`profilePicture`.
- **States:** loading · error · success.

#### Teams (list)
- **Purpose:** Browse/manage teams.
- **Endpoints:** `GET /v1/teams` on load; "Create Team" button.
- **UI:** table (name, headcount if derivable from the employees list), search.
- **States:** loading · error · empty · success.

#### Team Detail
- **Purpose:** View a team's roster, rename or delete it.
- **Endpoints:** `GET /v1/teams/:id` on load; `GET /v1/employees?team=:id` for the roster; `PATCH /v1/teams/:id` on rename; `DELETE /v1/teams/:id` on delete.
- **UI:** name (editable), roster table, delete button.
- **States:** loading · error (delete blocked with 409 while employees are assigned — show a friendly inline message, e.g. "Reassign N employees before deleting this team") · success.

#### Create Team
- **Purpose:** Add a new team.
- **Endpoints:** `POST /v1/teams` on submit.
- **UI:** name field.
- **States:** loading · error (duplicate name) · success.

#### Leave Balances Admin
- **Purpose:** View and allocate leave balances for any employee.
- **Endpoints:** `GET /v1/leave-balances` (by employeeId/year) on load; `POST /v1/leave-balances` to allocate.
- **UI:** employee picker, year selector, existing-balances table, "Allocate" form (leave type, year, allocated days). **No edit action exists** — allocation is create-only ([section 6.2](#6-gaps-and-planned-enhancements)).
- **States:** loading · error (duplicate allocation for employee+type+year, 409) · empty · success.

#### All Leave Requests
- **Purpose:** Organization-wide leave oversight.
- **Endpoints:** `GET /v1/leave-requests` (scope=all) on load and on filter change; opens the shared Leave Request Detail (approve/reject available to admins on any request, not just direct reports).
- **UI:** table with filters (status, employee, date range), row click → detail.
- **States:** loading · error · empty · success.

#### Payroll Runs
- **Purpose:** Generate payslips for all active employees for a given period.
- **Endpoints:** `POST /v1/payroll-runs` on submit.
- **UI:** period picker (month 1–12, year 2000–2100), confirm button with a warning modal (re-running an already-processed period creates a new version rather than failing), results table after submit (per-employee success/error).
- **States:** loading (form) · submitting (run in progress) · error (validation) · success (results table, with a link into All Payslips filtered to that period).

#### All Payslips
- **Purpose:** Browse payslips across the organization.
- **Endpoints:** `GET /v1/payslips` (with `employeeId`/period filters) on load and on filter change; row click fetches `GET /v1/payslips?payslipId=:id` for detail.
- **UI:** table (employee, period, gross, net, version, generated by/at), filters (employee, period), row click → Payslip Detail (full breakdown), with a "Download PDF" action **(Planned — disabled, labeled "Coming soon")**.
- **States:** loading · error · empty · success.

---

## 4. Navigation Map & User Flows

**High-level shell:** Login → Dashboard (role-aware landing screen, see 3.1) → persistent sidebar/topbar scoped by the roles decoded from the JWT. The Dashboard is built entirely from existing filtered list calls (pending requests, own balances, who's out, a selectable payslip period) — no aggregate endpoint is required.

```
Login ──┬─→ Dashboard (role-aware) ──→ App Shell (sidebar scoped by role)
        ├─→ Register → "Pending approval" notice ──(HR approves + assigns role, admin side)
        └─→ Forgot Password → (email) → Reset Password → Login
```

**Onboarding flow (cross-role):**
```
Register (POST /users, status=pending, no role)
   → HR: User Accounts → User Detail → approve status (PUT /users/:id)
   → HR: User Detail → assign role (POST /users/:userId/role)
   → HR/Super Admin only: Create Employee Record (POST /employees) for that user
   → user now has full self-service access (My Profile resolves to a real record)
```
Note this is **two separate admin actions** (status approval + role assignment) plus a third (employee record creation, admin-only) — there's no single "onboard this user" endpoint. The UI can chain these as steps in one guided flow even though they're three API calls.

**Employee leave flow:**
```
My Leave Requests (list) → [New Request button] → New Leave Request
   (pick type → rules/balance shown → pick dates → cover employee if required) → submit
   → Leave Request Detail (status: pending)
        → while pending: Edit or Cancel
        → once decided: read-only, shows approver + decided-at
```

**Manager approval flow:**
```
My Team Roster → Team Member Profile (read-only)
Team Leave Approvals (scope=managed, default filter: pending)
   → Leave Request Detail (shows team-coverage check) → Approve / Reject
```

**Admin flows:**
```
All Employees → Employee Detail → Edit / Activate / Deactivate / Delete (soft-delete, no undo)
Teams → Team Detail → Rename / Delete (blocked with 409 if roster non-empty)
Leave Balances Admin → pick employee/year → Allocate
Payroll Runs → pick period → confirm (warn on re-run) → results → All Payslips (filtered)
User Detail → Approve/Reject status → Assign role → Activate/Deactivate (Planned) → Delete (Planned soft-delete)
```

---

## 5. UX Constraints & Business Rules

Constraints the UI must enforce or account for, derived from server-side validation and workflow rules:

- **Leave request lifecycle is one-shot per action:** only `pending` requests can be edited, cancelled, approved, or rejected. Hide Edit/Cancel/Approve/Reject controls once status is `approved`, `rejected`, or `cancelled`.
- **Date ordering:** end date must be ≥ start date — disable invalid end dates in the picker client-side (Joi also enforces this server-side, so treat client validation as UX sugar, not the source of truth).
- **Notice period is leave-type-specific:** each leave type carries its own `noticeDaysRequired` (e.g. annual = 7 days, unpaid = 7 days, sick = 0). The New Leave Request form must fetch the selected type's rules and warn (not silently block) if the chosen start date is inside the notice window — the server is the final authority and will reject non-compliant submissions.
- **Cover employee is conditional:** only show/require the cover-employee picker when the selected leave type's `requiresCover` is `true` (annual and unpaid today; sick does not require cover).
- **Working days are server-computed:** never let the user hand-edit `workingDaysCount` — it's calculated server-side excluding weekends and public holidays. The form may show a client-side estimate/preview, but the authoritative value comes back in the response.
- **Balance-aware submission:** show the employee's current remaining balance for the selected leave type inline in the New Leave Request form so users don't submit requests likely to fail on `insufficient_balance`.
- **Field-level sensitivity:** salary, resume, and national ID are stripped by the API for any non-privileged, non-self viewer (this includes managers viewing reports). Don't render these fields at all in that case — showing an empty/blank field reads as a bug, not a permission boundary.
- **Self-edit is intentionally narrow:** the self-service Edit Profile form must only expose `resume`, `phone`, `profilePicture` — job title, team, manager, salary, and employment type are admin-only fields (`PUT` uses a different, wider schema for privileged callers).
- **Employee creation is admin-only, full stop:** route all employee-record creation through the HR/Super-Admin-only "Create Employee Record" screen. This is a firm product rule (not merely a UI-side safety net) — flag to the backend team that `authorize()` should also be tightened to reject `manager`/`employee` on `POST /v1/employees`.
- **File upload and PDF download are visibly "coming soon," not hidden:** wherever `resume`/`profilePicture` upload or "Download Payslip PDF" would appear, render the control disabled with a "Coming soon" label rather than omitting it — this keeps the UI forward-compatible and sets expectations correctly. Backing endpoints don't exist yet.
- **User soft-delete and activate/deactivate are also "coming soon":** the Delete button on User Detail should be labeled to reflect its intended soft-delete semantics (sets a `deleted` flag, doesn't hard-delete) once live, but disabled today since the current `DELETE /v1/users` route is a non-functional stub. The Activate/Deactivate toggle likewise has no backing endpoint yet — render it disabled/"Coming soon."
- **Payroll re-run warning:** running payroll for a period that's already been processed doesn't fail — it silently creates a new payslip `version` for every employee. The Payroll Runs screen must show a confirmation modal explaining this before submitting, especially if existing payslips are found for that period.
- **Employee deletion is a soft delete, and it's final from the UI's perspective:** `DELETE /v1/employees/:employeeId` sets the `deleted` flag rather than removing the row, but no "undelete"/restore endpoint exists — once deleted, an employee disappears from all lists and detail fetches (404) and cannot be brought back through the API. The confirmation modal on Employee Detail must say this plainly before the user confirms.
- **Team deletion is FK-guarded:** deleting a team with employees still assigned returns 409. Either pre-check the roster count and disable the delete button with an explanation, or catch the 409 and surface a friendly message ("Reassign N employees before deleting this team.").
- **Role assignment needs conditional fields:** when assigning the `manager` role, a `teamId` is meaningful (role assignments are unique per `user + role + team`); for other roles it's typically not needed. Surface the team select conditionally and handle the 409 "duplicate assignment" case gracefully.
- **Don't gate access purely on account status:** the backend's login endpoint does **not** currently check `users.status` before issuing tokens (see [section 6.2](#6-gaps-and-planned-enhancements)), meaning a `pending` or `rejected` user could technically obtain a valid session today. The frontend should not treat "logged in" as proof of "approved" — design the post-login experience defensively (e.g., a logged-in user with no employee record yet should see a clear "your account is pending setup" empty state rather than the app assuming this state is impossible). This is a backend gap, not something the frontend can fully close — flag it to the backend owner.
- **Numeric ranges to enforce client-side (mirroring Joi):** payroll/leave-balance year 2000–2100; payroll month 1–12; leave-balance `allocated` ≥ 0 integer; salary positive with 2-decimal precision.

---

## 6. Gaps and Planned Enhancements

Endpoints that don't map to a screen:
- **`GET /health`** — infra liveness check only, not an application feature; no UI needed.

### 6.1 Planned Enhancements (product-confirmed — build the UI now, disabled/"coming soon")

These are directions confirmed by the product owner. The frontend should render the relevant controls visibly (not omit them), disabled and labeled, so the UI is ready to "light up" once each backend piece ships:

1. **File uploads for `resume`/`profilePicture`.** Currently plain text/URL fields with no multer/S3/presigned-URL route behind them. Show a file-picker/upload control marked "Coming soon" on Edit My Profile, Create Employee Record, and Edit Employee (admin); keep the text/URL field as the working fallback in the meantime.
2. **Payslip PDF/document download.** No document-generation endpoint exists — payslips are JSON rows only. Show a "Download PDF" button marked "Coming soon" on the Payslip Detail view (My Payslips / All Payslips).
3. **User soft-delete.** `DELETE /v1/users` is currently a stub (no `:id` param, returns a placeholder string, no DB write). The intended behavior is a soft-delete that sets a `deleted` flag on the user record, mirroring the Employee table's existing `deleted` boolean. Show the Delete action on User Detail (super_admin only) labeled to reflect soft-delete semantics, disabled until the backend implements it.
4. **User activate/deactivate.** No endpoint currently exists for suspending/restoring a user's access independent of the approval `status` — this mirrors the Employee `is_active` pattern but doesn't exist yet for Users. Show an Activate/Deactivate toggle on User Detail, disabled/"Coming soon."
5. **Employee creation restricted to `super_admin`/`hr_admin` at the API level.** The frontend already gates the "Create Employee Record" screen to admins; the backend's `authorize()` table should be tightened to match (it currently also permits `manager`/`employee` for `POST /v1/employees`, relying only on an in-handler self-record check).

### 6.2 Other Gaps / Open Questions

1. **No update endpoint for leave balances.** Only `POST` (create) exists, plus the implicit deduction that happens when a leave request is approved. HR has no way to correct a mis-allocated balance via the API once it's created.
2. **No leave-types management endpoints.** Create/update/delete for leave types don't exist — they're fixed, seeded data (`annual`, `sick`, `unpaid`). A "Leave Policy Settings" admin screen isn't buildable today; the Leave Policy Reference screen must stay read-only.
3. ~~Employee `deleted` column has no corresponding endpoint.~~ **Resolved** — `DELETE /v1/employees/:employeeId` (`super_admin`/`hr_admin`) now sets `deleted = true`. There's still no "undelete"/restore endpoint, so deletion is final from the UI's perspective (see [section 5](#5-ux-constraints--business-rules)).
9. ~~`GET /v1/employees` never joined `users`, so no employee `name`/`email` was ever returned — screens fell back to a truncated `user_id`.~~ **Resolved** — employee reads (`GET /v1/employees`, `GET /v1/employees/:id`) now join `users` and return `name`/`email` directly.
10. ~~A plain `employee` could not call `GET /v1/employees` at all, so there was no team-directory-style view for non-managers.~~ **Resolved** — `employee` is now allowed, auto-scoped server-side to their own team.
11. ~~`GET /v1/users` read its `type` discriminator (and, for single lookup, `inputEmail`) from `req.body` on a GET request, which browser `fetch` cannot send.~~ **Resolved** — `type`, `id`, and `email` are now read from the query string, and single-user lookup supports `id` in addition to `email`.
4. **No notifications/inbox/activity-feed domain.** Leave approvals/rejections and payroll completion produce no in-app notification of any kind — the only outbound email in the whole system is the password-reset link. Any "notify the employee their leave was approved" UX needs new backend work.
5. **No audit/history-log endpoint.** Employees track `updated_by`, but there's no endpoint to view a record's change history — the UI can show "last updated by X" but not a timeline of changes.
6. **Backend inconsistency — not fixable from the frontend:** the login endpoint doesn't check `users.status` before issuing tokens, so `pending`/`rejected` users can technically authenticate today even though the intent is clearly that `status` gates access. Flagged for the backend owner; frontend should design defensively per the note in [section 5](#5-ux-constraints--business-rules).
7. **`forgot-password` leaks the reset link in its JSON response** (in addition to emailing it) — likely a dev-convenience artifact. The frontend should never read or display this field even though it's present in the response, and the user may want to remove it server-side before going to production.
8. **`backend/v1/routers/signUpRouter.ts` is dead code** (empty file, never mounted) — `/v1/signup` is actually served by the Users router's `POST /` handler. Not a frontend concern, just a note so no one goes looking for separate "sign up" business logic that doesn't exist.