import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest, UserRoles } from "../types.js";

type ProtectedRoute = {
  method: string;
  pattern: RegExp;
  roles: UserRoles["role"][];
};

export default function authorize() {
  return (req: Request, res: Response, next: NextFunction) => {
    const protectedRoutes: ProtectedRoute[] = [
      {
        method: "GET",
        pattern: /^\/v1\/users$/,
        roles: ["super_admin", "hr_admin", "manager"],
      },
      {
        method: "PUT",
        pattern: /^\/v1\/users\/[^/]+$/,
        roles: ["super_admin", "hr_admin"],
      },
      {
        method: "DELETE",
        pattern: /^\/v1\/users$/,
        roles: ["super_admin"],
      },
      {
        method: "POST",
        pattern: /^\/v1\/users\/[^/]+\/role$/,
        roles: ["super_admin", "hr_admin"],
      },
      {
        method: "POST",
        pattern: /^\/v1\/users\/[^/]+\/role\/[^/]+$/,
        roles: ["super_admin", "hr_admin"],
      },
      {
        method: "POST",
        pattern: /^\/v1\/teams$/,
        roles: ["super_admin", "hr_admin"],
      },
      {
        method: "PATCH",
        pattern: /^\/v1\/teams\/[^/]+$/,
        roles: ["super_admin", "hr_admin"],
      },
      {
        method: "DELETE",
        pattern: /^\/v1\/teams\/[^/]+$/,
        roles: ["super_admin", "hr_admin"],
      },
      {
        method: "GET",
        pattern: /^\/v1\/employees$/,
        roles: ["super_admin", "hr_admin", "manager", "employee"],
      },
      {
        method: "GET",
        pattern: /^\/v1\/employees\/[^/]+$/,
        roles: ["super_admin", "hr_admin", "manager", "employee"],
      },
      {
        method: "POST",
        pattern: /^\/v1\/employees$/,
        roles: ["super_admin", "hr_admin", "manager", "employee"],
      },
      {
        method: "PUT",
        pattern: /^\/v1\/employees\/[^/]+$/,
        roles: ["super_admin", "hr_admin", "manager", "employee"],
      },
      {
        method: "POST",
        pattern: /^\/v1\/employees\/[^/]+\/deactivate$/,
        roles: ["super_admin", "hr_admin"],
      },
      {
        method: "POST",
        pattern: /^\/v1\/employees\/[^/]+\/activate$/,
        roles: ["super_admin", "hr_admin"],
      },
      {
        method: "DELETE",
        pattern: /^\/v1\/employees\/[^/]+$/,
        roles: ["super_admin", "hr_admin"],
      },
      {
        method: "POST",
        pattern: /^\/v1\/leave-requests\/[^/]+\/approve$/,
        roles: ["super_admin", "hr_admin", "manager"],
      },
      {
        method: "POST",
        pattern: /^\/v1\/leave-requests\/[^/]+\/reject$/,
        roles: ["super_admin", "hr_admin", "manager"],
      },
      {
        method: "POST",
        pattern: /^\/v1\/leave-balances$/,
        roles: ["super_admin", "hr_admin"],
      },
      {
        method: "POST",
        pattern: /^\/v1\/payroll-runs$/,
        roles: ["super_admin", "hr_admin"],
      },
    ];

    const matchedRoute = protectedRoutes.find(
      (route) => route.method === req.method && route.pattern.test(req.path),
    );

    if (!matchedRoute) {
      return next();
    }

    const user = (req as AuthenticatedRequest).user;
    const hasRole = user?.role?.some((r) =>
      matchedRoute.roles.includes(r.role),
    );

    if (!hasRole) {
      return res.status(403).json({
        status: "fail",
        data: null,
        message: "You are not authorized to access this resource",
      });
    }

    next();
  };
}
