import db from "../../../database/dbSetup.js";
import { seed as seedTeams } from "../../../seeds/test/01_teams.js";
import { seed as seedUsers } from "../../../seeds/test/02_users.js";
import { seed as seedEmployees } from "../../../seeds/test/03_employees.js";
import { seed as seedLeaveTypes } from "../../../seeds/test/04_leave_types.js";
import { seed as seedLeaveBalances } from "../../../seeds/test/05_leave_balances.js";

const FIXTURE_TABLES = [
  "payslips",
  "leave_requests",
  "leave_balances",
  "employees",
  "user_roles",
  "users",
  "teams",
  "leave_types",
  "public_holidays",
];

// `npx knex seed:run --env test`.

export async function resetFixture() {
  await db.raw(
    `TRUNCATE TABLE ${FIXTURE_TABLES.join(", ")} RESTART IDENTITY CASCADE`,
  );
  await seedTeams(db);
  await seedUsers(db);
  await seedEmployees(db);
  await seedLeaveTypes(db);
  await seedLeaveBalances(db);
}

export { db };
