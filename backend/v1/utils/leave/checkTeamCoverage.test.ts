import {
  checkTeamCoverage,
  calculateCapacityPercentage,
} from "./checkTeamCoverage.js";
import { Employees, LeaveRequests } from "../../database/utils/database.js";
import type { EmployeeId } from "../../types.js";

jest.mock("../../database/utils/database.js", () => ({
  Employees: { getEmployeeById: jest.fn(), getAllEmployees: jest.fn() },
  LeaveRequests: { getApprovedOverlappingEmployeeIds: jest.fn() },
}));

const employee = {
  id: "employee-1" as EmployeeId,
  team_id: "team-1",
};

function teamOfSize(size: number) {
  return Array.from({ length: size }, (_, i) => ({ id: `employee-${i}` }));
}

beforeEach(() => {
  jest.clearAllMocks();
  (Employees.getEmployeeById as jest.Mock).mockResolvedValue({ employee });
});

describe("calculateCapacityPercentage", () => {
  it("returns 100 when nobody is on leave", () => {
    expect(calculateCapacityPercentage(5, 0)).toBe(100);
  });

  it("rounds to the nearest whole percentage", () => {
    expect(calculateCapacityPercentage(3, 1)).toBe(67);
  });

  it("returns 0 when team size is 0", () => {
    expect(calculateCapacityPercentage(0, 0)).toBe(0);
  });

  it("clamps to 0 when more employees are on leave than the team size", () => {
    expect(calculateCapacityPercentage(2, 5)).toBe(0);
  });
});

describe("checkTeamCoverage", () => {
  it("returns no warning when capacity stays at exactly 60%", async () => {
    (Employees.getAllEmployees as jest.Mock).mockResolvedValue({
      employees: teamOfSize(5),
    });
    (LeaveRequests.getApprovedOverlappingEmployeeIds as jest.Mock).mockResolvedValue(
      { employeeIds: ["employee-0"] },
    );

    const result = await checkTeamCoverage({
      employeeId: employee.id,
      startDate: "2026-08-03",
      endDate: "2026-08-07",
      workingDaysCount: 5,
    });

    // 1 already approved + 1 for this request = 2 of 5 out -> exactly 60%.
    expect(result.teamSize).toBe(5);
    expect(result.employeesOnLeave).toBe(2);
    expect(result.capacityPercentage).toBe(60);
    expect(result.warning).toBeNull();
  });

  it("returns a warning when approving would drop capacity below 60%", async () => {
    (Employees.getAllEmployees as jest.Mock).mockResolvedValue({
      employees: teamOfSize(5),
    });
    (LeaveRequests.getApprovedOverlappingEmployeeIds as jest.Mock).mockResolvedValue(
      { employeeIds: ["employee-0", "employee-2"] },
    );

    const result = await checkTeamCoverage({
      employeeId: employee.id,
      startDate: "2026-08-03",
      endDate: "2026-08-07",
      workingDaysCount: 5,
    });

    expect(result.teamSize).toBe(5);
    expect(result.employeesOnLeave).toBe(3);
    expect(result.capacityPercentage).toBe(40);
    expect(result.warning).toBe(
      "If you approve this leave request, your team will operate at 40% capacity for 5 day(s).",
    );
  });

  it("returns no warning when the team stays comfortably staffed", async () => {
    (Employees.getAllEmployees as jest.Mock).mockResolvedValue({
      employees: teamOfSize(10),
    });
    (LeaveRequests.getApprovedOverlappingEmployeeIds as jest.Mock).mockResolvedValue(
      { employeeIds: [] },
    );

    const result = await checkTeamCoverage({
      employeeId: employee.id,
      startDate: "2026-08-03",
      endDate: "2026-08-07",
      workingDaysCount: 5,
    });

    expect(result.teamSize).toBe(10);
    expect(result.employeesOnLeave).toBe(1);
    expect(result.capacityPercentage).toBe(90);
    expect(result.warning).toBeNull();
  });

  it("passes the requesting employee's team_id to the roster lookup", async () => {
    (Employees.getAllEmployees as jest.Mock).mockResolvedValue({
      employees: teamOfSize(4),
    });
    (LeaveRequests.getApprovedOverlappingEmployeeIds as jest.Mock).mockResolvedValue(
      { employeeIds: [] },
    );

    await checkTeamCoverage({
      employeeId: employee.id,
      startDate: "2026-08-03",
      endDate: "2026-08-07",
      workingDaysCount: 5,
    });

    expect(Employees.getAllEmployees).toHaveBeenCalledWith({
      team: employee.team_id,
      isActive: true,
    });
  });
});
