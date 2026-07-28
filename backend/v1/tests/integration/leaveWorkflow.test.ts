import request from "supertest";
import { buildTestApp } from "./helpers/testApp.js";
import { mintAccessToken, authHeader } from "./helpers/auth.js";
import { resetFixture, db } from "./helpers/db.js";
import { TEAM_ENGINEERING, TEAM_OPS } from "../../seeds/test/01_teams.js";
import {
  USER_MANAGER,
  USER_MANAGER2,
  USER_HR,
  USER_EMPLOYEE_A,
  USER_EMPLOYEE_D,
  ROLE_MANAGER,
  ROLE_MANAGER2,
  ROLE_HR,
  ROLE_EMPLOYEE_A,
  ROLE_EMPLOYEE_D,
} from "../../seeds/test/02_users.js";
import { EMPLOYEE_A, EMPLOYEE_B } from "../../seeds/test/03_employees.js";
import {
  LEAVE_TYPE_ANNUAL,
  LEAVE_TYPE_SICK,
  LEAVE_TYPE_UNPAID,
} from "../../seeds/test/04_leave_types.js";
import {
  BALANCE_A_ANNUAL,
  BALANCE_D_ANNUAL,
} from "../../seeds/test/05_leave_balances.js";

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

const managerToken = mintAccessToken(USER_MANAGER, "manager1@fixture.test", [
  { id: ROLE_MANAGER, role: "manager", team_id: TEAM_ENGINEERING },
]);
const manager2Token = mintAccessToken(USER_MANAGER2, "manager2@fixture.test", [
  { id: ROLE_MANAGER2, role: "manager", team_id: TEAM_OPS },
]);
const hrToken = mintAccessToken(USER_HR, "hr@fixture.test", [
  { id: ROLE_HR, role: "hr_admin", team_id: null },
]);
const employeeAToken = mintAccessToken(
  USER_EMPLOYEE_A,
  "employee-a@fixture.test",
  [{ id: ROLE_EMPLOYEE_A, role: "employee", team_id: TEAM_ENGINEERING }],
);
const employeeDToken = mintAccessToken(
  USER_EMPLOYEE_D,
  "employee-d@fixture.test",
  [{ id: ROLE_EMPLOYEE_D, role: "employee", team_id: null }],
);

const annualHappyPathBody = {
  leaveTypeId: LEAVE_TYPE_ANNUAL,
  startDate: "2026-08-10",
  endDate: "2026-08-14",
  coverEmployeeId: EMPLOYEE_B,
};

beforeEach(async () => {
  await resetFixture();
}, 20000);

afterAll(async () => {
  await db.destroy();
});

describe("Happy path — manager-routed request", () => {
  it("submits, appears in the manager's queue, gets approved, and the balance reflects the deduction", async () => {
    const createRes = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send(annualHappyPathBody);

    expect(createRes.status).toBe(201);
    const created = createRes.body.data.response.leaveRequest;
    expect(created.status).toBe("pending");
    expect(created.approver_id).toBe(USER_MANAGER);

    const balanceAfterCreate = await db("leave_balances")
      .where({ id: BALANCE_A_ANNUAL })
      .first();
    expect(balanceAfterCreate.used).toBe(0);
    expect(balanceAfterCreate.remaining).toBe(21);

    const queueRes = await request(app)
      .get("/v1/leave-requests")
      .set(authHeader(managerToken));
    expect(queueRes.status).toBe(200);
    const queuedIds = queueRes.body.data.response.leaveRequests.map(
      (r: { id: string }) => r.id,
    );
    expect(queuedIds).toContain(created.id);

    const approveRes = await request(app)
      .post(`/v1/leave-requests/${created.id}/approve`)
      .set(authHeader(managerToken));
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.response.leaveRequest.status).toBe("approved");

    const balanceAfterApprove = await db("leave_balances")
      .where({ id: BALANCE_A_ANNUAL })
      .first();
    expect(balanceAfterApprove.used).toBe(5);
    expect(balanceAfterApprove.remaining).toBe(16);

    const balanceEndpointRes = await request(app)
      .get("/v1/leave-balances")
      .query({ leaveTypeId: LEAVE_TYPE_ANNUAL, year: 2026 })
      .set(authHeader(employeeAToken));
    expect(balanceEndpointRes.status).toBe(200);
    const [fetchedBalance] =
      balanceEndpointRes.body.data.response.leaveBalances;
    expect(fetchedBalance.used).toBe(5);
    expect(fetchedBalance.remaining).toBe(16);
  });
});

describe("Happy path — HR-routed request (no manager)", () => {
  it("routes to HR, excludes the manager's queue, and approves with identical balance math", async () => {
    const createRes = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeDToken))
      .send(annualHappyPathBody);

    expect(createRes.status).toBe(201);
    const created = createRes.body.data.response.leaveRequest;
    expect(created.approver_id).toBe(USER_HR);

    const managerQueueRes = await request(app)
      .get("/v1/leave-requests")
      .set(authHeader(managerToken));
    const managerIds = managerQueueRes.body.data.response.leaveRequests.map(
      (r: { id: string }) => r.id,
    );
    expect(managerIds).not.toContain(created.id);

    const hrQueueRes = await request(app)
      .get("/v1/leave-requests")
      .set(authHeader(hrToken));
    const hrIds = hrQueueRes.body.data.response.leaveRequests.map(
      (r: { id: string }) => r.id,
    );
    expect(hrIds).toContain(created.id);

    const approveRes = await request(app)
      .post(`/v1/leave-requests/${created.id}/approve`)
      .set(authHeader(hrToken));
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.response.leaveRequest.status).toBe("approved");

    const balance = await db("leave_balances")
      .where({ id: BALANCE_D_ANNUAL })
      .first();
    expect(balance.used).toBe(5);
    expect(balance.remaining).toBe(16);
  });
});

