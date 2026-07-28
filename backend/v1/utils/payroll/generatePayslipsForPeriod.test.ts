import { generatePayslipsForPeriod } from "./generatePayslipsForPeriod.js";
import { Employees } from "../../database/utils/database.js";
import { generatePayslip } from "./generatePayslip.js";
import type { EmployeeId, UserId } from "../../types.js";

jest.mock("../../database/utils/database.js", () => ({
  Employees: {
    getActiveEmployeesForPeriod: jest.fn(),
  },
}));

jest.mock("./generatePayslip.js", () => ({
  generatePayslip: jest.fn(),
}));

const generatedBy = "user-1" as UserId;

const input = {
  periodMonth: 7,
  periodYear: 2026,
  generatedBy,
};

const employeeA = { id: "employee-a" as EmployeeId };
const employeeB = { id: "employee-b" as EmployeeId };

beforeEach(() => {
  jest.clearAllMocks();
  (Employees.getActiveEmployeesForPeriod as jest.Mock).mockResolvedValue({
    employees: [],
  });
});

describe("generatePayslipsForPeriod", () => {
  it("returns an empty batch when there are no active employees", async () => {
    const result = await generatePayslipsForPeriod(input);

    expect(result).toEqual({ payslips: [], errors: [] });
    expect(generatePayslip).not.toHaveBeenCalled();
  });

  it("generates a payslip for every active employee", async () => {
    (Employees.getActiveEmployeesForPeriod as jest.Mock).mockResolvedValue({
      employees: [employeeA, employeeB],
    });
    (generatePayslip as jest.Mock).mockImplementation(
      async ({ employeeId }) => ({
        payslip: { id: `payslip-${employeeId}`, employeeId },
      }),
    );

    const result = await generatePayslipsForPeriod(input);

    expect(generatePayslip).toHaveBeenCalledTimes(2);
    expect(generatePayslip).toHaveBeenNthCalledWith(1, {
      employeeId: employeeA.id,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      generatedBy,
    });
    expect(generatePayslip).toHaveBeenNthCalledWith(2, {
      employeeId: employeeB.id,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      generatedBy,
    });
    expect(result.payslips).toEqual([
      { id: `payslip-${employeeA.id}`, employeeId: employeeA.id },
      { id: `payslip-${employeeB.id}`, employeeId: employeeB.id },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("collects an error when a single employee's payslip generation fails", async () => {
    (Employees.getActiveEmployeesForPeriod as jest.Mock).mockResolvedValue({
      employees: [employeeA],
    });
    (generatePayslip as jest.Mock).mockResolvedValue({
      payslip: null,
      error: "employee_not_found",
    });

    const result = await generatePayslipsForPeriod(input);

    expect(result.payslips).toEqual([]);
    expect(result.errors).toEqual([
      { employeeId: employeeA.id, error: "employee_not_found" },
    ]);
  });

  it("isolates failures in a mixed batch, keeping successes and continuing past failures", async () => {
    (Employees.getActiveEmployeesForPeriod as jest.Mock).mockResolvedValue({
      employees: [employeeA, employeeB],
    });
    (generatePayslip as jest.Mock).mockImplementation(
      async ({ employeeId }) => {
        if (employeeId === employeeA.id) {
          return { payslip: null, error: "employee_not_found" };
        }
        return { payslip: { id: "payslip-b", employeeId } };
      },
    );

    const result = await generatePayslipsForPeriod(input);

    expect(generatePayslip).toHaveBeenCalledTimes(2);
    expect(result.payslips).toEqual([{ id: "payslip-b", employeeId: employeeB.id }]);
    expect(result.errors).toEqual([
      { employeeId: employeeA.id, error: "employee_not_found" },
    ]);
  });

  it("reports an error for every employee when all fail", async () => {
    (Employees.getActiveEmployeesForPeriod as jest.Mock).mockResolvedValue({
      employees: [employeeA, employeeB],
    });
    (generatePayslip as jest.Mock).mockResolvedValue({
      payslip: null,
      error: "employee_not_found",
    });

    const result = await generatePayslipsForPeriod(input);

    expect(result.payslips).toEqual([]);
    expect(result.errors).toEqual([
      { employeeId: employeeA.id, error: "employee_not_found" },
      { employeeId: employeeB.id, error: "employee_not_found" },
    ]);
  });

  it("catches a rejected generatePayslip call and reports it as an error instead of throwing", async () => {
    (Employees.getActiveEmployeesForPeriod as jest.Mock).mockResolvedValue({
      employees: [employeeA, employeeB],
    });
    const thrown = new Error("db connection lost");
    (generatePayslip as jest.Mock).mockImplementation(
      async ({ employeeId }) => {
        if (employeeId === employeeA.id) {
          throw thrown;
        }
        return { payslip: { id: "payslip-b", employeeId } };
      },
    );

    const result = await generatePayslipsForPeriod(input);

    expect(result.payslips).toEqual([{ id: "payslip-b", employeeId: employeeB.id }]);
    expect(result.errors).toEqual([{ employeeId: employeeA.id, error: thrown }]);
  });

  it("preserves the original error value/shape unchanged", async () => {
    (Employees.getActiveEmployeesForPeriod as jest.Mock).mockResolvedValue({
      employees: [employeeA],
    });
    const dbError = { code: "ECONNRESET" };
    (generatePayslip as jest.Mock).mockResolvedValue({
      payslip: null,
      error: dbError,
    });

    const result = await generatePayslipsForPeriod(input);

    expect(result.errors[0]?.error).toBe(dbError);
  });
});
