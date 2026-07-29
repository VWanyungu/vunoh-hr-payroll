import express from "express";
const router = express.Router();
import {
  Employees,
  LeaveRequests,
  LeaveTypes,
  PublicHolidays,
  resolveEmployeeForUser,
} from "../database/utils/database.js";
import { submitLeaveRequest } from "../utils/leave/submitLeaveRequest.js";
import { checkTeamCoverage } from "../utils/leave/checkTeamCoverage.js";
import { countWorkingDays } from "../utils/leave/workingDays.js";
import { buildPagination } from "../utils/pagination.js";
import {
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  leaveRequestQuerySchema,
} from "../utils/validation.js";
import type {
  AuthenticatedRequest,
  AuthUser,
  CreateLeaveRequestInput,
  LeaveRequestScope,
  UpdateLeaveRequestInput,
} from "../types.js";

function isPrivileged(user: AuthUser | undefined) {
  return (
    user?.role?.some((r) => r.role === "super_admin" || r.role === "hr_admin") ??
    false
  );
}

// employees.manager_id points at the manager's employees.id, but req.user only
// carries userId, so confirming "is this requester the manager of this employee"
// needs one extra hop through the manager's own employee row.
async function isManagerOf(user: AuthUser | undefined, employeeId: string) {
  if (!user) return false;

  const { employee } = await Employees.getEmployeeById(employeeId);
  if (!employee?.manager_id) return false;

  const { employee: manager } = await Employees.getEmployeeById(
    employee.manager_id,
  );

  return manager?.user_id === user.userId;
}

