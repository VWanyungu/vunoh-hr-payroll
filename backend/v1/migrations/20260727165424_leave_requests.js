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

  if (!(await knex.schema.hasTable("leave_requests"))) {
    await knex.schema.createTable("leave_requests", (t) => {
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
      
      t.date("start_date").notNullable();
      t.date("end_date").notNullable();
      t.integer("working_days_count").notNullable();
      
      t.enu("status", ["pending", "approved", "rejected", "cancelled"])
        .notNullable()
        .defaultTo("pending");
      
      t.uuid("cover_employee_id")
        .nullable()
        .references("id")
        .inTable("employees")
        .onDelete("SET NULL");
      
      t.uuid("approver_id")
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      
      t.timestamp("requested_at", { useTz: true }).notNullable();
      t.timestamp("decided_at", { useTz: true }).nullable();
      
      t.timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
      
      t.timestamp("updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });

    await knex.raw(`
      CREATE INDEX idx_leave_requests_employee_id
      ON leave_requests(employee_id);
    `);

    await knex.raw(`
      CREATE INDEX idx_leave_requests_leave_type_id
      ON leave_requests(leave_type_id);
    `);

    await knex.raw(`
      CREATE INDEX idx_leave_requests_cover_employee_id
      ON leave_requests(cover_employee_id);
    `);

    await knex.raw(`
      CREATE INDEX idx_leave_requests_approver_id
      ON leave_requests(approver_id);
    `);

    await knex.raw(`
      CREATE INDEX idx_leave_requests_status
      ON leave_requests(status);
    `);

    await addUpdatedAtTrigger("leave_requests");
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTable("leave_requests");
}
