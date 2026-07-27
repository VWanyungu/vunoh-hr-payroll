import type { NextFunction, Request, Response } from "express";

export default function checkVersion(){
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith("/health")) {
            next();
            return;
        }

        if (req.path.startsWith("/v1")) {
            next();
            return;
        }

        res.status(404).json({
            error: "API version missing or unsupported."
        });
    }
}