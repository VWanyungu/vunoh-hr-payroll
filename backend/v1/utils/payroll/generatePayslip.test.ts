import { generatePayslip } from "./generatePayslip.js";
import {
  Employees,
  LeaveRequests,
  Payslips,
} from "../../database/utils/database.js";
import type { EmployeeId, UserId } from "../../types.js";

jest.mock("../../database/utils/database.js", () => ({
  Employees: {
    getEmployeeById: jest.fn(),
  },
  LeaveRequests: {
    getApprovedUnpaidLeaveDays: jest.fn(),
  },
  Payslips: {
    getLatestPayslipForEmployee: jest.fn(),
    createPayslip: jest.fn(),
  },
}));

const employee = {
  id: "employee-1" as EmployeeId,
  salary: 100000,
  start_date: "2026-01-01",
  employment_type: "full_time" as const,
};

const generatedBy = "user-1" as UserId;

// July 2026 has 23 weekdays.
const input = {
  employeeId: employee.id,
  periodMonth: 7,
  periodYear: 2026,
  generatedBy,
};

beforeEach(() => {
  jest.clearAllMocks();
  (Employees.getEmployeeById as jest.Mock).mockResolvedValue({ employee });
  (LeaveRequests.getApprovedUnpaidLeaveDays as jest.Mock).mockResolvedValue({
    unpaidLeaveDays: 0,
  });
  (Payslips.getLatestPayslipForEmployee as jest.Mock).mockResolvedValue({
    payslip: null,
  });
  (Payslips.createPayslip as jest.Mock).mockImplementation(async (i) => ({
    payslip: { ...i, id: "payslip-1" },
  }));
});

describe("generatePayslip", () => {
  it("rejects when the employee does not exist", async () => {
    (Employees.getEmployeeById as jest.Mock).mockResolvedValue({
      employee: null,
    });

    const result = await generatePayslip({
      ...input,
      employeeId: "missing" as EmployeeId,
    });

    expect(result).toEqual({ payslip: null, error: "employee_not_found" });
    expect(Payslips.createPayslip).not.toHaveBeenCalled();
  });

  it("prorates gross pay, applies statutory deductions, and computes net pay for a full-time employee", async () => {
    await generatePayslip(input);

    // full month worked, no unpaid leave -> full salary as gross pay
    expect(Payslips.createPayslip).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: employee.id,
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        grossPay: 100000,
        unpaidLeaveDays: 0,
        generatedBy,
      }),
    );

    const call = (Payslips.createPayslip as jest.Mock).mock.calls[0][0];
    expect(call.paye).toBeGreaterThan(0);
    expect(call.nssf).toBeGreaterThan(0);
    expect(call.shif).toBeGreaterThan(0);
    expect(call.ahl).toBeGreaterThan(0);
    expect(call.netPay).toBeCloseTo(
      call.grossPay - call.paye - call.nssf - call.shif - call.ahl,
      2,
    );
  });

  it("reduces gross pay for unpaid leave days", async () => {
    (LeaveRequests.getApprovedUnpaidLeaveDays as jest.Mock).mockResolvedValue({
      unpaidLeaveDays: 5,
    });

    await generatePayslip(input);

    const call = (Payslips.createPayslip as jest.Mock).mock.calls[0][0];
    // 23 weekdays in July 2026, 5 unpaid -> 18/23 of salary
    expect(call.grossPay).toBeCloseTo((100000 / 23) * 18, 2);
    expect(call.unpaidLeaveDays).toBe(5);
    expect(call.grossPay).toBeLessThan(100000);
  });

  it("skips statutory deductions for contract employees but still prorates for unpaid leave", async () => {
    (Employees.getEmployeeById as jest.Mock).mockResolvedValue({
      employee: { ...employee, employment_type: "contract" },
    });
    (LeaveRequests.getApprovedUnpaidLeaveDays as jest.Mock).mockResolvedValue({
      unpaidLeaveDays: 5,
    });

    await generatePayslip(input);

    const call = (Payslips.createPayslip as jest.Mock).mock.calls[0][0];
    expect(call.paye).toBe(0);
    expect(call.nssf).toBe(0);
    expect(call.shif).toBe(0);
    expect(call.ahl).toBe(0);
    expect(call.grossPay).toBeLessThan(100000);
    expect(call.netPay).toBe(call.grossPay);
  });

  it("starts at version 1 when no prior payslip exists for the period", async () => {
    await generatePayslip(input);

    expect(Payslips.createPayslip).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1 }),
    );
  });

  it("increments the version when a prior payslip exists for the period", async () => {
    (Payslips.getLatestPayslipForEmployee as jest.Mock).mockResolvedValue({
      payslip: { version: 2 },
    });

    await generatePayslip(input);

    expect(Payslips.createPayslip).toHaveBeenCalledWith(
      expect.objectContaining({ version: 3 }),
    );
  });

  it("returns the created payslip on success", async () => {
    const result = await generatePayslip(input);

    expect(result.payslip).toMatchObject({ id: "payslip-1" });
  });
});
