import express from "express";
const router = express.Router();
import { Users } from "../database/utils/database.js";
import hashPassword from "../utils/hashPassword.js";
import { createUserSchema } from "../utils/validation.js";
import type { AuthenticatedRequest } from "../types.js";
import type { CreateUserInput } from "../types.js";

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
      const { page = 1, limit = 10 } = req.query;

      try {
        const response = await Users.getAllUsers({
          page: parseInt(String(page)),
          limit: parseInt(String(limit)),
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

router.put("/", (req, res) => {
  res.status(200).send("Users route");
});

router.delete("/", (req, res) => {
  res.status(200).send("Users route");
});

export default router;
