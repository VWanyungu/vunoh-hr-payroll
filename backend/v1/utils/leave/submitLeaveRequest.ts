import { LeaveRequests, PublicHolidays } from "../../database/utils/database.js";
import { countWorkingDays } from "./workingDays.js";
import type { CreateLeaveRequestInput } from "../../types.js";

// TODO(follow-up): enforce leave-type policy before creating the request:
//   - notice_days_required lead time between requested_at and start_date
//   - requires_cover -> coverEmployeeId must be present
//   - overlapping-request detection for the same employee
//   - leave_balances sufficiency check
export async function submitLeaveRequest(
  input: CreateLeaveRequestInput & { employeeId: string },
) {
  const { holidayDates } = await PublicHolidays.getHolidayDatesInRange(
    input.startDate,
    input.endDate,
  );

  const workingDaysCount = countWorkingDays(
    input.startDate,
    input.endDate,
    holidayDates,
  );

  return LeaveRequests.createLeaveRequest({
    ...input,
    workingDaysCount,
  });
}
