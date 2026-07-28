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

  if (!(await knex.schema.hasTable("users"))) {
    await knex.schema.createTable("users", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

      t.text("name").notNullable();

      t.text("email").notNullable().unique();

      t.text("password_hash").notNullable();

      t.enu("status", ["pending", "approved", "rejected"])
        .notNullable()
        .defaultTo("pending");

      t.timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());

      t.timestamp("updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });

    await addUpdatedAtTrigger("users");
  }

  if (!(await knex.schema.hasTable("teams"))) {
    await knex.schema.createTable("teams", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

      t.text("name").notNullable().unique();

      t.timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());

      t.timestamp("updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });

    await addUpdatedAtTrigger("teams");
  }

  if (!(await knex.schema.hasTable("user_roles"))) {
    await knex.schema.createTable("user_roles", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

      t.uuid("user_id")
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");

      t.enu("role", [
        "super_admin",
        "hr_admin",
        "manager",
        "employee",
      ]).notNullable();

      t.uuid("team_id")
        .nullable()
        .references("id")
        .inTable("teams")
        .onDelete("SET NULL");

      t.timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());

      t.timestamp("updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });

    await knex.raw(`
      CREATE INDEX idx_user_roles_user_id
      ON user_roles(user_id);
    `);

    await knex.raw(`
      CREATE INDEX idx_user_roles_team_id
      ON user_roles(team_id);
    `);

    await addUpdatedAtTrigger("user_roles");
  }

  if (!(await knex.schema.hasTable("employees"))) {
    await knex.schema.createTable("employees", (t) => {
      t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

      t.uuid("user_id")
        .notNullable()
        .unique()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");

      t.text("job_title").notNullable();

      t.uuid("team_id")
        .notNullable()
        .references("id")
        .inTable("teams")
        .onDelete("RESTRICT");

      t.uuid("manager_id")
        .nullable()
        .references("id")
        .inTable("employees")
        .onDelete("SET NULL");

      t.uuid("updated_by")
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("RESTRICT");

      t.date("start_date").notNullable();

      t.decimal("salary", 12, 2).notNullable();

      t.enu("employment_type", ["full_time", "contract"]).notNullable();

      t.text("resume");
      t.text("phone");
      t.text("profile_picture");
      t.integer("national_id", 8);

      t.boolean("is_active").notNullable().defaultTo(true);

      t.boolean("deleted").notNullable().defaultTo(false);

      t.timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());

      t.timestamp("updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });

    await knex.raw(`
      CREATE INDEX idx_employees_user_id
      ON employees(user_id);
    `);

    await knex.raw(`
      CREATE INDEX idx_employees_team_id
      ON employees(team_id);
    `);

    await knex.raw(`
      CREATE INDEX idx_employees_manager_id
      ON employees(manager_id);
    `);

    await addUpdatedAtTrigger("employees");
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists("employees");
  await knex.schema.dropTableIfExists("user_roles");
  await knex.schema.dropTableIfExists("teams");
  await knex.schema.dropTableIfExists("users");

  await knex.raw(`
    DROP FUNCTION IF EXISTS update_updated_at_column();
  `);
}