describe("Rejection path", () => {
  it("rejects a pending request and leaves the balance untouched", async () => {
    const createRes = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send(annualHappyPathBody);
    const created = createRes.body.data.response.leaveRequest;

    const rejectRes = await request(app)
      .post(`/v1/leave-requests/${created.id}/reject`)
      .set(authHeader(managerToken));

    expect(rejectRes.status).toBe(200);
    const rejected = rejectRes.body.data.response.leaveRequest;
    expect(rejected.status).toBe("rejected");
    expect(rejected.approver_id).toBe(USER_MANAGER);

    const balance = await db("leave_balances")
      .where({ id: BALANCE_A_ANNUAL })
      .first();
    expect(balance.used).toBe(0);
    expect(balance.remaining).toBe(21);
  });
});

describe("Cancellation path", () => {
  it("cancels a pending request and leaves the balance untouched", async () => {
    const createRes = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send(annualHappyPathBody);
    const created = createRes.body.data.response.leaveRequest;

    const cancelRes = await request(app)
      .post(`/v1/leave-requests/${created.id}/cancel`)
      .set(authHeader(employeeAToken));

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.response.leaveRequest.status).toBe("cancelled");

    const balance = await db("leave_balances")
      .where({ id: BALANCE_A_ANNUAL })
      .first();
    expect(balance.used).toBe(0);
    expect(balance.remaining).toBe(21);
  });

  it("refuses to cancel an already-approved request, leaving its balance deduction intact", async () => {
    const createRes = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send(annualHappyPathBody);
    const created = createRes.body.data.response.leaveRequest;

    const approveRes = await request(app)
      .post(`/v1/leave-requests/${created.id}/approve`)
      .set(authHeader(managerToken));
    expect(approveRes.status).toBe(200);

    const cancelRes = await request(app)
      .post(`/v1/leave-requests/${created.id}/cancel`)
      .set(authHeader(employeeAToken));
    expect(cancelRes.status).toBe(409);

    const row = await db("leave_requests").where({ id: created.id }).first();
    expect(row.status).toBe("approved");

    const balance = await db("leave_balances")
      .where({ id: BALANCE_A_ANNUAL })
      .first();
    expect(balance.used).toBe(5);
    expect(balance.remaining).toBe(16);
  });
});

describe("Authorization boundaries", () => {
  it("403s when a manager from a different team attempts to approve", async () => {
    const createRes = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send(annualHappyPathBody);
    const created = createRes.body.data.response.leaveRequest;

    const res = await request(app)
      .post(`/v1/leave-requests/${created.id}/approve`)
      .set(authHeader(manager2Token));

    expect(res.status).toBe(403);

    const row = await db("leave_requests").where({ id: created.id }).first();
    expect(row.status).toBe("pending");
  });

  it("403s when a plain employee attempts to approve", async () => {
    const createRes = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send(annualHappyPathBody);
    const created = createRes.body.data.response.leaveRequest;

    const res = await request(app)
      .post(`/v1/leave-requests/${created.id}/approve`)
      .set(authHeader(employeeAToken));

    expect(res.status).toBe(403);
  });

  it("lets HR approve a request that was routed to a manager", async () => {
    const createRes = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send(annualHappyPathBody);
    const created = createRes.body.data.response.leaveRequest;
    expect(created.approver_id).toBe(USER_MANAGER);

    const res = await request(app)
      .post(`/v1/leave-requests/${created.id}/approve`)
      .set(authHeader(hrToken));

    expect(res.status).toBe(200);
    expect(res.body.data.response.leaveRequest.status).toBe("approved");
  });

  it("401s an unauthenticated request", async () => {
    const res = await request(app).get("/v1/leave-requests");
    expect(res.status).toBe(401);
  });
});

describe("Business-rule rejections at submission", () => {
  it("rejects annual leave with insufficient notice and writes no row", async () => {
    const res = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send({
        leaveTypeId: LEAVE_TYPE_ANNUAL,
        startDate: "2026-07-29",
        endDate: "2026-07-29",
        coverEmployeeId: EMPLOYEE_B,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/notice/i);

    const rows = await db("leave_requests").where({ employee_id: EMPLOYEE_A });
    expect(rows).toHaveLength(0);
  });

  it("rejects annual leave for more days than the remaining balance and writes no row", async () => {
    const res = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send({
        leaveTypeId: LEAVE_TYPE_ANNUAL,
        startDate: "2026-09-07",
        endDate: "2026-10-09",
        coverEmployeeId: EMPLOYEE_B,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/balance/i);

    const rows = await db("leave_requests").where({ employee_id: EMPLOYEE_A });
    expect(rows).toHaveLength(0);
  });

  it("allows sick leave with zero notice", async () => {
    const res = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send({
        leaveTypeId: LEAVE_TYPE_SICK,
        startDate: "2026-07-28",
        endDate: "2026-07-28",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.response.leaveRequest.status).toBe("pending");
  });

  it("allows unpaid leave beyond the annual allocation, with no unpaid balance row required", async () => {
    const unpaidBalancesBefore = await db("leave_balances").where({
      employee_id: EMPLOYEE_A,
      leave_type_id: LEAVE_TYPE_UNPAID,
    });
    expect(unpaidBalancesBefore).toHaveLength(0);

    const res = await request(app)
      .post("/v1/leave-requests")
      .set(authHeader(employeeAToken))
      .send({
        leaveTypeId: LEAVE_TYPE_UNPAID,
        startDate: "2026-09-07",
        endDate: "2026-10-09",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.response.leaveRequest.status).toBe("pending");
  });
});
