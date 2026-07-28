/**
 * The payslips table was created with `ahl` as an integer column, before the
 * migration source was updated to declare it as decimal(12,2) to match the
 * other statutory deduction columns (nssf, shif, paye). Since migrations
 * don't re-run once applied, existing databases are left with the stale
 * integer column, which rejects any non-whole AHL value (e.g. from prorated
 * pay).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  const hasColumn = await knex.schema.hasColumn("payslips", "ahl");
  if (hasColumn) {
    await knex.schema.alterTable("payslips", (t) => {
      t.dropColumn("ahl");
    });
  }

  await knex.schema.alterTable("payslips", (t) => {
    t.decimal("ahl", 12, 2).notNullable().defaultTo(0);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable("payslips", (t) => {
    t.dropColumn("ahl");
  });
}
