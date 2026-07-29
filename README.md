# HR & Payroll

## Deployment

A full-stack HR payroll web application.

- **Frontend:** HTML, CSS, JavaScript — deployed on [Netlify](https://vunoh-hr-payroll.netlify.app/)
- **Backend:** Node.js / Express — deployed on [Vercel](https://vunoh-hr-payroll.vercel.app/)
- **Database:** PostgreSQL, hosted on [Supabase](https://supabase.com/)

Live URLs

| Layer    | URL                                   |
| -------- | ------------------------------------- |
| Frontend | https://vunoh-hr-payroll.netlify.app/ |
| Backend  | https://vunoh-hr-payroll.vercel.app/  |

## Frontend

The frontend can be run locally using any simple web server (e.g. the VS Code "Live Server" extension).

Before running, make sure `API_BASE_URL` in `frontend/api.js` is set to `http://localhost:3000` so requests hit your local backend instead of the deployed one.

## Backend

A Kenya-focused HR and payroll REST API built with Express 5, TypeScript, and Knex/Postgres. Handles user auth, teams, employees, leave management, and monthly payroll runs (PAYE/NSSF/SHIF/AHL). All routes are versioned under `/v1`.

## Tech stack

- **Runtime**: Node.js + TypeScript, run via `tsx` in dev
- **Framework**: Express 5
- **Database**: PostgreSQL via Knex (query builder)
- **Cache**: Upstash Redis (REST-based client, not a `redis://` connection)
- **Auth**: JWT (access/refresh/forgot-password tokens), bcrypt password hashing. Access tokens carry `userId`, `email`, `role`, and `employeeId` (only present when the authenticated user has a linked employee record) — refreshing a token re-derives all of these from the database, not from the refresh token's own (deliberately minimal) claims
- **Validation**: Joi
- **Testing**: Jest + Supertest

Route handlers in `v1/routers/` act as controllers, and `v1/database/utils/database.ts` is the data-access layer, built directly on the Knex query builder.

## Running locally

### Prerequisites

- Node.js 20+ (no version is pinned in `package.json`, but this is the minimum sane baseline for the tooling used)
- A PostgreSQL database. Specify in knexfile.js

An [Upstash Redis](https://upstash.com) instance (free tier is fine) is optional - if the http blacklisted token check fails, it defaults to the database

```
    Before running make sure:
    - You have set the correct CORS url and frontend url to locally running web server's url
    - You have keyed in the correct db credentials for development environment as guided by .env.example
```

### Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in the values, see below
npm run migrate         # runs all Knex migrations
npm run seed             # seeds a starter dataset — see below
npm run dev               # starts the API with tsx watch
```

For production: `npm run build && npm start` (compiles TypeScript to `dist/` and runs the compiled output).

`npm run seed` (Knex `development`/`production` environment, files under `v1/seeds/`) populates a starter dataset, safe to re-run (every file checks for existing rows first): a `super_admin` and `hr_admin` account, 3 teams, 6 employee/manager accounts with linked employee records, leave types, current-year leave balances, public holidays, 3 sample leave requests (pending/approved/rejected), and one generated payroll run (June 2026) for every seeded employee. All seeded accounts use the password `password` — **these are demo credentials, not real secrets; change them before deploying anywhere reachable.** See `v1/seeds/` for the full roster and emails.

### Test accounts

- Super admin: super@gmail.com
- HR: hr@gmail.com
- Manager: amina.otieno@vunoh.io
- Employee: brian.mwangi@vunoh.io

Run tests with `npm test` (uses the `test` Knex environment and the seed files under `v1/seeds/test/`). The `test` environment points at a **separate database** (`TEST_DB_NAME`, defaults to `${DB_NAME}_test`) — the suite truncates and reseeds its fixture tables before every test, which would destroy real data if it ran against the same database as `development`. Create the test database once (`createdb ${DB_NAME}_test`); a Jest `globalSetup` migrates it automatically before the suite runs, so it never needs a manual `npm run migrate` step.

### Environment variables

**Required to boot** — the app throws on startup (`utils/envValidation.ts`) if any of these are missing:

| Variable                                                                      | Purpose                                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`                     | Postgres connection                                                                                                                                                                            |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `FORGOT_PASSWORD_TOKEN_SECRET` | JWT signing secrets                                                                                                                                                                            |
| `TOKEN_EXPIRY`, `TOKEN_EXPIRY_ABSOLUTE`, `TOKEN_EXPIRY_SECONDS`               | Token expiry config — note only `TOKEN_EXPIRY_SECONDS` (Redis cache TTL) is actually read in code today; the other two are validated as required but not yet consumed, reserved for future use |
| `FRONTEND_URL`, `BACKEND_URL`                                                 | Used for CORS defaults and building reset-password links                                                                                                                                       |
| `PORT`                                                                        | Must be a number between 1 and 65535                                                                                                                                                           |
| `NODE_ENV`                                                                    | Must be `development`, `production`, or `test`                                                                                                                                                 |

**Optional to boot, but a feature won't work without them:**

| Variable                                          | What breaks without it                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REDIS_URL`, `REDIS_TOKEN`                        | The server starts fine, but almost every authenticated route checks a token-blacklist cache backed by Redis (`v1/middlewares/token.ts` → `v1/utils/checkCache.ts`), and logout relies on it too. Without valid credentials, those requests will fail. Only the public routes — `/v1/login`, `/v1/signup`, `/v1/forgot-password`, `/v1/reset-password/*`, `/v1/token`, and `POST /v1/users` — work without Redis configured. |
| `SENDGRID_USER`, `SENDGRID_PASSWORD`, `MAIL_FROM` | The app boots fine and every feature works normally _except_ `POST /v1/forgot-password`, which will return a 500 because no reset email can be sent. Despite the variable names, the mailer (`v1/utils/sendMail.ts`) currently sends through **Gmail SMTP** via `nodemailer`, not the SendGrid API — the `SENDGRID_*` names are left over from an earlier SendGrid-SMTP setup.                                              |

**Optional, with working defaults:**

| Variable                       | Default                      | Purpose                                                                                                                                                          |
| ------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEST_DB_NAME`                 | `${DB_NAME}_test`            | Database used by `npm test` (`test` Knex environment) — always separate from `DB_NAME` so the test suite's truncate/reseed cycle can't touch dev/production data |
| `CORS_ALLOWED_ORIGINS`         | falls back to `FRONTEND_URL` | Comma-separated list of allowed CORS origins                                                                                                                     |
| `RATE_LIMIT_WINDOW_MS`         | `900000` (15 min)            | Global rate limiter window                                                                                                                                       |
| `RATE_LIMIT_MAX_REQUESTS`      | `100`                        | Global rate limiter max requests per window                                                                                                                      |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | `5`                          | Stricter limiter applied to auth routes                                                                                                                          |
| `LOG_LEVEL`                    | `info`                       | Pino log level                                                                                                                                                   |

See `.env.example` for a filled-in starting point for local development.

## Rules & thresholds across modules

### Leave

| Leave type | Default annual allowance | Prorated on join | Notice required | Requires cover |
| ---------- | ------------------------ | ---------------- | --------------- | -------------- |
| `annual`   | 21 days                  | Yes              | 7 days          | Yes            |
| `sick`     | 14 days                  | No               | 0 days          | No             |
| `unpaid`   | 0 days                   | No               | 7 days          | Yes            |

- Balances are tracked per `(employee, leave type, year)`; there is **no carry-forward** — a fresh balance row must be created for each year (`POST /v1/leave-balances`, restricted to `super_admin`/`hr_admin`).
- Negative balances are never allowed: checked once at submission (`no_balance` / `insufficient_balance` errors) and re-checked at approval time inside a locked transaction.
- Requests for any type other than `unpaid` require an existing balance row with enough `remaining` days for the requested working days (weekends and public holidays excluded from the count).
- Approver resolution order: the employee's direct manager → the team's manager → any HR admin. If none is found, the request is rejected with `no_approver_available`.
- Only `pending` requests can be edited, cancelled, approved, or rejected.
- Approving/rejecting is restricted to `super_admin`, `hr_admin`, or the requester's actual manager.
- A non-blocking **team capacity warning** is surfaced when viewing a pending request if approving it would drop the team below **60%** capacity (`LOW_CAPACITY_THRESHOLD` in `v1/utils/leave/checkTeamCoverage.ts`) — it does not block approval.

### Payroll

- Pay periods are always full calendar months (`periodMonth` 1–12, `periodYear` 2000–2100).
- `salary` must be a positive number with at most 2 decimal places.
- Statutory deductions (PAYE, NSSF, SHIF, AHL) are **skipped entirely** for employees with `employmentType: "contract"` — only `full_time` employees get them.
- Only employees who are `is_active`, not deleted, and joined on or before the period end date are included in a payroll run.
- Payslips are versioned: re-running payroll for the same employee/period never overwrites history — it creates a new version, and `getLatestPayslipForEmployee` returns the current one.
- Triggering a payroll run (`POST /v1/payroll-runs`) is restricted to `super_admin`/`hr_admin`.

### Users

- `GET /v1/users` takes its filters entirely from the query string (never the request body, since GET requests can't reliably carry one): `?type=multiple&page=&limit=&status=` for a paginated list, or `?type=single&id=<uuid>` / `?type=single&email=<email>` for a single user lookup (by id or email). A single-user lookup returns `id`, `name`, `email`, `status`, and `roles`.

### Employees

- `employmentType` is restricted to `full_time` or `contract`.
- One employee profile per user (`user_id` is unique).
- Self-service updates (via the employee themself) are limited to `resume`, `phone`, and `profilePicture` — only `super_admin`/`hr_admin`/`manager` can change `salary`, `teamId`, `managerId`, `employmentType`, `startDate`, or `jobTitle`.
- New employee records default to `is_active: true`.
- Activating/deactivating an employee (`POST /v1/employees/:id/activate` / `POST /v1/employees/:id/deactivate`) is restricted to `super_admin`/`hr_admin`.
- Soft-deleting an employee (`DELETE /v1/employees/:id`) is restricted to `super_admin`/`hr_admin` — it sets `deleted: true` rather than removing the row, and the record is then excluded from all reads, updates, and payroll runs.
- `GET /v1/employees`, `GET /v1/employees/:id`, and the internal user-id lookup all join `users` so results include the employee's `name` and `email`, not just their `user_id`.
- A plain `employee`-role caller of `GET /v1/employees` is automatically scoped to their own `team_id` — any `team` query param they send is overridden server-side with their own team. `super_admin`, `hr_admin`, and `manager` callers are unrestricted.

### Authorization matrix (`v1/middlewares/authorize.ts`)

| Action                                         | Allowed roles                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| List all users                                 | `super_admin`, `hr_admin`, `manager`                                                                   |
| Update / delete a user, assign or revoke roles | `super_admin`, `hr_admin` (delete: `super_admin` only)                                                 |
| Create / update / delete a team                | `super_admin`, `hr_admin`                                                                              |
| List all employees                             | `super_admin`, `hr_admin`, `manager`, `employee` (`employee` is scoped to their own team)              |
| View / create / update a single employee       | `super_admin`, `hr_admin`, `manager`, `employee` (self-service fields only for `employee` — see above) |
| Activate / deactivate an employee              | `super_admin`, `hr_admin`                                                                              |
| Soft-delete an employee                        | `super_admin`, `hr_admin`                                                                              |
| Approve / reject a leave request               | `super_admin`, `hr_admin`, `manager`                                                                   |
| Create a leave balance                         | `super_admin`, `hr_admin`                                                                              |
| Trigger a payroll run                          | `super_admin`, `hr_admin`                                                                              |

Roles come from a fixed set: `super_admin`, `hr_admin`, `manager`, `employee`.

## Payroll formula

Rates live in `v1/utils/config/taxRate.js`

**1. Gross pay** (`v1/utils/payroll/proration.ts`) — prorated for mid-period joiners/leavers and unpaid leave:

```
gross = (monthlySalary / workingWeekdaysInPeriod) * (weekdaysPresent - approvedUnpaidLeaveDays)
```

`workingWeekdaysInPeriod` counts Monday–Friday only across the full calendar-month pay period. Only _approved_ unpaid leave reduces the days paid.

**2. Statutory deductions** (`v1/utils/payroll/deductions.ts`) — skipped entirely for `contract` employees:

- **PAYE**: cumulative KRA bands, then minus a flat personal relief, floored at 0.

  | Band up to (KES) | Rate  |
  | ---------------- | ----- |
  | 24,000           | 10%   |
  | 32,333           | 25%   |
  | 500,000          | 30%   |
  | 800,000          | 32.5% |
  | above            | 35%   |

  `PAYE = sum(taxable amount in each band) - 2,400` (personal relief), minimum 0.

- **NSSF**: two tiers, capped in total.
  - Tier I: 6% of the first KES 9,000 of gross pay
  - Tier II: 6% of the amount between KES 9,000 and KES 108,000
  - Total capped at **KES 6,480**, regardless of gross pay

- **SHIF** (Social Health Insurance Fund): flat **2.75%** of gross pay.

- **AHL** (Affordable Housing Levy): flat **1.5%** of gross pay.

All deduction values are rounded to 2 decimal places.

**3. Net pay**

```
net = gross - PAYE - NSSF - SHIF - AHL
```

**Worked example** (from `v1/utils/payroll/deductions.test.ts`), gross pay = KES 50,000:

| Deduction   | Amount (KES)  |
| ----------- | ------------- |
| PAYE        | 7,383.35      |
| NSSF        | 3,000.00      |
| SHIF        | 1,375.00      |
| AHL         | 750.00        |
| **Net pay** | **37,491.65** |

## Future improvements

- **Carry-forward of unused leave days**: leave balances are currently created fresh per `(employee, type, year)` with no mechanism to roll unused annual leave days into the next year.
- **Custom/ad-hoc deductions**: only the four fixed statutory deductions (PAYE, NSSF, SHIF, AHL) exist today. There's no way to add per-employee deductions such as staff loans or advances to a payslip.
- **Email notifications for stale leave requests**: no reminder is sent to approvers when a leave request has been pending for a long time.
- **Yearly cron job for leave balances**: creating next year's leave balances currently requires a manual, privileged-only API call (`POST /v1/leave-balances`) per employee/type — this should be automated to run yearly.
- **Employee document verification & upload**: there is currently no support for uploading or verifying employee documents. File-upload/Cloudinary integration was removed in this version (it was unused, dead code) and will need to be reintroduced — along with a verification workflow — to support this.
- No attendance module exists yet.
