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

  if (!(await knex.schema.hasTable("leave_balances"))) {
    await knex.schema.createTable("leave_balances", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      
      t.uuid("employee_id")
        .notNullable()
        .references("id")
        .inTable("employees")
        .onDelete("CASCADE");
      
      t.uuid("leave_type_id")
        .notNullable()
        .references("id")
        .inTable("leave_types")
        .onDelete("RESTRICT");
      
      t.integer("year").notNullable();
      t.integer("allocated").notNullable();
      t.integer("used").notNullable();
      t.integer("remaining").notNullable();
      
      t.timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
      
      t.timestamp("updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });

    await knex.raw(`
      CREATE UNIQUE INDEX idx_leave_balances_employee_leave_type_year
      ON leave_balances(employee_id, leave_type_id, year);
    `);

    await knex.raw(`
      CREATE INDEX idx_leave_balances_employee_id
      ON leave_balances(employee_id);
    `);

    await knex.raw(`
      CREATE INDEX idx_leave_balances_leave_type_id
      ON leave_balances(leave_type_id);
    `);

    await knex.raw(`
      CREATE INDEX idx_leave_balances_year
      ON leave_balances(year);
    `);

    await addUpdatedAtTrigger("leave_balances");
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTable("leave_balances");
}
