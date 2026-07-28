import {
  Employees,
  LeaveRequests,
  Payslips,
} from "../../database/utils/database.js";
import { calculateProration } from "./proration.js";
import { calculateDeduction } from "./deductions.js";
import { getPeriodBounds } from "./period.js";
import type { EmployeeId, UserId } from "../../types.js";

export type GeneratePayslipInput = {
  employeeId: EmployeeId;
  periodMonth: number;
  periodYear: number;
  generatedBy: UserId;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function generatePayslip(input: GeneratePayslipInput) {
  const { employee } = await Employees.getEmployeeById(input.employeeId);
  if (!employee) {
    return { payslip: null, error: "employee_not_found" as const };
  }

  const { periodStart, periodEnd } = getPeriodBounds(
    input.periodMonth,
    input.periodYear,
  );

  const { unpaidLeaveDays } = await LeaveRequests.getApprovedUnpaidLeaveDays({
    employeeId: input.employeeId,
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
  });

  const grossPay = calculateProration({
    salary: employee.salary,
    periodStart,
    periodEnd,
    joinDate: employee.start_date,
    unpaidLeaveDays,
  });

  const isContract = employee.employment_type === "contract";

  const paye = isContract ? 0 : calculateDeduction("PAYE", grossPay);
  const nssf = isContract ? 0 : calculateDeduction("NSSF", grossPay);
  const shif = isContract ? 0 : calculateDeduction("SHIF", grossPay);
  const ahl = isContract ? 0 : calculateDeduction("AHL", grossPay);

  const netPay = round2(grossPay - paye - nssf - shif - ahl);

  const { payslip: latest } = await Payslips.getLatestPayslipForEmployee({
    employeeId: input.employeeId,
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
  });
  const version = (latest?.version ?? 0) + 1;

  return Payslips.createPayslip({
    employeeId: input.employeeId,
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
    grossPay,
    unpaidLeaveDays,
    nssf,
    shif,
    ahl,
    paye,
    netPay,
    version,
    generatedAt: new Date().toISOString(),
    generatedBy: input.generatedBy,
  });
}
