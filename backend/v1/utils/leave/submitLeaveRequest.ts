import {
  Employees,
  LeaveBalances,
  LeaveRequests,
  LeaveTypes,
  PublicHolidays,
  Roles,
} from "../../database/utils/database.js";
import { countWorkingDays, toUTCDate } from "./workingDays.js";
import type { CreateLeaveRequestInput, EmployeeId, UserId } from "../../types.js";

// TODO(follow-up): team coverage check + surface a `warnings` array on the
// return value, and overlapping-request detection for the same employee.
export async function submitLeaveRequest(
  input: CreateLeaveRequestInput & {
    employeeId: EmployeeId;
    autoApprove?: boolean;
    requestedByUserId?: UserId;
  },
) {
  const { employee } = await Employees.getEmployeeById(input.employeeId);
  if (!employee) {
    return { leaveRequest: null, error: "employee_not_found" as const };
  }

  const { leaveTypes } = await LeaveTypes.getAllLeaveTypes({
    id: input.leaveTypeId,
  });
  const leaveType = leaveTypes?.[0];
  if (!leaveType) {
    return { leaveRequest: null, error: "invalid_leave_type" as const };
  }

  const noticeDaysGiven = Math.round(
    (toUTCDate(input.startDate).getTime() - toUTCDate(new Date()).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (noticeDaysGiven < (leaveType.notice_days_required ?? 0)) {
    return { leaveRequest: null, error: "insufficient_notice" as const };
  }

  if (leaveType.requires_cover && !input.coverEmployeeId) {
    return { leaveRequest: null, error: "cover_required" as const };
  }

  const { holidayDates } = await PublicHolidays.getHolidayDatesInRange(
    input.startDate,
    input.endDate,
  );

  const workingDaysCount = countWorkingDays(
    input.startDate,
    input.endDate,
    holidayDates,
  );

  if (leaveType.code !== "unpaid") {
    const year = new Date(input.startDate).getFullYear();
    const { leaveBalance: balance } = await LeaveBalances.getLeaveBalance({
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year,
    });

    if (!balance) {
      return { leaveRequest: null, error: "no_balance" as const };
    }
    if (balance.remaining < workingDaysCount) {
      return { leaveRequest: null, error: "insufficient_balance" as const };
    }
  }

  let approverId: UserId | null = null;

  if (employee.manager_id) {
    const { employee: manager } = await Employees.getEmployeeById(
      employee.manager_id,
    );
    approverId = manager?.user_id ?? null;
  }

  if (!approverId) {
    const { userId } = await Roles.getTeamManagerUserId(employee.team_id);
    approverId = userId;
  }

  if (!approverId) {
    const { userId } = await Roles.getHrAdminUserId();
    approverId = userId;
  }

  if (!approverId) {
    return { leaveRequest: null, error: "no_approver_available" as const };
  }

  const { leaveRequest, error } = await LeaveRequests.createLeaveRequest({
    ...input,
    workingDaysCount,
    approverId,
  });

  if (!leaveRequest || error) {
    return { leaveRequest, error };
  }

  if (input.autoApprove && input.requestedByUserId) {
    return LeaveRequests.approveLeaveRequest(
      leaveRequest.id,
      input.requestedByUserId,
    );
  }

  return { leaveRequest, error };
}
