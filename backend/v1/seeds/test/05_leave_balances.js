import { EMPLOYEE_A, EMPLOYEE_D } from "./03_employees.js";
import { LEAVE_TYPE_ANNUAL, LEAVE_TYPE_SICK } from "./04_leave_types.js";

// Fixed fixture IDs — see note in 01_teams.js.
export const BALANCE_A_ANNUAL = "99ba8abd-3379-427d-8a8a-e4ff5b076e9d";
export const BALANCE_A_SICK = "dcc6615e-b0b8-4664-9a99-b175594ca5c6";
export const BALANCE_D_ANNUAL = "ad2e1b4f-d087-4091-b9cd-e0dcdd914c3b";
export const BALANCE_D_SICK = "cf1bc4d2-6712-4ab1-8e19-b3d718d3c30b";

const YEAR = 2026;

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  await knex("leave_balances").insert([
    { id: BALANCE_A_ANNUAL, employee_id: EMPLOYEE_A, leave_type_id: LEAVE_TYPE_ANNUAL, year: YEAR, allocated: 21, used: 0, remaining: 21 },
    { id: BALANCE_A_SICK, employee_id: EMPLOYEE_A, leave_type_id: LEAVE_TYPE_SICK, year: YEAR, allocated: 14, used: 0, remaining: 14 },
    { id: BALANCE_D_ANNUAL, employee_id: EMPLOYEE_D, leave_type_id: LEAVE_TYPE_ANNUAL, year: YEAR, allocated: 21, used: 0, remaining: 21 },
    { id: BALANCE_D_SICK, employee_id: EMPLOYEE_D, leave_type_id: LEAVE_TYPE_SICK, year: YEAR, allocated: 14, used: 0, remaining: 14 },
  ]);
}
