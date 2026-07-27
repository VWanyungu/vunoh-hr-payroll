import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || Math.random().toString(36).substring(7);

  req.id = requestId;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    const logData = {
      requestId,
      method,
      originalUrl,
      ip,
      statusCode,
      // req,
      // res,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
    };

    if (statusCode >= 500) {
      logger.error(logData, 'Request completed with server error');
    } else if (statusCode >= 400) {
      logger.warn(logData, 'Request completed with client error');
    } else {
      logger.info(logData, 'Request completed successfully');
    }
  });

  next();
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}
