/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  if (!(await knex.schema.hasTable("tokens"))) {
    await knex.schema.createTable("tokens", (table) => {
      table.increments("id").primary();
      table.string("token").notNullable();
      table.boolean("blacklisted").defaultTo(true);
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTable("tokens");
}
