// Mirrors the balance rows Employees.createEmployee sets up automatically
// for a new hire: one row per non-"unpaid" leave type, for the current year.

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  const year = new Date().getFullYear();
  const employees = await knex("employees").where({ deleted: false });
  const leaveTypes = await knex("leave_types").where("code", "<>", "unpaid");

  for (const employee of employees) {
    for (const leaveType of leaveTypes) {
      const existing = await knex("leave_balances")
        .where({ employee_id: employee.id, leave_type_id: leaveType.id, year })
        .first();

      if (!existing) {
        const allocated = leaveType.default_allowance_days ?? 0;

        await knex("leave_balances").insert({
          employee_id: employee.id,
          leave_type_id: leaveType.id,
          year,
          allocated,
          used: 0,
          remaining: allocated,
        });
      }
    }
  }
}
