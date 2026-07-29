const TEAM_NAMES = ["Engineering", "Sales", "People Operations"];

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  for (const name of TEAM_NAMES) {
    const existing = await knex("teams").where({ name }).first();

    if (!existing) {
      await knex("teams").insert({ name });
    }
  }
}
