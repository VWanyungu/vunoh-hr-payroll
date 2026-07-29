/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  const leaveTypes = [
    {
      code: "annual",
      name: "Annual Leave",
      default_allowance_days: 21,
      prorate_on_join: true,
      notice_days_required: 7,
      requires_cover: true,
    },
    {
      code: "sick",
      name: "Sick Leave",
      default_allowance_days: 14,
      prorate_on_join: false,
      notice_days_required: 0,
      requires_cover: false,
    },
    {
      code: "unpaid",
      name: "Unpaid Leave",
      default_allowance_days: 0,
      prorate_on_join: false,
      notice_days_required: 7,
      requires_cover: true,
    },
  ];

  for (const leaveType of leaveTypes) {
    const existing = await knex("leave_types")
      .where({ code: leaveType.code })
      .first();

    if (!existing) {
      await knex("leave_types").insert(leaveType);
    }
  }
}
