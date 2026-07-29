import { Employees, LeaveRequests } from "../../database/utils/database.js";
import type { EmployeeId } from "../../types.js";

const LOW_CAPACITY_THRESHOLD = 60;

export function calculateCapacityPercentage(
  teamSize: number,
  employeesOnLeave: number,
): number {
  if (teamSize <= 0) return 0;

  const available = Math.max(teamSize - employeesOnLeave, 0);
  return Math.round((available / teamSize) * 100);
}

export async function getTeamRoster(teamId: string): Promise<EmployeeId[]> {
  const { employees } = await Employees.getAllEmployees({
    team: teamId,
    isActive: true,
  });

  return employees.map((employee) => employee.id as EmployeeId);
}

export async function countApprovedOverlappingLeave(
  teamEmployeeIds: EmployeeId[],
  startDate: string,
  endDate: string,
): Promise<number> {
  const { employeeIds } = await LeaveRequests.getApprovedOverlappingEmployeeIds({
    employeeIds: teamEmployeeIds,
    startDate,
    endDate,
  });

  return employeeIds.length;
}

export async function checkTeamCoverage({
  employeeId,
  startDate,
  endDate,
  workingDaysCount,
}: {
  employeeId: EmployeeId;
  startDate: string;
  endDate: string;
  workingDaysCount: number;
}) {
  const { employee } = await Employees.getEmployeeById(employeeId);
  const teamEmployeeIds = await getTeamRoster(employee!.team_id);
  const teamSize = teamEmployeeIds.length;

  const alreadyOnLeave = await countApprovedOverlappingLeave(
    teamEmployeeIds,
    startDate,
    endDate,
  );

  // +1 simulates this specific pending request being approved.
  const employeesOnLeave = alreadyOnLeave + 1;
  const capacityPercentage = calculateCapacityPercentage(
    teamSize,
    employeesOnLeave,
  );

  const warning =
    capacityPercentage < LOW_CAPACITY_THRESHOLD
      ? `If you approve this leave request, your team will operate at ${capacityPercentage}% capacity for ${workingDaysCount} day(s).`
      : null;

  return { teamSize, employeesOnLeave, capacityPercentage, warning };
}
