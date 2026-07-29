// Fixed fixture IDs — see note in 01_teams.js.
// Values chosen for the test suite (not copied from the production seed's
// 7-day notice requirement) to keep the notice-period date math simple.
export const LEAVE_TYPE_ANNUAL = "79e501dc-5374-4ab2-bd78-6e280bb42b1b";
export const LEAVE_TYPE_SICK = "08e75f7e-2633-43dd-be10-0dad7aa87cd6";
export const LEAVE_TYPE_UNPAID = "d9cfe1da-5e10-415d-b645-b9e4bd9c16b1";

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  await knex("leave_types").insert([
    {
      id: LEAVE_TYPE_ANNUAL,
      code: "annual",
      name: "Annual Leave",
      default_allowance_days: 21,
      prorate_on_join: true,
      notice_days_required: 3,
      requires_cover: true,
    },
    {
      id: LEAVE_TYPE_SICK,
      code: "sick",
      name: "Sick Leave",
      default_allowance_days: 14,
      prorate_on_join: false,
      notice_days_required: 0,
      requires_cover: false,
    },
    {
      id: LEAVE_TYPE_UNPAID,
      code: "unpaid",
      name: "Unpaid Leave",
      default_allowance_days: 0,
      prorate_on_join: false,
      notice_days_required: 0,
      requires_cover: false,
    },
  ]);
}
