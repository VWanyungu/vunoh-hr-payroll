import request from "supertest";
import { buildTestApp } from "./helpers/testApp.js";
import { mintAccessToken, authHeader } from "./helpers/auth.js";
import { resetFixture, db } from "./helpers/db.js";
import {
  USER_MANAGER,
  USER_HR,
  USER_EMPLOYEE_A,
  USER_EMPLOYEE_D,
  ROLE_MANAGER,
  ROLE_HR,
  ROLE_EMPLOYEE_A,
  ROLE_EMPLOYEE_D,
} from "../../seeds/test/02_users.js";
import { EMPLOYEE_A, EMPLOYEE_D } from "../../seeds/test/03_employees.js";
import { LEAVE_TYPE_UNPAID } from "../../seeds/test/04_leave_types.js";
import { calculateProration } from "../../utils/payroll/proration.js";
import { calculateDeduction } from "../../utils/payroll/deductions.js";
import { getPeriodBounds } from "../../utils/payroll/period.js";

// mocks Redis check and the file logger
jest.mock("../../database/utils/cache.js", () => ({
  Cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../../utils/logger.js", () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const app = buildTestApp();

const hrToken = mintAccessToken(USER_HR, "hr@fixture.test", [
  { id: ROLE_HR, role: "hr_admin", team_id: null },
]);
const managerToken = mintAccessToken(USER_MANAGER, "manager1@fixture.test", [
  { id: ROLE_MANAGER, role: "manager", team_id: null },
]);
const employeeAToken = mintAccessToken(
  USER_EMPLOYEE_A,
  "employee-a@fixture.test",
  [{ id: ROLE_EMPLOYEE_A, role: "employee", team_id: null }],
);
const employeeDToken = mintAccessToken(
  USER_EMPLOYEE_D,
  "employee-d@fixture.test",
  [{ id: ROLE_EMPLOYEE_D, role: "employee", team_id: null }],
);

const PERIOD_MONTH = 6;
const PERIOD_YEAR = 2026;
const ACTIVE_EMPLOYEE_COUNT = 5;

function expectedNetPay(grossPay: number) {
  const paye = calculateDeduction("PAYE", grossPay);
  const nssf = calculateDeduction("NSSF", grossPay);
  const shif = calculateDeduction("SHIF", grossPay);
  const ahl = calculateDeduction("AHL", grossPay);
  return Math.round((grossPay - paye - nssf - shif - ahl) * 100) / 100;
}

beforeEach(async () => {
  await resetFixture();
}, 20000);

afterAll(async () => {
  await db.destroy();
});

describe("Happy path — initiate payroll run", () => {
  it("generates a payslip for every active employee and persists it", async () => {
    const res = await request(app)
      .post("/v1/payroll-runs")
      .set(authHeader(hrToken))
      .send({ periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });

    expect(res.status).toBe(200);
    const { payslips, errors } = res.body.data.response;
    expect(errors).toHaveLength(0);
    expect(payslips).toHaveLength(ACTIVE_EMPLOYEE_COUNT);

    const employeeAPayslip = payslips.find(
      (p: { employee_id: string }) => p.employee_id === EMPLOYEE_A,
    );
    expect(employeeAPayslip.gross_pay).toBe("60000.00");
    expect(Number(employeeAPayslip.net_pay)).toBe(expectedNetPay(60000));
    expect(employeeAPayslip.version).toBe(1);

    const row = await db("payslips")
      .where({
        employee_id: EMPLOYEE_A,
        period_month: PERIOD_MONTH,
        period_year: PERIOD_YEAR,
      })
      .first();
    expect(row).toBeDefined();
    expect(row.version).toBe(1);
    expect(row.generated_by).toBe(USER_HR);
  });
});

describe("Regeneration / versioning", () => {
  it("increments the version on a second run for the same period", async () => {
    await request(app)
      .post("/v1/payroll-runs")
      .set(authHeader(hrToken))
      .send({ periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });

    const secondRun = await request(app)
      .post("/v1/payroll-runs")
      .set(authHeader(hrToken))
      .send({ periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });

    expect(secondRun.status).toBe(200);
    const { payslips } = secondRun.body.data.response;
    expect(payslips).toHaveLength(ACTIVE_EMPLOYEE_COUNT);
    for (const payslip of payslips) {
      expect(payslip.version).toBe(2);
    }

    const latestRes = await request(app)
      .get("/v1/payslips/latest")
      .query({
        employeeId: EMPLOYEE_A,
        periodMonth: PERIOD_MONTH,
        periodYear: PERIOD_YEAR,
      })
      .set(authHeader(hrToken));

    expect(latestRes.status).toBe(200);
    expect(latestRes.body.data.response.payslip.version).toBe(2);
  });
});

describe("Unpaid leave reduces net pay", () => {
  it("prorates gross pay down for approved unpaid leave inside the period", async () => {
    const { periodStart, periodEnd } = getPeriodBounds(
      PERIOD_MONTH,
      PERIOD_YEAR,
    );
    const fullPeriodGross = calculateProration({
      salary: 60000,
      periodStart,
      periodEnd,
      unpaidLeaveDays: 0,
    });

    await db("leave_requests").insert({
      employee_id: EMPLOYEE_A,
      leave_type_id: LEAVE_TYPE_UNPAID,
      start_date: "2026-06-08",
      end_date: "2026-06-12",
      working_days_count: 5,
      status: "approved",
      requested_at: new Date().toISOString(),
      decided_at: new Date().toISOString(),
    });

    const res = await request(app)
      .post("/v1/payroll-runs")
      .set(authHeader(hrToken))
      .send({ periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });

    expect(res.status).toBe(200);
    const { payslips } = res.body.data.response;
    const employeeAPayslip = payslips.find(
      (p: { employee_id: string }) => p.employee_id === EMPLOYEE_A,
    );

    expect(employeeAPayslip.unpaid_leave_days).toBe(5);
    expect(Number(employeeAPayslip.gross_pay)).toBeLessThan(fullPeriodGross);
  });
});

describe("Payslip retrieval scoping", () => {
  beforeEach(async () => {
    await request(app)
      .post("/v1/payroll-runs")
      .set(authHeader(hrToken))
      .send({ periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });
  });

  it("scopes a non-privileged caller to their own payslips regardless of the employeeId query param", async () => {
    const res = await request(app)
      .get("/v1/payslips")
      .query({ employeeId: EMPLOYEE_D, periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR })
      .set(authHeader(employeeAToken));

    expect(res.status).toBe(200);
    const { payslips } = res.body.data.response;
    expect(payslips).toHaveLength(1);
    expect(payslips[0].employee_id).toBe(EMPLOYEE_A);
  });

  it("lets a privileged caller filter by any employeeId", async () => {
    const res = await request(app)
      .get("/v1/payslips")
      .query({ employeeId: EMPLOYEE_D, periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR })
      .set(authHeader(hrToken));

    expect(res.status).toBe(200);
    const { payslips } = res.body.data.response;
    expect(payslips).toHaveLength(1);
    expect(payslips[0].employee_id).toBe(EMPLOYEE_D);
  });

  it("400s /latest for a privileged caller that omits employeeId", async () => {
    const res = await request(app)
      .get("/v1/payslips/latest")
      .query({ periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR })
      .set(authHeader(hrToken));

    expect(res.status).toBe(400);
  });

  it("returns payslip: null for a non-privileged caller with no matching period", async () => {
    const res = await request(app)
      .get("/v1/payslips/latest")
      .query({ periodMonth: 1, periodYear: 2020 })
      .set(authHeader(employeeDToken));

    expect(res.status).toBe(200);
    expect(res.body.data.response.payslip).toBeNull();
  });
});

describe("Authorization boundaries", () => {
  it("403s a manager attempting to initiate a payroll run", async () => {
    const res = await request(app)
      .post("/v1/payroll-runs")
      .set(authHeader(managerToken))
      .send({ periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });

    expect(res.status).toBe(403);
  });

  it("403s a plain employee attempting to initiate a payroll run", async () => {
    const res = await request(app)
      .post("/v1/payroll-runs")
      .set(authHeader(employeeAToken))
      .send({ periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });

    expect(res.status).toBe(403);
  });

  it("401s an unauthenticated payroll run request", async () => {
    const res = await request(app)
      .post("/v1/payroll-runs")
      .send({ periodMonth: PERIOD_MONTH, periodYear: PERIOD_YEAR });

    expect(res.status).toBe(401);
  });
});

describe("Business-rule rejections at submission", () => {
  it("400s a missing periodMonth and writes no payslips", async () => {
    const before = await db("payslips").count("* as total");

    const res = await request(app)
      .post("/v1/payroll-runs")
      .set(authHeader(hrToken))
      .send({ periodYear: PERIOD_YEAR });

    expect(res.status).toBe(400);

    const after = await db("payslips").count("* as total");
    expect(after[0]!.total).toBe(before[0]!.total);
  });

  it("400s an out-of-range periodMonth", async () => {
    const res = await request(app)
      .post("/v1/payroll-runs")
      .set(authHeader(hrToken))
      .send({ periodMonth: 13, periodYear: PERIOD_YEAR });

    expect(res.status).toBe(400);
  });

  it("400s a missing periodYear", async () => {
    const res = await request(app)
      .post("/v1/payroll-runs")
      .set(authHeader(hrToken))
      .send({ periodMonth: PERIOD_MONTH });

    expect(res.status).toBe(400);
  });
});
