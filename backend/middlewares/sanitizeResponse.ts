import type { Request, Response, NextFunction } from 'express';
import { deepSanitize } from '../v1/utils/sanitizeData.js';

export function sanitizeResponseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const originalJson = res.json.bind(res);

  res.json = function (data: unknown) {
    const sanitizedData = deepSanitize(data);
    return originalJson(sanitizedData);
  };

  next();
}
