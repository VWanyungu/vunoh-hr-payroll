/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  if (!(await knex.schema.hasTable("refreshTokens"))) {
    await knex.schema.createTable("refreshTokens", (table) => {
      table.increments("id").primary();
      table
        .uuid("user_id")
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.string("refresh_token").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

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
  await knex.schema.dropTable("refreshTokens");
}
