import "dotenv/config";
import jwt from "jsonwebtoken";
import { isTokenBlacklisted } from "../utils/checkCache.js";
import type { NextFunction, Request, Response } from "express";
import type { AuthUser, AuthenticatedRequest, PublicRoute } from "../types.js";
import logger from "../../utils/logger.js";

export default function authenticateToken() {
  return (req: Request, res: Response, next: NextFunction) => {
    const publicRoutes: PublicRoute[] = [
      // { method: 'GET', pattern: /^\/examplePublicRoute$/ },
    ];

    const isPermitted =
      ["/login", "/logout", "/signup", "/forgot-password", "/token"].includes(
        req.path,
      ) ||
      req.path.startsWith("/reset-password/") ||
      (req.path === "/users" && req.method === "POST") ||
      publicRoutes.some(
        (route) => route.method === req.method && route.pattern.test(req.path),
      );

    if (isPermitted) {
      return next();
    }

    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null)
      return res.status(401).json({ error: "token not provided" });

    jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET ?? "",
      async (err, user) => {
        if (err) {
          logger.error({ error: err }, "JWT verification failed");
          return res.status(403).json({ error: "Expired token" });
        }

        (req as AuthenticatedRequest).user = user as AuthUser;

        const blacklisted = await isTokenBlacklisted(token);

        if (blacklisted)
          return res.status(403).json({
            status: "fail",
            data: null,
            message: "Token is blacklisted",
            error: "Blacklisted token",
          });

        next();
      },
    );
  };
}
