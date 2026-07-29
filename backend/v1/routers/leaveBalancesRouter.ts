import express from "express";
const router = express.Router();
import {
  LeaveBalances,
  resolveEmployeeForUser,
} from "../database/utils/database.js";
import {
  createLeaveBalanceSchema,
  leaveBalanceQuerySchema,
} from "../utils/validation.js";
import { buildPagination } from "../utils/pagination.js";
import type { AuthenticatedRequest, AuthUser } from "../types.js";

function isPrivileged(user: AuthUser | undefined) {
  return (
    user?.role?.some((r) => r.role === "super_admin" || r.role === "hr_admin") ??
    false
  );
}

router.get("/", async (req: AuthenticatedRequest, res) => {
  const { page, limit, employeeId, leaveTypeId, year } = req.query;

  const { error, value } = leaveBalanceQuerySchema.validate(
    { page, limit, employeeId, leaveTypeId, year },
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
    let effectiveEmployeeId = value.employeeId;

    if (!isPrivileged(req.user)) {
      const employee = await resolveEmployeeForUser(req.user!);

      if (!employee) {
        return res.status(200).json({
          status: "success",
          data: {
            response: {
              leaveBalances: [],
              pagination: buildPagination({
                page: value.page,
                limit: value.limit,
                total: 0,
              }),
            },
          },
          message: "Leave balances retrieved successfully",
        });
      }

      effectiveEmployeeId = employee.id;
    }

    const response = await LeaveBalances.getAllLeaveBalances({
      ...value,
      employeeId: effectiveEmployeeId,
    });

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Leave balances retrieved successfully",
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
    const { leaveBalance } = await LeaveBalances.getLeaveBalanceById(
      req.params.id,
    );

    if (!leaveBalance) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Leave balance not found",
      });
    }

    const employee = await resolveEmployeeForUser(user!);
    const isSelf = employee?.id === leaveBalance.employee_id;

    if (!isPrivileged(user) && !isSelf) {
      return res.status(403).json({
        status: "error",
        data: null,
        message: "You are not authorized to access this resource",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { leaveBalance } },
      message: "Leave balance retrieved successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/", async (req, res) => {
  const leaveBalanceObj = {
    employeeId: req.body.employeeId,
    leaveTypeId: req.body.leaveTypeId,
    year: req.body.year,
    allocated: req.body.allocated,
  };

  const { error, value } = createLeaveBalanceSchema.validate(
    leaveBalanceObj,
    { abortEarly: false },
  );

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);

    return res.status(400).json({
      status: "error",
      data: { errors: errorMessages },
      message: "Wrong leave balance input",
    });
  }

  try {
    const response = await LeaveBalances.createLeaveBalance(value);

    if (response.error) {
      const code = (response.error as { code?: string }).code;

      if (code === "23505") {
        return res.status(409).json({
          status: "error",
          data: null,
          message:
            "A leave balance already exists for this employee, leave type and year",
        });
      }

      if (code === "23503") {
        return res.status(400).json({
          status: "error",
          data: null,
          message: "Invalid employee or leave type reference",
        });
      }

      return res.status(500).json({
        status: "error",
        data: null,
        message: "Failed to create leave balance",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { leaveBalance: response.leaveBalance } },
      message: "Leave balance created successfully",
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
