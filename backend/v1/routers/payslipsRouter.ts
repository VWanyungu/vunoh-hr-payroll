import express from "express";
const router = express.Router();
import {
  Payslips,
  resolveEmployeeForUser,
} from "../database/utils/database.js";
import {
  payslipQuerySchema,
  latestPayslipQuerySchema,
} from "../utils/validation.js";
import type { AuthenticatedRequest, AuthUser } from "../types.js";

function isPrivileged(user: AuthUser | undefined) {
  return (
    user?.role?.some(
      (r) => r.role === "super_admin" || r.role === "hr_admin",
    ) ?? false
  );
}

router.get("/", async (req: AuthenticatedRequest, res) => {
  const { page, limit, employeeId, periodMonth, periodYear, payslipId } =
    req.query;

  const { error, value } = payslipQuerySchema.validate(
    { page, limit, employeeId, periodMonth, periodYear, payslipId },
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
              payslips: [],
              pagination:
                value.page !== undefined || value.limit !== undefined
                  ? {
                      page: value.page ?? 1,
                      limit: value.limit ?? 10,
                      total: 0,
                      pages: 0,
                    }
                  : { page: null, limit: null, total: 0, pages: 0 },
            },
          },
          message: "Payslips retrieved successfully",
        });
      }

      effectiveEmployeeId = employee.id;
    }

    const response = await Payslips.getAllPayslips({
      ...value,
      employeeId: effectiveEmployeeId,
    });

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Payslips retrieved successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/latest", async (req: AuthenticatedRequest, res) => {
  const { employeeId, periodMonth, periodYear } = req.query;

  const { error, value } = latestPayslipQuerySchema.validate(
    { employeeId, periodMonth, periodYear },
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
          data: { response: { payslip: null } },
          message: "Payslip retrieved successfully",
        });
      }

      effectiveEmployeeId = employee.id;
    } else if (!effectiveEmployeeId) {
      return res.status(400).json({
        status: "error",
        data: { errors: ["employeeId is required"] },
        message: "Wrong query input",
      });
    }

    const response = await Payslips.getLatestPayslipForEmployee({
      employeeId: effectiveEmployeeId,
      periodMonth: value.periodMonth,
      periodYear: value.periodYear,
    });

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Payslip retrieved successfully",
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
