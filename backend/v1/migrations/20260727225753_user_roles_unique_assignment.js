/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.raw(`
    CREATE UNIQUE INDEX idx_user_roles_unique_assignment
    ON user_roles (user_id, role, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid));
  `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_user_roles_unique_assignment;
  `);
}
