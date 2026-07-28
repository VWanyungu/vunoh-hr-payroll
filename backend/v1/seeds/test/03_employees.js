import { TEAM_ENGINEERING, TEAM_NO_MANAGER } from "./01_teams.js";
import {
  USER_MANAGER,
  USER_HR,
  USER_EMPLOYEE_A,
  USER_EMPLOYEE_B,
  USER_EMPLOYEE_D,
  USER_EMPLOYEE_MIDYEAR,
} from "./02_users.js";

// Fixed fixture IDs — see note in 01_teams.js.
export const EMPLOYEE_MANAGER = "ef805349-1482-4d0f-9865-2ed26c121c7d";
export const EMPLOYEE_A = "bedb04c6-f4c2-4b95-ad8f-a8afeb9d3471";
export const EMPLOYEE_B = "0a6ca378-8631-4d62-9549-a3a606888984";
export const EMPLOYEE_D = "2df1717e-094e-4f8e-bec8-368fd0261d52";
export const EMPLOYEE_MIDYEAR = "8d4a1c2b-3e5f-47a8-9b0c-1d2e3f4a5b6c";

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  await knex("employees").insert([
    {
      id: EMPLOYEE_MANAGER,
      user_id: USER_MANAGER,
      job_title: "Engineering Manager",
      team_id: TEAM_ENGINEERING,
      manager_id: null,
      updated_by: USER_HR,
      start_date: "2018-01-01",
      salary: 90000.0,
      employment_type: "full_time",
      is_active: true,
    },
    {
      id: EMPLOYEE_A,
      user_id: USER_EMPLOYEE_A,
      job_title: "Software Engineer",
      team_id: TEAM_ENGINEERING,
      manager_id: EMPLOYEE_MANAGER,
      updated_by: USER_HR,
      start_date: "2020-01-15",
      salary: 60000.0,
      employment_type: "full_time",
      is_active: true,
    },
    {
      id: EMPLOYEE_B,
      user_id: USER_EMPLOYEE_B,
      job_title: "Software Engineer",
      team_id: TEAM_ENGINEERING,
      manager_id: EMPLOYEE_MANAGER,
      updated_by: USER_HR,
      start_date: "2021-03-01",
      salary: 60000.0,
      employment_type: "full_time",
      is_active: true,
    },
    {
      id: EMPLOYEE_D,
      user_id: USER_EMPLOYEE_D,
      job_title: "Support Specialist",
      team_id: TEAM_NO_MANAGER,
      manager_id: null,
      updated_by: USER_HR,
      start_date: "2019-06-01",
      salary: 55000.0,
      employment_type: "full_time",
      is_active: true,
    },
    {
      id: EMPLOYEE_MIDYEAR,
      user_id: USER_EMPLOYEE_MIDYEAR,
      job_title: "Software Engineer",
      team_id: TEAM_ENGINEERING,
      manager_id: EMPLOYEE_MANAGER,
      updated_by: USER_HR,
      start_date: "2026-03-01",
      salary: 60000.0,
      employment_type: "full_time",
      is_active: true,
    },
  ]);
}
