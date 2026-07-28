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

  if (!(await knex.schema.hasTable("payslips"))) {
    await knex.schema.createTable("payslips", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

      t.uuid("employee_id")
        .notNullable()
        .references("id")
        .inTable("employees")
        .onDelete("CASCADE");

      t.integer("period_month").notNullable();
      t.integer("period_year").notNullable();

      t.decimal("gross_pay", 12, 2).notNullable();
      t.integer("unpaid_leave_days").notNullable().defaultTo(0);

      t.decimal("nssf", 12, 2).notNullable().defaultTo(0);
      t.decimal("shif", 12, 2).notNullable().defaultTo(0);
      t.decimal("ahl", 12, 2).notNullable().defaultTo(0);
      t.decimal("paye", 12, 2).notNullable().defaultTo(0);

      t.decimal("net_pay", 12, 2).notNullable();

      t.integer("version").notNullable().defaultTo(1);

      t.timestamp("generated_at", { useTz: true }).notNullable();

      t.uuid("generated_by")
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("RESTRICT");

      t.timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());

      t.timestamp("updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });

    await knex.raw(`
      CREATE INDEX idx_payslips_employee_id
      ON payslips(employee_id);
    `);

    await knex.raw(`
      CREATE INDEX idx_payslips_period_month
      ON payslips(period_month);
    `);

    await knex.raw(`
      CREATE INDEX idx_payslips_period_year
      ON payslips(period_year);
    `);

    await knex.raw(`
      CREATE INDEX idx_payslips_generated_by
      ON payslips(generated_by);
    `);

    await knex.raw(`
      CREATE INDEX idx_payslips_period
      ON payslips(period_month, period_year);
    `);

    await addUpdatedAtTrigger("payslips");
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTable("payslips");
}
