import express from "express";
import { Users } from "../database/utils/database.js";
import generateJwtToken from "../utils/generateJwtToken.js";
import bcrypt from "bcrypt";
import type { AuthUser } from "../types.js";
import { Tokens } from "../database/utils/database.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await Users.getSingleUserByEmail(email);

    if (
      user.email == undefined ||
      user.userId == undefined ||
      user.passwordHash == undefined
    ) {
      return res.status(404).json({
        status: "error",
        data: null,
        message: "User not found",
      });
    }

    const payload: AuthUser = {
      userId: user.userId,
      email: user.email,
      role: user.role ? user.role : [],
    };

    bcrypt.compare(password, user.passwordHash, async function (err, result) {
      if (err) {
        res.status(500).json({
          status: "error",
          data: null,
          message: "Wrong email or password",
        });
      }

      if (result) {
        const { token, refreshToken } = generateJwtToken(payload as any, "all");

        const storeTokenRes = await Tokens.addRefreshToken(
          refreshToken as string,
          user.userId as string,
        );

        res.status(200).json({
          status: "success",
          data: {
            token: token,
            refreshToken: storeTokenRes.refreshToken,
            role: user.role,
            id: user.userId,
          },
          message: "User retrieved successfully",
        });
      } else {
        res.status(400).json({
          status: "fail",
          data: null,
          message: "Password do not match",
        });
      }
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