router.get("/", async (req: AuthenticatedRequest, res) => {
  const { page, limit, employeeId, status } = req.query;

  const { error, value } = leaveRequestQuerySchema.validate(
    { page, limit, employeeId, status },
    { abortEarly: false, convert: true },
  );

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);

    return res.status(400).json({
      status: "error",
      data: { errors: errorMessages },
      message: "Wrong query input",
    });
  }

  try {
    let scope: LeaveRequestScope;

    if (isPrivileged(req.user)) {
      scope = { type: "all" };
    } else {
      const employee = await resolveEmployeeForUser(req.user!);

      if (!employee) {
        return res.status(200).json({
          status: "success",
          data: {
            response: {
              leaveRequests: [],
              pagination: buildPagination({
                page: value.page,
                limit: value.limit,
                total: 0,
              }),
            },
          },
          message: "Leave requests retrieved successfully",
        });
      }

      const isManager = req.user?.role?.some((r) => r.role === "manager");

      scope = isManager
        ? { type: "managed", managerEmployeeId: employee.id }
        : { type: "own", employeeId: employee.id };
    }

    const response = await LeaveRequests.getAllLeaveRequests({
      ...value,
      scope,
    });

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Leave requests retrieved successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/:id", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  try {
    const { leaveRequest } = await LeaveRequests.getLeaveRequestById(
      req.params.id,
    );

    if (!leaveRequest) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Leave request not found",
      });
    }

    const employee = await resolveEmployeeForUser(user!);
    const isSelf = employee?.id === leaveRequest.employee_id;
    const managing = await isManagerOf(user, leaveRequest.employee_id);

    if (!isPrivileged(user) && !isSelf && !managing) {
      return res.status(403).json({
        status: "error",
        data: null,
        message: "You are not authorized to access this resource",
      });
    }

    let teamCoverage = null;

    if (
      (managing || isPrivileged(user)) &&
      !isSelf &&
      leaveRequest.status === "pending"
    ) {
      teamCoverage = await checkTeamCoverage({
        employeeId: leaveRequest.employee_id,
        startDate: leaveRequest.start_date,
        endDate: leaveRequest.end_date,
        workingDaysCount: leaveRequest.working_days_count,
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { leaveRequest, teamCoverage } },
      message: "Leave request retrieved successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const privileged = isPrivileged(req.user);
    const ownEmployee = await resolveEmployeeForUser(req.user!);

    let employeeId: string | undefined;

    if (privileged && req.body.employeeId) {
      employeeId = req.body.employeeId;
    } else {
      employeeId = ownEmployee?.id;
    }

    const autoApprove = privileged && employeeId === ownEmployee?.id;

    if (!employeeId) {
      return res.status(400).json({
        status: "error",
        data: null,
        message: "No employee profile found for this user",
      });
    }

    const leaveRequestObj: CreateLeaveRequestInput = {
      leaveTypeId: req.body.leaveTypeId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      ...(req.body.coverEmployeeId !== undefined && {
        coverEmployeeId: req.body.coverEmployeeId,
      }),
    };

    const { error, value } = createLeaveRequestSchema.validate(
      { ...leaveRequestObj, employeeId },
      { abortEarly: false },
    );

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);

      return res.status(400).json({
        status: "error",
        data: { errors: errorMessages },
        message: "Wrong leave request input",
      });
    }

    const { leaveTypes } = await LeaveTypes.getAllLeaveTypes({
      id: value.leaveTypeId,
    });

    if (!leaveTypes?.[0]) {
      return res.status(400).json({
        status: "error",
        data: null,
        message: "Invalid leave type",
      });
    }

    const response = await submitLeaveRequest({
      ...value,
      employeeId,
      autoApprove,
      requestedByUserId: req.user!.userId,
    });

    if (response.error) {
      if (typeof response.error === "string") {
        const errorMessages: Record<string, [number, string]> = {
          employee_not_found: [400, "Employee not found"],
          invalid_leave_type: [400, "Invalid leave type"],
          insufficient_notice: [
            400,
            "Not enough notice given for this leave type",
          ],
          cover_required: [
            400,
            "A cover employee is required for this leave type",
          ],
          no_balance: [
            400,
            "No leave balance record found for this employee, leave type and year",
          ],
          insufficient_balance: [
            400,
            "Insufficient leave balance remaining for the requested period",
          ],
          no_approver_available: [
            500,
            "No approver could be determined for this leave request",
          ],
        };

        const [code, message] = errorMessages[response.error] ?? [
          500,
          "Failed to create leave request",
        ];

        return res.status(code).json({
          status: "error",
          data: null,
          message,
        });
      }

      const code = (response.error as { code?: string }).code;

      if (code === "23503") {
        return res.status(400).json({
          status: "error",
          data: null,
          message: "Invalid employee or cover employee reference",
        });
      }

      return res.status(500).json({
        status: "error",
        data: null,
        message: "Failed to create leave request",
      });
    }

    res.status(201).json({
      status: "success",
      data: { response: { leaveRequest: response.leaveRequest } },
      message: "Leave request created successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.put("/:id", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  try {
    const { leaveRequest: existing } = await LeaveRequests.getLeaveRequestById(
      req.params.id,
    );

    if (!existing) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Leave request not found",
      });
    }

    const privileged = isPrivileged(user);
    const employee = await resolveEmployeeForUser(user!);
    const isSelf = employee?.id === existing.employee_id;

    if (!privileged && !isSelf) {
      return res.status(403).json({
        status: "error",
        data: null,
        message: "You are not authorized to update this resource",
      });
    }

    if (existing.status !== "pending") {
      return res.status(409).json({
        status: "error",
        data: null,
        message: "Only pending leave requests can be edited",
      });
    }

    const leaveRequestObj: UpdateLeaveRequestInput = {
      ...(req.body.leaveTypeId !== undefined && {
        leaveTypeId: req.body.leaveTypeId,
      }),
      ...(req.body.startDate !== undefined && {
        startDate: req.body.startDate,
      }),
      ...(req.body.endDate !== undefined && { endDate: req.body.endDate }),
      ...(req.body.coverEmployeeId !== undefined && {
        coverEmployeeId: req.body.coverEmployeeId,
      }),
    };

    const { error, value } = updateLeaveRequestSchema.validate(
      leaveRequestObj,
      { abortEarly: false },
    );

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);

      return res.status(400).json({
        status: "error",
        data: { errors: errorMessages },
        message: "Wrong leave request input",
      });
    }

    const updatePayload: Record<string, unknown> = {};

    if (value.leaveTypeId !== undefined)
      updatePayload["leave_type_id"] = value.leaveTypeId;
    if (value.coverEmployeeId !== undefined)
      updatePayload["cover_employee_id"] = value.coverEmployeeId;

    if (value.startDate !== undefined || value.endDate !== undefined) {
      const effectiveStart = value.startDate ?? existing.start_date;
      const effectiveEnd = value.endDate ?? existing.end_date;

      if (new Date(effectiveEnd) < new Date(effectiveStart)) {
        return res.status(400).json({
          status: "error",
          data: { errors: ["endDate must be on or after startDate"] },
          message: "Wrong leave request input",
        });
      }

      const { holidayDates } = await PublicHolidays.getHolidayDatesInRange(
        effectiveStart,
        effectiveEnd,
      );

      updatePayload["start_date"] = effectiveStart;
      updatePayload["end_date"] = effectiveEnd;
      updatePayload["working_days_count"] = countWorkingDays(
        effectiveStart,
        effectiveEnd,
        holidayDates,
      );
    }

    const response = await LeaveRequests.updateLeaveRequest(
      req.params.id,
      updatePayload,
    );

    if (!response.leaveRequest) {
      return res.status(409).json({
        status: "error",
        data: null,
        message: "Leave request is no longer pending",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { leaveRequest: response.leaveRequest } },
      message: "Leave request updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

async function decide(
  req: express.Request,
  id: string,
  res: express.Response,
  status: "approved" | "rejected",
) {
  const user = (req as AuthenticatedRequest).user;

  try {
    const { leaveRequest: existing } =
      await LeaveRequests.getLeaveRequestById(id);

    if (!existing) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Leave request not found",
      });
    }

    if (
      !isPrivileged(user) &&
      !(await isManagerOf(user, existing.employee_id))
    ) {
      return res.status(403).json({
        status: "error",
        data: null,
        message: "You are not authorized to decide this leave request",
      });
    }

    if (existing.status !== "pending") {
      return res.status(409).json({
        status: "error",
        data: null,
        message: "Only pending leave requests can be decided",
      });
    }

    const response =
      status === "approved"
        ? await LeaveRequests.approveLeaveRequest(id, user!.userId)
        : await LeaveRequests.decideLeaveRequest(id, {
            status,
            approverId: user!.userId,
          });

    if (!response.leaveRequest) {
      const errorMessages: Record<string, [number, string]> = {
        not_found: [404, "Leave request not found"],
        not_pending: [409, "Leave request is no longer pending"],
        no_balance: [
          400,
          "No leave balance record found for this employee, leave type and year",
        ],
        insufficient_balance: [
          400,
          "Insufficient leave balance remaining to approve this request",
        ],
      };

      const [code, message] = errorMessages[response.error as string] ?? [
        409,
        "Leave request is no longer pending",
      ];

      return res.status(code).json({
        status: "error",
        data: null,
        message,
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { leaveRequest: response.leaveRequest } },
      message: `Leave request ${status} successfully`,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

router.post("/:id/approve", (req, res) =>
  decide(req, req.params.id, res, "approved"),
);

router.post("/:id/reject", (req, res) =>
  decide(req, req.params.id, res, "rejected"),
);

router.post("/:id/cancel", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  try {
    const { leaveRequest: existing } = await LeaveRequests.getLeaveRequestById(
      req.params.id,
    );

    if (!existing) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Leave request not found",
      });
    }

    const privileged = isPrivileged(user);
    const employee = await resolveEmployeeForUser(user!);
    const isSelf = employee?.id === existing.employee_id;

    if (!privileged && !isSelf) {
      return res.status(403).json({
        status: "error",
        data: null,
        message: "You are not authorized to cancel this leave request",
      });
    }

    if (existing.status !== "pending") {
      return res.status(409).json({
        status: "error",
        data: null,
        message: "Only pending leave requests can be cancelled",
      });
    }

    const response = await LeaveRequests.cancelLeaveRequest(req.params.id);

    if (!response.leaveRequest) {
      return res.status(409).json({
        status: "error",
        data: null,
        message: "Leave request is no longer pending",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { leaveRequest: response.leaveRequest } },
      message: "Leave request cancelled successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
