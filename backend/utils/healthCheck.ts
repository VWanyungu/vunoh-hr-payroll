import db from '../v1/database/dbSetup.js';
import redis from '../v1/database/cacheSetup.js';
import logger from './logger.js';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    externalServices: ServiceHealth;
  };
  environment: string;
}

interface ServiceHealth {
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
}

async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    await db.raw('SELECT 1');
    const responseTime = Date.now() - startTime;
    return { status: 'up', responseTime };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Database health check failed');
    return { status: 'down', error: errorMessage };
  }
}

async function checkRedis(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    await redis.ping();
    const responseTime = Date.now() - startTime;
    return { status: 'up', responseTime };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Redis health check failed');
    return { status: 'down', error: errorMessage };
  }
}

async function checkExternalServices(): Promise<ServiceHealth> {
  const startTime = Date.now();
  const checks: Promise<boolean>[] = [];

  // Check M-Pesa configuration
  const mpesaConfigured = !!(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_SHORTCODE &&
    process.env.MPESA_PASSKEY
  );
  checks.push(Promise.resolve(mpesaConfigured));

  // Check SendGrid configuration
  const sendgridConfigured = !!(
    process.env.SENDGRID_USER &&
    process.env.SENDGRID_PASSWORD
  );
  checks.push(Promise.resolve(sendgridConfigured));

  // Check Cloudinary configuration
  const cloudinaryConfigured = !!process.env.CLOUDINARY_DOMAIN;
  checks.push(Promise.resolve(cloudinaryConfigured));

  try {
    const results = await Promise.all(checks);
    const allConfigured = results.every(result => result === true);
    const responseTime = Date.now() - startTime;
    
    if (allConfigured) {
      return { status: 'up', responseTime };
    } else {
      return { 
        status: 'down', 
        error: 'Some external services are not properly configured',
        responseTime 
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'External services health check failed');
    return { status: 'down', error: errorMessage };
  }
}

export async function performHealthCheck(): Promise<HealthCheckResult> {
  const [dbHealth, redisHealth, externalHealth] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkExternalServices(),
  ]);

  const allHealthy = 
    dbHealth.status === 'up' && 
    redisHealth.status === 'up' && 
    externalHealth.status === 'up';

  const someHealthy = 
    dbHealth.status === 'up' || 
    redisHealth.status === 'up' || 
    externalHealth.status === 'up';

  let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
  if (allHealthy) {
    overallStatus = 'healthy';
  } else if (someHealthy) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'unhealthy';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbHealth,
      redis: redisHealth,
      externalServices: externalHealth,
    },
    environment: process.env.NODE_ENV || 'unknown',
  };
}

export function getHealthStatus(health: HealthCheckResult): number {
  switch (health.status) {
    case 'healthy':
      return 200;
    case 'degraded':
      return 200; // Still return 200 but with degraded status
    case 'unhealthy':
      return 503;
    default:
      return 500;
  }
}
