import request from "supertest";
import { buildTestApp } from "./helpers/testApp.js";
import { mintAccessToken, authHeader } from "./helpers/auth.js";
import { resetFixture, db } from "./helpers/db.js";
import { TEAM_ENGINEERING } from "../../seeds/test/01_teams.js";
import {
  USER_MANAGER,
  USER_HR,
  USER_EMPLOYEE_A,
  ROLE_MANAGER,
  ROLE_HR,
  ROLE_EMPLOYEE_A,
} from "../../seeds/test/02_users.js";
import { EMPLOYEE_A } from "../../seeds/test/03_employees.js";

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
  { id: ROLE_MANAGER, role: "manager", team_id: TEAM_ENGINEERING },
]);
const employeeAToken = mintAccessToken(
  USER_EMPLOYEE_A,
  "employee-a@fixture.test",
  [{ id: ROLE_EMPLOYEE_A, role: "employee", team_id: TEAM_ENGINEERING }],
);

beforeEach(async () => {
  await resetFixture();
}, 20000);

afterAll(async () => {
  await db.destroy();
});

describe("DELETE /v1/employees/:employeeId", () => {
  it("lets an hr_admin soft-delete an employee", async () => {
    const res = await request(app)
      .delete(`/v1/employees/${EMPLOYEE_A}`)
      .set(authHeader(hrToken));

    expect(res.status).toBe(200);
    expect(res.body.data.response.employee.id).toBe(EMPLOYEE_A);

    const row = await db("employees").where({ id: EMPLOYEE_A }).first();
    expect(row.deleted).toBe(true);
  });

  it("excludes the soft-deleted employee from the list and detail endpoints", async () => {
    await request(app)
      .delete(`/v1/employees/${EMPLOYEE_A}`)
      .set(authHeader(hrToken));

    const listRes = await request(app)
      .get("/v1/employees")
      .set(authHeader(hrToken));
    const ids = listRes.body.data.response.employees.map(
      (employee: { id: string }) => employee.id,
    );
    expect(ids).not.toContain(EMPLOYEE_A);

    const detailRes = await request(app)
      .get(`/v1/employees/${EMPLOYEE_A}`)
      .set(authHeader(hrToken));
    expect(detailRes.status).toBe(404);
  });

  it("rejects a manager", async () => {
    const res = await request(app)
      .delete(`/v1/employees/${EMPLOYEE_A}`)
      .set(authHeader(managerToken));

    expect(res.status).toBe(403);
  });

  it("rejects an employee", async () => {
    const res = await request(app)
      .delete(`/v1/employees/${EMPLOYEE_A}`)
      .set(authHeader(employeeAToken));

    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent employee", async () => {
    const res = await request(app)
      .delete("/v1/employees/00000000-0000-0000-0000-000000000000")
      .set(authHeader(hrToken));

    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting an already-deleted employee", async () => {
    await request(app)
      .delete(`/v1/employees/${EMPLOYEE_A}`)
      .set(authHeader(hrToken));

    const res = await request(app)
      .delete(`/v1/employees/${EMPLOYEE_A}`)
      .set(authHeader(hrToken));

    expect(res.status).toBe(404);
  });
});
