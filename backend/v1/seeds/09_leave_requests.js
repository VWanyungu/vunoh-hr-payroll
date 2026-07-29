// Three sample requests covering the full status range. Date ranges are
// chosen to be plain Mon–Fri spans that don't overlap any seeded public
// holiday, so working-day counts below are just calendar weekdays.

const REQUESTS = [
  {
    employeeEmail: "brian.mwangi@vunoh.io",
    leaveTypeCode: "annual",
    startDate: "2026-08-10",
    endDate: "2026-08-12",
    workingDays: 3,
    status: "pending",
    approverEmail: "amina.otieno@vunoh.io",
    coverEmail: "grace.wanjiru@vunoh.io",
  },
  {
    employeeEmail: "faith.achieng@vunoh.io",
    leaveTypeCode: "sick",
    startDate: "2026-06-02",
    endDate: "2026-06-03",
    workingDays: 2,
    status: "approved",
    approverEmail: "peter.kamau@vunoh.io",
    coverEmail: null,
    decidedAt: "2026-06-01T09:00:00.000Z",
  },
  {
    employeeEmail: "grace.wanjiru@vunoh.io",
    leaveTypeCode: "unpaid",
    startDate: "2026-09-07",
    endDate: "2026-09-11",
    workingDays: 5,
    status: "rejected",
    approverEmail: "amina.otieno@vunoh.io",
    coverEmail: "brian.mwangi@vunoh.io",
    decidedAt: "2026-08-20T09:00:00.000Z",
  },
];

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  for (const r of REQUESTS) {
    const employeeUser = await knex("users").where({ email: r.employeeEmail }).first();
    const employee = employeeUser
      ? await knex("employees").where({ user_id: employeeUser.id }).first()
      : null;

    if (!employee) {
      throw new Error(`Seed order error: employee for "${r.employeeEmail}" not found — run 05_employees.js first`);
    }

    const leaveType = await knex("leave_types").where({ code: r.leaveTypeCode }).first();
    if (!leaveType) {
      throw new Error(`Seed order error: leave type "${r.leaveTypeCode}" not found — run 06_leave_types.js first`);
    }

    const existing = await knex("leave_requests")
      .where({ employee_id: employee.id, leave_type_id: leaveType.id, start_date: r.startDate })
      .first();
    if (existing) continue;

    let approverUserId = null;
    if (r.approverEmail) {
      const approverUser = await knex("users").where({ email: r.approverEmail }).first();
      approverUserId = approverUser ? approverUser.id : null;
    }

    let coverEmployeeId = null;
    if (r.coverEmail) {
      const coverUser = await knex("users").where({ email: r.coverEmail }).first();
      const coverEmployee = coverUser
        ? await knex("employees").where({ user_id: coverUser.id }).first()
        : null;
      coverEmployeeId = coverEmployee ? coverEmployee.id : null;
    }

    await knex("leave_requests").insert({
      employee_id: employee.id,
      leave_type_id: leaveType.id,
      start_date: r.startDate,
      end_date: r.endDate,
      working_days_count: r.workingDays,
      status: r.status,
      cover_employee_id: coverEmployeeId,
      approver_id: approverUserId,
      requested_at: knex.fn.now(),
      decided_at: r.decidedAt ?? null,
    });

    // Approving a request deducts from the matching leave_balances row, same
    // as LeaveRequests.approveLeaveRequest does at runtime — keep this seed's
    // "approved" sample balance-consistent from the start.
    if (r.status === "approved") {
      const year = new Date(r.startDate).getFullYear();
      const balance = await knex("leave_balances")
        .where({ employee_id: employee.id, leave_type_id: leaveType.id, year })
        .first();

      if (balance) {
        const used = balance.used + r.workingDays;
        await knex("leave_balances")
          .where({ id: balance.id })
          .update({ used, remaining: balance.allocated - used });
      }
    }
  }
}
