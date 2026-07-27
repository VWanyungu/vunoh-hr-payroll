import express from "express";
const router = express.Router();
import { Users, Roles } from "../database/utils/database.js";
import hashPassword from "../utils/hashPassword.js";
import {
  createUserSchema,
  updateUserSchema,
  statusSchema,
  assignRoleSchema,
  revokeRoleParamsSchema,
} from "../utils/validation.js";
import type { AuthenticatedRequest } from "../types.js";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserStatus,
  AssignRoleInput,
} from "../types.js";

router.get("/", async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  const { type } = req.body;

  const userRoles: string[] = [];

  user?.role?.map((r) => {
    if (r.role === "super_admin" || r.role === "hr_admin") {
      userRoles.push(r.role);
    }
  });

  if (userRoles.length < 1) {
    res.status(401).json({
      status: "error",
      data: null,
      message: "You are not authorized to access this resource",
    });
  }

  switch (type) {
    case "multiple":
      const { page = 1, limit = 10, status } = req.query;

      if (status !== undefined) {
        const { error: statusError } = statusSchema.validate(status);

        if (statusError) {
          return res.status(400).json({
            status: "error",
            data: {
              errors: statusError.details.map((detail) => detail.message),
            },
            message: "Wrong user input",
          });
        }
      }

      try {
        const response = await Users.getAllUsers({
          page: parseInt(String(page)),
          limit: parseInt(String(limit)),
          status: status as UserStatus | undefined,
        });

        res.status(200).json({
          status: "success",
          data: { response },
          message: "Users retrieved successfully",
        });
      } catch (err) {
        res.status(500).json({
          status: "error",
          data: null,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      break;

    case "single":
      const { inputEmail } = req.body;
      try {
        const user = await Users.getSingleUserByEmail(inputEmail);

        if (user.email == undefined || user.userId == undefined) {
          return res.status(404).json({
            status: "error",
            data: null,
            message: "User not found",
          });
        }

        res.status(200).json({
          status: "success",
          data: {
            userId: user.userId,
            email: user.email,
            role: user.role,
          },
          message: "User retrieved successfully",
        });
      } catch (err) {
        res.status(500).json({
          status: "error",
          data: null,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      break;

    default:
      res.status(400).json({
        status: "error",
        data: null,
        message: "Specify type of fetch in request body",
      });
  }
});

router.post("/", async (req, res) => {
  const hashedPassword = await hashPassword(req.body.password);

  const userObj: CreateUserInput = {
    name: req.body.name,
    email: req.body.email,
    passwordHash: hashedPassword,
  };

  const { error, value } = createUserSchema.validate(userObj, {
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);

    return res.status(400).json({
      status: "error",
      data: {
        errors: errorMessages,
      },
      message: "Wrong user input",
    });
  }

  try {
    const response = await Users.createUser(value);

    res.status(200).json({
      status: "success",
      data: { response },
      message: "User created successfully",
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
  const userObj: UpdateUserInput = {
    ...(req.body.name !== undefined && { name: req.body.name }),
    ...(req.body.email !== undefined && { email: req.body.email }),
    ...(req.body.status !== undefined && { status: req.body.status }),
  };

  const { error, value } = updateUserSchema.validate(userObj, {
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);

    return res.status(400).json({
      status: "error",
      data: {
        errors: errorMessages,
      },
      message: "Wrong user input",
    });
  }

  try {
    const response = await Users.updateUser(req.params.id, value);

    if (!response.user) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response },
      message: "User updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.delete("/", (req, res) => {
  res.status(200).send("Users route");
});

router.post("/:userId/role", async (req, res) => {
  const roleObj: AssignRoleInput = {
    role: req.body.role,
    ...(req.body.teamId !== undefined && { teamId: req.body.teamId }),
  };

  const { error, value } = assignRoleSchema.validate(roleObj, {
    abortEarly: false,
  });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);

    return res.status(400).json({
      status: "error",
      data: { errors: errorMessages },
      message: "Wrong user input",
    });
  }

  try {
    const userResponse = await Users.getUserById(req.params.userId);

    if (!userResponse.user) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "User not found",
      });
    }

    const response = await Roles.assignRole({
      userId: req.params.userId,
      role: value.role,
      teamId: value.teamId,
    });

    if (response.duplicate) {
      return res.status(409).json({
        status: "error",
        data: null,
        message: "User already has this role assignment",
      });
    }

    if (response.error) {
      return res.status(500).json({
        status: "error",
        data: null,
        message: "Failed to assign role",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Role assigned successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/:userId/role/:roleId", async (req, res) => {
  const { error } = revokeRoleParamsSchema.validate({
    roleId: req.params.roleId,
  });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);

    return res.status(400).json({
      status: "error",
      data: { errors: errorMessages },
      message: "Wrong user input",
    });
  }

  try {
    const userResponse = await Users.getUserById(req.params.userId);

    if (!userResponse.user) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "User not found",
      });
    }

    const response = await Roles.revokeRole(req.params.userId, req.params.roleId);

    if (response.error === "Role does not exist") {
      return res.status(404).json({
        status: "error",
        data: null,
        message: response.error,
      });
    }

    if (response.error === "User does not have the specified role") {
      return res.status(404).json({
        status: "error",
        data: null,
        message: response.error,
      });
    }

    if (response.error) {
      return res.status(500).json({
        status: "error",
        data: null,
        message: "Failed to revoke role",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Role revoked successfully",
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
