import { TEAM_ENGINEERING, TEAM_OPS } from "./01_teams.js";

// Fixed fixture IDs — see note in 01_teams.js.
export const USER_MANAGER = "5951dce0-0236-4ce2-a7ca-56d22256ed22";
export const USER_MANAGER2 = "24e7a65a-902a-45a2-b0d7-faf104020565";
export const USER_HR = "18aacafc-e358-47cb-af5a-c72514c8062c";
export const USER_EMPLOYEE_A = "2a25bf93-0a70-4b12-98b9-0ade6f6f9085";
export const USER_EMPLOYEE_B = "3304042f-21fa-46e0-ba61-f453fc11c6ca";
export const USER_EMPLOYEE_D = "a1859064-7566-46db-a3f3-1870ce66d166";
// Mid-year joiner fixture: not exercised by any current test (the app's
// employee-creation balance seeding doesn't actually prorate on join despite
// leave_types.prorate_on_join existing), kept for future proration tests.
export const USER_EMPLOYEE_MIDYEAR = "6f2c9b1e-6f0a-4a3b-9d0e-7a6c2e4f9b3d";

export const ROLE_MANAGER = "c94fb407-28dc-49e7-9a8c-4c60f1a432c9";
export const ROLE_MANAGER2 = "660089cd-3711-402f-bd4c-78eecb83cb5c";
export const ROLE_HR = "17d13152-33bb-4c1d-9f4f-3a70c584df91";
export const ROLE_EMPLOYEE_A = "fadddb27-2c3e-4c41-8a63-f1ecceff25b0";
export const ROLE_EMPLOYEE_B = "d5b60fdf-2d8e-43a8-9eb6-7bfbdf1b8008";
export const ROLE_EMPLOYEE_D = "786a37b2-807b-4fde-ad36-c10e60bd6d2f";
export const ROLE_EMPLOYEE_MIDYEAR = "1b3e7f5a-8c2d-4e6f-9a1b-2c3d4e5f6a7b";

const DUMMY_PASSWORD_HASH = "not-a-real-hash";

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  await knex("users").insert([
    { id: USER_MANAGER, name: "Manager One", email: "manager1@fixture.test", password_hash: DUMMY_PASSWORD_HASH, status: "approved" },
    { id: USER_MANAGER2, name: "Manager Two", email: "manager2@fixture.test", password_hash: DUMMY_PASSWORD_HASH, status: "approved" },
    { id: USER_HR, name: "HR Admin", email: "hr@fixture.test", password_hash: DUMMY_PASSWORD_HASH, status: "approved" },
    { id: USER_EMPLOYEE_A, name: "Employee A", email: "employee-a@fixture.test", password_hash: DUMMY_PASSWORD_HASH, status: "approved" },
    { id: USER_EMPLOYEE_B, name: "Employee B", email: "employee-b@fixture.test", password_hash: DUMMY_PASSWORD_HASH, status: "approved" },
    { id: USER_EMPLOYEE_D, name: "Employee D", email: "employee-d@fixture.test", password_hash: DUMMY_PASSWORD_HASH, status: "approved" },
    { id: USER_EMPLOYEE_MIDYEAR, name: "Employee Midyear", email: "employee-midyear@fixture.test", password_hash: DUMMY_PASSWORD_HASH, status: "approved" },
  ]);

  await knex("user_roles").insert([
    { id: ROLE_MANAGER, user_id: USER_MANAGER, role: "manager", team_id: TEAM_ENGINEERING },
    { id: ROLE_MANAGER2, user_id: USER_MANAGER2, role: "manager", team_id: TEAM_OPS },
    { id: ROLE_HR, user_id: USER_HR, role: "hr_admin", team_id: null },
    { id: ROLE_EMPLOYEE_A, user_id: USER_EMPLOYEE_A, role: "employee", team_id: TEAM_ENGINEERING },
    { id: ROLE_EMPLOYEE_B, user_id: USER_EMPLOYEE_B, role: "employee", team_id: TEAM_ENGINEERING },
    { id: ROLE_EMPLOYEE_D, user_id: USER_EMPLOYEE_D, role: "employee", team_id: null },
    { id: ROLE_EMPLOYEE_MIDYEAR, user_id: USER_EMPLOYEE_MIDYEAR, role: "employee", team_id: TEAM_ENGINEERING },
  ]);
}
