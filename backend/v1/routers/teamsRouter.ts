import express from "express";
const router = express.Router();
import { Teams } from "../database/utils/database.js";
import { createTeamSchema, updateTeamSchema } from "../utils/validation.js";
import type { CreateTeamInput, UpdateTeamInput } from "../types.js";

router.get("/", async (req, res) => {
  const { id, name, page, limit } = req.query;

  try {
    const response = await Teams.getAllTeams({
      id: id ? String(id) : undefined,
      name: name ? String(name) : undefined,
      page: page !== undefined ? parseInt(String(page)) : undefined,
      limit: limit !== undefined ? parseInt(String(limit)) : undefined,
    });

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Teams retrieved successfully",
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
  try {
    const response = await Teams.getTeamById(req.params.id);

    if (!response.team) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Team not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Team retrieved successfully",
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
  const teamObj: CreateTeamInput = {
    name: req.body.name,
  };

  const { error, value } = createTeamSchema.validate(teamObj, {
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
    const response = await Teams.createTeam(value);

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Team created successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.patch("/:id", async (req, res) => {
  const teamObj: UpdateTeamInput = {
    name: req.body.name,
  };

  const { error, value } = updateTeamSchema.validate(teamObj, {
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
    const response = await Teams.updateTeam(req.params.id, value);

    if (!response.team) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Team not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Team updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      data: null,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const response = await Teams.deleteTeam(req.params.id);

    if (!response.team) {
      if (response.error && (response.error as { code?: string }).code === "23503") {
        return res.status(409).json({
          status: "error",
          data: null,
          message: "Cannot delete team with assigned employees",
        });
      }

      return res.status(404).json({
        status: "error",
        data: null,
        message: "Team not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Team deleted successfully",
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
