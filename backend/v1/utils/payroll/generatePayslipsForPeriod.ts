import { Employees } from "../../database/utils/database.js";
import { generatePayslip } from "./generatePayslip.js";
import type { EmployeeId, UserId } from "../../types.js";

export type GeneratePayslipsForPeriodInput = {
  periodMonth: number;
  periodYear: number;
  generatedBy: UserId;
};

type CreatedPayslip = NonNullable<
  Awaited<ReturnType<typeof generatePayslip>>["payslip"]
>;

export async function generatePayslipsForPeriod(input: GeneratePayslipsForPeriodInput): Promise<{
  payslips: CreatedPayslip[];
  errors: { employeeId: EmployeeId; error: unknown }[];
}> {
  const { employees } = await Employees.getActiveEmployeesForPeriod({
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
  });

  const payslips: CreatedPayslip[] = [];
  const errors: { employeeId: EmployeeId; error: unknown }[] = [];

  for (const employee of employees) {
    try {
      const { payslip, error } = await generatePayslip({
        employeeId: employee.id,
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        generatedBy: input.generatedBy,
      });

      if (payslip) {
        payslips.push(payslip);
      } else {
        errors.push({ employeeId: employee.id, error });
      }
    } catch (error) {
      errors.push({ employeeId: employee.id, error });
    }
  }

  return { payslips, errors };
}
