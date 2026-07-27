import express from 'express';
import 'dotenv/config';
import checkVersion from './middlewares/version.js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { requestLogger } from './middlewares/logger.js';
import logger from './utils/logger.js';
import { validateEnv } from './utils/envValidation.js';
import { performHealthCheck, getHealthStatus } from './utils/healthCheck.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { sanitizeResponseMiddleware } from './middlewares/sanitizeResponse.js';

validateEnv();

const app = express()

const corsOrigins = process.env.CORS_ALLOWED_ORIGINS 
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [process.env.FRONTEND_URL || 'http://localhost:5173'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const cloudinaryDomain = process.env.CLOUDINARY_DOMAIN || 'res.cloudinary.com';

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", `https://${cloudinaryDomain}`],
      connectSrc: ["'self'", frontendUrl],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", `https://${cloudinaryDomain}`],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(requestLogger);
app.use(sanitizeResponseMiddleware);

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use(checkVersion());

app.get('/health', async (req, res) => {
  try {
    const health = await performHealthCheck();
    const statusCode = getHealthStatus(health);
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(process.env.PORT, () => {
  logger.info({ port: process.env.PORT }, 'App live on port');
});

const gracefulShutdown = (signal: string) => {
  logger.info({ signal }, `${signal} received, shutting down gracefully`);
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(reason)
  console.log(promise)
  
  logger.error({ reason, promise }, 'Unhandled promise rejection');
  gracefulShutdown('unhandledRejection');
});