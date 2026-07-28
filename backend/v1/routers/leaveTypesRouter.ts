import express from "express";
const router = express.Router();
import { LeaveTypes } from "../database/utils/database.js";

router.get("/", async (req, res) => {
  const { code } = req.query;

  try {
    const response = await LeaveTypes.getAllLeaveTypes({
      code: code ? (String(code) as "annual" | "sick" | "unpaid") : undefined,
    });

    res.status(200).json({
      status: "success",
      data: { response },
      message: "Leave types retrieved successfully",
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
    const { leaveTypes, error } = await LeaveTypes.getAllLeaveTypes({
      id: req.params.id,
    });
    const leaveType = leaveTypes?.[0];

    if (error) throw error;

    if (!leaveType) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "Leave type not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: { response: { leaveType } },
      message: "Leave type retrieved successfully",
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
