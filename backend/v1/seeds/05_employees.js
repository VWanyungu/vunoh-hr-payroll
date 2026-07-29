// Order matters: a report's manager must appear earlier in this list so its
// employee record already exists when we resolve manager_id below.
const EMPLOYEES = [
  { email: "amina.otieno@vunoh.io", jobTitle: "Engineering Manager", team: "Engineering", managerEmail: null, startDate: "2022-01-10", salary: 180000, employmentType: "full_time" },
  { email: "brian.mwangi@vunoh.io", jobTitle: "Software Engineer", team: "Engineering", managerEmail: "amina.otieno@vunoh.io", startDate: "2023-03-01", salary: 110000, employmentType: "full_time" },
  { email: "grace.wanjiru@vunoh.io", jobTitle: "Software Engineer", team: "Engineering", managerEmail: "amina.otieno@vunoh.io", startDate: "2024-06-15", salary: 105000, employmentType: "full_time" },
  { email: "peter.kamau@vunoh.io", jobTitle: "Sales Manager", team: "Sales", managerEmail: null, startDate: "2021-11-01", salary: 150000, employmentType: "full_time" },
  { email: "faith.achieng@vunoh.io", jobTitle: "Sales Executive", team: "Sales", managerEmail: "peter.kamau@vunoh.io", startDate: "2023-09-01", salary: 85000, employmentType: "full_time" },
  { email: "daniel.kiprono@vunoh.io", jobTitle: "People Operations Associate", team: "People Operations", managerEmail: null, startDate: "2025-02-01", salary: 95000, employmentType: "contract" },
];

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  const hrAdmin = await knex("users").where({ email: "hr@gmail.com" }).first();

  if (!hrAdmin) {
    throw new Error("Seed order error: hr_admin not found — run 02_hr_admin.js first");
  }

  for (const e of EMPLOYEES) {
    const user = await knex("users").where({ email: e.email }).first();

    if (!user) {
      throw new Error(`Seed order error: user "${e.email}" not found — run 04_users.js first`);
    }

    const existing = await knex("employees").where({ user_id: user.id }).first();
    if (existing) continue;

    const team = await knex("teams").where({ name: e.team }).first();

    let managerId = null;
    if (e.managerEmail) {
      const managerUser = await knex("users").where({ email: e.managerEmail }).first();
      const managerEmployee = managerUser
        ? await knex("employees").where({ user_id: managerUser.id }).first()
        : null;
      managerId = managerEmployee ? managerEmployee.id : null;
    }

    await knex("employees").insert({
      user_id: user.id,
      job_title: e.jobTitle,
      team_id: team.id,
      manager_id: managerId,
      updated_by: hrAdmin.id,
      start_date: e.startDate,
      salary: e.salary,
      employment_type: e.employmentType,
      is_active: true,
    });
  }
}
