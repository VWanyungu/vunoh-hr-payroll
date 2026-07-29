import express from "express";
const router = express.Router();
import { generatePayslipsForPeriod } from "../utils/payroll/generatePayslipsForPeriod.js";
import { initiatePayrollRunSchema } from "../utils/validation.js";
import type { AuthenticatedRequest } from "../types.js";

router.post("/", async (req: AuthenticatedRequest, res) => {
  const { error, value } = initiatePayrollRunSchema.validate(
    { periodMonth: req.body.periodMonth, periodYear: req.body.periodYear },
    { abortEarly: false },
  );

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);

    return res.status(400).json({
      status: "error",
      data: { errors: errorMessages },
      message: "Wrong payroll run input",
    });
  }

  try {
    const { payslips, errors } = await generatePayslipsForPeriod({
      periodMonth: value.periodMonth,
      periodYear: value.periodYear,
      generatedBy: req.user!.userId,
    });

    res.status(200).json({
      status: "success",
      data: { response: { payslips, errors } },
      message: "Payroll run initiated successfully",
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
