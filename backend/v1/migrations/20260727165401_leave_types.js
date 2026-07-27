/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.raw(`
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `);

  await knex.raw(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

  const addUpdatedAtTrigger = async (tableName) => {
    await knex.raw(`
        CREATE TRIGGER update_${tableName}_updated_at
        BEFORE UPDATE ON ${tableName}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
        `);
  };

  if (!(await knex.schema.hasTable("leave_types"))) {
    await knex.schema.createTable("leave_types", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      t.enu("code", ["annual", "sick", "unpaid"])
        .notNullable()
        .defaultTo("annual");
      t.text("name").notNullable().unique();
      t.integer("default_allowance_days");
      t.boolean("prorate_on_join");
      t.integer("notice_days_required");
      t.boolean("requires_cover");
      t.timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());

      t.timestamp("updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });

    await addUpdatedAtTrigger("leave_types");
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTable("leave_types");
}
