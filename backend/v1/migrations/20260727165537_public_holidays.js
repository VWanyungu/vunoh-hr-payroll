/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  const addUpdatedAtTrigger = async (tableName) => {
    await knex.raw(`
      CREATE TRIGGER update_${tableName}_updated_at
      BEFORE UPDATE ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  };

  if (!(await knex.schema.hasTable("public_holidays"))) {
    await knex.schema.createTable("public_holidays", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      
      t.date("holiday_date").notNullable().unique();
      t.text("name").notNullable();
      t.integer("year").notNullable();
      
      t.timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
      
      t.timestamp("updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });

    await knex.raw(`
      CREATE INDEX idx_public_holidays_holiday_date
      ON public_holidays(holiday_date);
    `);

    await knex.raw(`
      CREATE INDEX idx_public_holidays_year
      ON public_holidays(year);
    `);

    await addUpdatedAtTrigger("public_holidays");
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTable("public_holidays");
}
