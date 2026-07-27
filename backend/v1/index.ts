import express from "express";
import loginRouter from "./routers/loginRouter.js";
import logoutRouter from "./routers/logoutRouter.js";
import refreshTokenRouter from "./routers/refreshTokenRouter.js";
import authenticateToken from "./middlewares/token.js";
import forgotPasswordRouter from "./routers/forgotPasswordRouter.js";
import resetUserPasswordRouter from "./routers/resetUserPasswordRouter.js";
import usersRouter from "./routers/usersRouter.js";

import { authLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

router.use(authenticateToken());

router.use("/users", usersRouter);
router.use("/signup", authLimiter, usersRouter);
router.use("/login", authLimiter, loginRouter);
router.use("/reset-password", authLimiter, resetUserPasswordRouter);
router.use("/logout", logoutRouter);
router.use("/forgot-password", authLimiter, forgotPasswordRouter);
router.use("/token", authLimiter, refreshTokenRouter);

export default router;
