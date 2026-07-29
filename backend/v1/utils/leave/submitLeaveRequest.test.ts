import { submitLeaveRequest } from "./submitLeaveRequest.js";
import {
  Employees,
  LeaveBalances,
  LeaveRequests,
  LeaveTypes,
  PublicHolidays,
  Roles,
} from "../../database/utils/database.js";
import type { EmployeeId } from "../../types.js";

jest.mock("../../database/utils/database.js", () => ({
  Employees: { getEmployeeById: jest.fn() },
  LeaveBalances: { getLeaveBalance: jest.fn() },
  LeaveRequests: { createLeaveRequest: jest.fn() },
  LeaveTypes: { getAllLeaveTypes: jest.fn() },
  PublicHolidays: { getHolidayDatesInRange: jest.fn() },
  Roles: { getTeamManagerUserId: jest.fn(), getHrAdminUserId: jest.fn() },
}));

function daysFromNow(n: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

const employee = {
  id: "employee-1" as EmployeeId,
  user_id: "user-employee-1",
  team_id: "team-1",
  manager_id: null as string | null,
};

const annualLeaveType = {
  id: "leave-type-annual",
  code: "annual",
  notice_days_required: 7,
  requires_cover: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  (Employees.getEmployeeById as jest.Mock).mockResolvedValue({ employee });
  (LeaveTypes.getAllLeaveTypes as jest.Mock).mockResolvedValue({
    leaveTypes: [annualLeaveType],
  });
  (PublicHolidays.getHolidayDatesInRange as jest.Mock).mockResolvedValue({
    holidayDates: [],
  });
  (LeaveBalances.getLeaveBalance as jest.Mock).mockResolvedValue({
    leaveBalance: { remaining: 20 },
  });
  (Roles.getTeamManagerUserId as jest.Mock).mockResolvedValue({
    userId: null,
  });
  (Roles.getHrAdminUserId as jest.Mock).mockResolvedValue({ userId: null });
  (LeaveRequests.createLeaveRequest as jest.Mock).mockImplementation(
    async (input) => ({ leaveRequest: { ...input, status: "pending" } }),
  );
});

describe("submitLeaveRequest", () => {
  it("rejects when the employee does not exist", async () => {
    (Employees.getEmployeeById as jest.Mock).mockResolvedValue({
      employee: null,
    });

    const result = await submitLeaveRequest({
      employeeId: "missing" as EmployeeId,
      leaveTypeId: annualLeaveType.id,
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
      coverEmployeeId: "cover-1" as EmployeeId,
    });

    expect(result).toEqual({ leaveRequest: null, error: "employee_not_found" });
  });

  it("rejects when not enough notice is given", async () => {
    const result = await submitLeaveRequest({
      employeeId: employee.id,
      leaveTypeId: annualLeaveType.id,
      startDate: daysFromNow(2),
      endDate: daysFromNow(3),
      coverEmployeeId: "cover-1" as EmployeeId,
    });

    expect(result).toEqual({
      leaveRequest: null,
      error: "insufficient_notice",
    });
    expect(LeaveRequests.createLeaveRequest).not.toHaveBeenCalled();
  });

  it("rejects when the leave type requires a cover employee and none is given", async () => {
    const result = await submitLeaveRequest({
      employeeId: employee.id,
      leaveTypeId: annualLeaveType.id,
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
    });

    expect(result).toEqual({ leaveRequest: null, error: "cover_required" });
  });

  it("rejects when working days exceed the remaining balance", async () => {
    (LeaveBalances.getLeaveBalance as jest.Mock).mockResolvedValue({
      leaveBalance: { remaining: 0 },
    });

    const result = await submitLeaveRequest({
      employeeId: employee.id,
      leaveTypeId: annualLeaveType.id,
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
      coverEmployeeId: "cover-1" as EmployeeId,
    });

    expect(result).toEqual({
      leaveRequest: null,
      error: "insufficient_balance",
    });
  });

  it("skips the balance check for unpaid leave", async () => {
    (LeaveTypes.getAllLeaveTypes as jest.Mock).mockResolvedValue({
      leaveTypes: [
        { id: "leave-type-unpaid", code: "unpaid", notice_days_required: 0, requires_cover: false },
      ],
    });
    (Roles.getHrAdminUserId as jest.Mock).mockResolvedValue({
      userId: "hr-user-1",
    });

    await submitLeaveRequest({
      employeeId: employee.id,
      leaveTypeId: "leave-type-unpaid",
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
    });

    expect(LeaveBalances.getLeaveBalance).not.toHaveBeenCalled();
    expect(LeaveRequests.createLeaveRequest).toHaveBeenCalled();
  });

  it("uses the employee's direct manager as approver when set", async () => {
    (Employees.getEmployeeById as jest.Mock).mockImplementation(async (id) => {
      if (id === employee.id) {
        return { employee: { ...employee, manager_id: "manager-employee-1" } };
      }
      if (id === "manager-employee-1") {
        return { employee: { id, user_id: "manager-user-1" } };
      }
      return { employee: null };
    });

    await submitLeaveRequest({
      employeeId: employee.id,
      leaveTypeId: annualLeaveType.id,
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
      coverEmployeeId: "cover-1" as EmployeeId,
    });

    expect(LeaveRequests.createLeaveRequest).toHaveBeenCalledWith(
      expect.objectContaining({ approverId: "manager-user-1" }),
    );
  });

  it("falls back to the team manager when no direct manager is set", async () => {
    (Roles.getTeamManagerUserId as jest.Mock).mockResolvedValue({
      userId: "team-manager-user-1",
    });

    await submitLeaveRequest({
      employeeId: employee.id,
      leaveTypeId: annualLeaveType.id,
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
      coverEmployeeId: "cover-1" as EmployeeId,
    });

    expect(Roles.getTeamManagerUserId).toHaveBeenCalledWith(employee.team_id);
    expect(LeaveRequests.createLeaveRequest).toHaveBeenCalledWith(
      expect.objectContaining({ approverId: "team-manager-user-1" }),
    );
  });

  it("falls back to HR when there is no manager or team manager", async () => {
    (Roles.getHrAdminUserId as jest.Mock).mockResolvedValue({
      userId: "hr-user-1",
    });

    await submitLeaveRequest({
      employeeId: employee.id,
      leaveTypeId: annualLeaveType.id,
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
      coverEmployeeId: "cover-1" as EmployeeId,
    });

    expect(LeaveRequests.createLeaveRequest).toHaveBeenCalledWith(
      expect.objectContaining({ approverId: "hr-user-1" }),
    );
  });

  it("rejects when no approver can be determined at all", async () => {
    const result = await submitLeaveRequest({
      employeeId: employee.id,
      leaveTypeId: annualLeaveType.id,
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
      coverEmployeeId: "cover-1" as EmployeeId,
    });

    expect(result).toEqual({
      leaveRequest: null,
      error: "no_approver_available",
    });
  });

  it("creates a pending leave request on the happy path", async () => {
    (Roles.getHrAdminUserId as jest.Mock).mockResolvedValue({
      userId: "hr-user-1",
    });

    const result = await submitLeaveRequest({
      employeeId: employee.id,
      leaveTypeId: annualLeaveType.id,
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
      coverEmployeeId: "cover-1" as EmployeeId,
    });

    expect(LeaveRequests.createLeaveRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: employee.id,
        approverId: "hr-user-1",
      }),
    );
    expect(result.leaveRequest).toMatchObject({ status: "pending" });
  });
});
