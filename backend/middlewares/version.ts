import type { NextFunction, Request, Response } from "express";
import v1Router from "../v1/index.js";

export default function checkVersion() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/health")) {
      next();
      return;
    }

    if (req.path.startsWith("/v1")) {
      v1Router(req, res, next);
      return;
    }

    res.status(404).json({
      error: "API version missing or unsupported.",
    });
  };
}
