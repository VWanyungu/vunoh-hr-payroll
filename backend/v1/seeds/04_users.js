import bcrypt from "bcrypt";

const PASSWORD = "password";

// Roster for the starter dataset: two managers (one per non-HR team) and
// their direct reports, plus a standalone employee with no manager yet.
export const USERS = [
  { name: "Amina Otieno", email: "amina.otieno@vunoh.io", role: "manager", team: "Engineering" },
  { name: "Brian Mwangi", email: "brian.mwangi@vunoh.io", role: "employee", team: "Engineering" },
  { name: "Grace Wanjiru", email: "grace.wanjiru@vunoh.io", role: "employee", team: "Engineering" },
  { name: "Peter Kamau", email: "peter.kamau@vunoh.io", role: "manager", team: "Sales" },
  { name: "Faith Achieng", email: "faith.achieng@vunoh.io", role: "employee", team: "Sales" },
  { name: "Daniel Kiprono", email: "daniel.kiprono@vunoh.io", role: "employee", team: "People Operations" },
];

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const u of USERS) {
    const team = await knex("teams").where({ name: u.team }).first();

    if (!team) {
      throw new Error(`Seed order error: team "${u.team}" not found — run 03_teams.js first`);
    }

    let user = await knex("users").where({ email: u.email }).first();

    if (!user) {
      const [inserted] = await knex("users")
        .insert({
          name: u.name,
          email: u.email,
          password_hash: passwordHash,
          status: "approved",
        })
        .returning(["id"]);

      user = inserted;
    }

    const existingRole = await knex("user_roles")
      .where({ user_id: user.id, role: u.role, team_id: team.id })
      .first();

    if (!existingRole) {
      await knex("user_roles").insert({
        user_id: user.id,
        role: u.role,
        team_id: team.id,
      });
    }
  }
}
