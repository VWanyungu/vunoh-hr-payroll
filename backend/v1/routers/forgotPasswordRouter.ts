import express from "express";
import { Users } from "../database/utils/database.js";
import generateJwtToken from "../utils/generateJwtToken.js";
import { sendPasswordResetMail } from "../utils/sendMail.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const email = req.body.email;
  if (!email)
    return res
      .status(401)
      .json({ status: "error", data: null, message: "Email not provided" });

  const user = await Users.getSingleUserByEmail(email);

  if (user.email == undefined) {
    return res.status(404).json({
      status: "error",
      data: null,
      message: "Email not found",
    });
  }

  const payload = {
    userId: user.userId,
    id: user.userId,
    email: user.email,
  };

  const { forgotPasswordToken } = generateJwtToken(
    payload as any,
    "forgotPassword",
  );

  const sendRes = await sendPasswordResetMail({
    to: user.email,
    subject: "Vunoh HR and Payroll - Password Reset",
    html: `<p><a href="${process.env.FRONTEND_URL}/reset-password/${forgotPasswordToken}">Click to reset yout password. This link is valid for 10 minutes</a></p>`,
  });

  if (sendRes.status === "error") {
    return res.status(500).json({
      status: "error",
      data: null,
      message: sendRes.message,
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      resetLink: `${process.env.FRONTEND_URL}/reset-password/${forgotPasswordToken}`,
    },
    message: "Email sent",
  });
});

export default router;
