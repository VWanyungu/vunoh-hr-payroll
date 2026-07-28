import express from "express";
import loginRouter from "./routers/loginRouter.js";
import logoutRouter from "./routers/logoutRouter.js";
import refreshTokenRouter from "./routers/refreshTokenRouter.js";
import authenticateToken from "./middlewares/token.js";
import authorize from "./middlewares/authorize.js";
import forgotPasswordRouter from "./routers/forgotPasswordRouter.js";
import resetUserPasswordRouter from "./routers/resetUserPasswordRouter.js";
import usersRouter from "./routers/usersRouter.js";
import teamsRouter from "./routers/teamsRouter.js";
import employeesRouter from "./routers/employeesRouter.js";
import leaveTypesRouter from "./routers/leaveTypesRouter.js";
import leaveRequestsRouter from "./routers/leaveRequestsRouter.js";
import leaveBalancesRouter from "./routers/leaveBalancesRouter.js";
import payslipsRouter from "./routers/payslipsRouter.js";

import { authLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

router.use(authenticateToken());
router.use(authorize());

router.use("/v1/users", usersRouter);
router.use("/v1/teams", teamsRouter);
router.use("/v1/employees", employeesRouter);
router.use("/v1/leave-types", leaveTypesRouter);
router.use("/v1/leave-requests", leaveRequestsRouter);
router.use("/v1/leave-balances", leaveBalancesRouter);
router.use("/v1/payslips", payslipsRouter);
router.use("/v1/signup", authLimiter, usersRouter);
router.use("/v1/login", authLimiter, loginRouter);
router.use("/v1/reset-password", authLimiter, resetUserPasswordRouter);
router.use("/v1/logout", logoutRouter);
router.use("/v1/forgot-password", authLimiter, forgotPasswordRouter);
router.use("/v1/token", authLimiter, refreshTokenRouter);

export default router;
