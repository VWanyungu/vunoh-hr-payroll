/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  const holidays = [
    {
      holiday_date: "2026-01-01",
      name: "New Year's Day",
      year: 2026,
    },
    {
      holiday_date: "2026-04-03",
      name: "Good Friday",
      year: 2026,
    },
    {
      holiday_date: "2026-04-06",
      name: "Easter Monday",
      year: 2026,
    },
    {
      holiday_date: "2026-05-01",
      name: "Labour Day",
      year: 2026,
    },
    {
      holiday_date: "2026-06-01",
      name: "Madaraka Day",
      year: 2026,
    },
    {
      holiday_date: "2026-10-20",
      name: "Mashujaa Day",
      year: 2026,
    },
    {
      holiday_date: "2026-12-12",
      name: "Jamhuri Day",
      year: 2026,
    },
    {
      holiday_date: "2026-12-25",
      name: "Christmas Day",
      year: 2026,
    },
    {
      holiday_date: "2026-12-26",
      name: "Boxing Day",
      year: 2026,
    },
  ];

  for (const holiday of holidays) {
    const existing = await knex("public_holidays")
      .where({ holiday_date: holiday.holiday_date })
      .first();

    if (!existing) {
      await knex("public_holidays").insert(holiday);
    }
  }
}
