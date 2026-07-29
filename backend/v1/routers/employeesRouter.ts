import express from "express";
const router = express.Router();
import {
  Employees,
  sanitizeEmployee,
  resolveEmployeeForUser,
} from "../database/utils/database.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  selfUpdateEmployeeSchema,
  employeeQuerySchema,
} from "../utils/validation.js";
import type { AuthenticatedRequest, AuthUser } from "../types.js";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "../types.js";

function isPrivileged(user: AuthUser | undefined) {
  return (
    user?.role?.some((r) => r.role === "super_admin" || r.role === "hr_admin") ??
    false
  );
}

router.get("/", async (req: AuthenticatedRequest, res) => {
  const { page, limit, team, manager, employmentType, isActive, search } =
    req.query;

  const { error, value } = employeeQuerySchema.validate(
    { page, limit, team, manager, employmentType, isActive, search },
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

  const isManager = req.user?.role?.some((r) => r.role === "manager");

  if (!isPrivileged(req.user) && !isManager) {
    const callerEmployee = await resolveEmployeeForUser(req.user!);

    if (!callerEmployee) {
      return res.status(403).json({
        status: "error",
        data: null,
        message: "No employee record linked to this account",
      });
    }

    value.team = callerEmployee.team_id;
  }

  try {
    const response = await Employees.getAllEmployees(value);

    const employees = response.employees.map(
      (employee: Record<string, unknown>) =>
        sanitizeEmployee(employee, req.user!),
    );

    res.status(200).json({
      status: "success",
      data: { response: { ...response, employees } },
      message: "Employees retrieved successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/me", async (req: AuthenticatedRequest, res) => {
  try {
    const employee = await resolveEmployeeForUser(req.user!);

    if (!employee) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "No employee record linked to this account",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { employee: sanitizeEmployee(employee, req.user!) } },
      message: "Employee retrieved successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/:employeeId", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  try {
    const response = await Employees.getEmployeeById(req.params.employeeId);

    if (!response.employee) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Employee not found",
      });
    }

    const isSelf = response.employee.user_id === user?.userId;
    const isManager = user?.role?.some((r) => r.role === "manager");

    if (!isPrivileged(user) && !isManager && !isSelf) {
      return res.status(403).json({
        status: "error",
        data: null,
        message: "You are not authorized to access this resource",
      });
    }

    const employee = sanitizeEmployee(response.employee, user!);

    res.status(200).json({
      status: "success",
      data: { response: { employee } },
      message: "Employee retrieved successfully",
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
  const privileged = isPrivileged(req.user);

  if (!privileged && req.body.userId && req.body.userId !== req.user?.userId) {
    return res.status(403).json({
      status: "error",
      data: null,
      message: "You can only create an employee record for yourself",
    });
  }

  const employeeObj: CreateEmployeeInput = {
    userId: privileged ? req.body.userId : req.user!.userId,
    jobTitle: req.body.jobTitle,
    teamId: req.body.teamId,
    ...(req.body.managerId !== undefined && { managerId: req.body.managerId }),
    startDate: req.body.startDate,
    salary: req.body.salary,
    employmentType: req.body.employmentType,
    ...(req.body.resume !== undefined && { resume: req.body.resume }),
    ...(req.body.phone !== undefined && { phone: req.body.phone }),
    ...(req.body.profilePicture !== undefined && {
      profilePicture: req.body.profilePicture,
    }),
    ...(req.body.nationalId !== undefined && {
      nationalId: req.body.nationalId,
    }),
  };

  const { error, value } = createEmployeeSchema.validate(employeeObj, {
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);

    return res.status(400).json({
      status: "error",
      data: { errors: errorMessages },
      message: "Wrong employee input",
    });
  }

  try {
    const response = await Employees.createEmployee({
      ...value,
      updatedBy: req.user!.userId,
    });

    if (response.error) {
      const code = (response.error as { code?: string }).code;

      if (code === "23505") {
        return res.status(409).json({
          status: "error",
          data: null,
          message: "Employee record already exists for this user",
        });
      }

      if (code === "23503") {
        return res.status(400).json({
          status: "error",
          data: null,
          message: "Invalid team or manager reference",
        });
      }

      return res.status(500).json({
        status: "error",
        data: null,
        message: "Failed to create employee",
      });
    }

    const employee = sanitizeEmployee(response.employee, req.user!);

    res.status(200).json({
      status: "success",
      data: { response: { employee } },
      message: "Employee created successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.put("/:employeeId", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  try {
    const existing = await Employees.getEmployeeById(req.params.employeeId);

    if (!existing.employee) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Employee not found",
      });
    }

    const privileged = isPrivileged(user);
    const isSelf = existing.employee.user_id === user?.userId;

    if (!privileged && !isSelf) {
      return res.status(403).json({
        status: "error",
        data: null,
        message: "You are not authorized to update this resource",
      });
    }

    const employeeObj: UpdateEmployeeInput = {
      ...(req.body.jobTitle !== undefined && { jobTitle: req.body.jobTitle }),
      ...(req.body.teamId !== undefined && { teamId: req.body.teamId }),
      ...(req.body.managerId !== undefined && {
        managerId: req.body.managerId,
      }),
      ...(req.body.startDate !== undefined && {
        startDate: req.body.startDate,
      }),
      ...(req.body.salary !== undefined && { salary: req.body.salary }),
      ...(req.body.employmentType !== undefined && {
        employmentType: req.body.employmentType,
      }),
      ...(req.body.resume !== undefined && { resume: req.body.resume }),
      ...(req.body.phone !== undefined && { phone: req.body.phone }),
      ...(req.body.profilePicture !== undefined && {
        profilePicture: req.body.profilePicture,
      }),
      ...(req.body.nationalId !== undefined && {
        nationalId: req.body.nationalId,
      }),
    };

    const schema = privileged ? updateEmployeeSchema : selfUpdateEmployeeSchema;
    const { error, value } = schema.validate(employeeObj, {
      abortEarly: false,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);

      return res.status(400).json({
        status: "error",
        data: { errors: errorMessages },
        message: "Wrong employee input",
      });
    }

    const response = await Employees.updateEmployee(req.params.employeeId, {
      ...value,
      updatedBy: user!.userId,
    });

    if (!response.employee) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Employee not found",
      });
    }

    const employee = sanitizeEmployee(response.employee, user!);

    res.status(200).json({
      status: "success",
      data: { response: { employee } },
      message: "Employee updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/:employeeId/deactivate", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  try {
    const response = await Employees.deactivateEmployee(
      req.params.employeeId,
      user!.userId,
    );

    if (!response.employee) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { employee: response.employee } },
      message: "Employee deactivated successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/:employeeId/activate", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  try {
    const response = await Employees.activateEmployee(
      req.params.employeeId,
      user!.userId,
    );

    if (!response.employee) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { employee: response.employee } },
      message: "Employee activated successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.delete("/:employeeId", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;

  try {
    const response = await Employees.softDeleteEmployee(
      req.params.employeeId,
      user!.userId,
    );

    if (!response.employee) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { employee: response.employee } },
      message: "Employee deleted successfully",
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
