// Generates one completed payroll round (June 2026 — a full month before
// any seeded start_date matters and before "today" in this dataset). Every
// seeded employee is a full-month, non-prorated case (no unpaid leave in
// this period), so gross pay is just the monthly salary.
//
// Deduction math below mirrors v1/utils/payroll/deductions.ts exactly and
// must be kept in sync with it — duplicated here because seed files run as
// plain ESM under `knex seed:run` (no TypeScript build step), so the actual
// .ts implementation can't be imported directly.
import taxRates from "../utils/config/taxRate.js";

const PERIOD_MONTH = 6;
const PERIOD_YEAR = 2026;

function round2(value) {
  return Math.round(value * 100) / 100;
}

function calculatePaye(grossPay) {
  let tax = 0;
  let lowerBound = 0;

  for (const band of taxRates.PAYE_BANDS) {
    if (grossPay <= lowerBound) break;
    const taxableInBand = Math.min(grossPay, band.upTo) - lowerBound;
    tax += taxableInBand * band.rate;
    lowerBound = band.upTo;
  }

  if (tax - taxRates.PERSONAL_RELIEF <= 0) return round2(0);
  return round2(tax - taxRates.PERSONAL_RELIEF);
}

function calculateNssf(grossPay) {
  const tier1 =
    grossPay <= taxRates.NSSF_TIER1_CEILING
      ? grossPay * taxRates.NSSF_TIER1_RATE
      : taxRates.NSSF_TIER1_CEILING * taxRates.NSSF_TIER1_RATE;

  let tier2 = 0;
  if (grossPay > taxRates.NSSF_TIER1_CEILING) {
    let tier2Amount = grossPay - taxRates.NSSF_TIER1_CEILING;
    const tier2MaxAmount = taxRates.NSSF_TIER2_CEILING - taxRates.NSSF_TIER1_CEILING;
    if (tier2Amount > tier2MaxAmount) tier2Amount = tier2MaxAmount;
    tier2 = tier2Amount * taxRates.NSSF_TIER2_RATE;
  }

  let total = tier1 + tier2;
  if (total > taxRates.NSSF_MAX_TOTAL) total = taxRates.NSSF_MAX_TOTAL;
  return round2(total);
}

function getPeriodBounds(periodMonth, periodYear) {
  const periodStart = `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`;
  const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0)).toISOString().slice(0, 10);
  return { periodStart, periodEnd };
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  const hrAdmin = await knex("users").where({ email: "hr@gmail.com" }).first();

  if (!hrAdmin) {
    throw new Error("Seed order error: hr_admin not found — run 02_hr_admin.js first");
  }

  const { periodEnd } = getPeriodBounds(PERIOD_MONTH, PERIOD_YEAR);

  const employees = await knex("employees")
    .where({ deleted: false, is_active: true })
    .where("start_date", "<=", periodEnd);

  for (const employee of employees) {
    const existing = await knex("payslips")
      .where({ employee_id: employee.id, period_month: PERIOD_MONTH, period_year: PERIOD_YEAR })
      .first();
    if (existing) continue;

    const grossPay = round2(Number(employee.salary));
    const isContract = employee.employment_type === "contract";

    const paye = isContract ? 0 : calculatePaye(grossPay);
    const nssf = isContract ? 0 : calculateNssf(grossPay);
    const shif = isContract ? 0 : round2(grossPay * taxRates.SHIF_RATE);
    const ahl = isContract ? 0 : round2(grossPay * taxRates.AHL_RATE);
    const netPay = round2(grossPay - paye - nssf - shif - ahl);

    await knex("payslips").insert({
      employee_id: employee.id,
      period_month: PERIOD_MONTH,
      period_year: PERIOD_YEAR,
      gross_pay: grossPay,
      unpaid_leave_days: 0,
      nssf,
      shif,
      ahl,
      paye,
      net_pay: netPay,
      version: 1,
      generated_at: knex.fn.now(),
      generated_by: hrAdmin.id,
    });
  }
}
