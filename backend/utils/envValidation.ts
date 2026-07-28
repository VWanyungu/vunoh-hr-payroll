import "dotenv/config";
import logger from "./logger.js";

interface EnvVarConfig {
  name: string;
  required: boolean;
  description: string;
}

const envVars: EnvVarConfig[] = [
  // Database
  { name: "DB_HOST", required: true, description: "Database host" },
  { name: "DB_PORT", required: true, description: "Database port" },
  { name: "DB_USER", required: true, description: "Database user" },
  { name: "DB_PASSWORD", required: true, description: "Database password" },
  { name: "DB_NAME", required: true, description: "Database name" },

  // Redis
  // { name: "REDIS_URL", required: true, description: "Redis URL" },
  // { name: "REDIS_TOKEN", required: true, description: "Redis token" },

  // JWT Secrets
  {
    name: "ACCESS_TOKEN_SECRET",
    required: true,
    description: "Access token secret",
  },
  {
    name: "REFRESH_TOKEN_SECRET",
    required: true,
    description: "Refresh token secret",
  },
  {
    name: "FORGOT_PASSWORD_TOKEN_SECRET",
    required: true,
    description: "Forgot password token secret",
  },
  { name: "TOKEN_EXPIRY", required: true, description: "Token expiry time" },
  {
    name: "TOKEN_EXPIRY_ABSOLUTE",
    required: true,
    description: "Token absolute expiry time",
  },
  {
    name: "TOKEN_EXPIRY_SECONDS",
    required: true,
    description: "Token expiry in seconds",
  },

  // URLs
  { name: "FRONTEND_URL", required: true, description: "Frontend URL" },
  { name: "BACKEND_URL", required: true, description: "Backend URL" },

  // Email (SendGrid)
  // { name: "SENDGRID_USER", required: true, description: "SendGrid user" },
  // {
  //   name: "SENDGRID_PASSWORD",
  //   required: true,
  //   description: "SendGrid password",
  // },
  // { name: "MAIL_FROM", required: true, description: "From email address" },

  // Server
  { name: "PORT", required: true, description: "Server port" },
  {
    name: "NODE_ENV",
    required: true,
    description: "Node environment (development/production)",
  },

  // CORS
  {
    name: "CORS_ALLOWED_ORIGINS",
    required: false,
    description: "Comma-separated list of allowed CORS origins",
  },
];

export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of envVars) {
    const value = process.env[envVar.name];

    if (envVar.required && !value) {
      missing.push(envVar.name);
    } else if (!envVar.required && !value) {
      warnings.push(`${envVar.name} (${envVar.description})`);
    }
  }

  if (missing.length > 0) {
    logger.error({ missing }, "Missing required environment variables");
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `Please check your .env file and ensure all required variables are set.`,
    );
  }

  if (warnings.length > 0) {
    logger.warn(
      { warnings },
      "Optional environment variables not set (using defaults)",
    );
  }

  // Validate specific formats
  const port = parseInt(process.env.PORT || "3000");
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT value: ${process.env.PORT}. Must be between 1 and 65535.`,
    );
  }

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && !["development", "production", "test"].includes(nodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'production', or 'test'.`,
    );
  }

  logger.info("Environment variables validated successfully");
}

export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    throw new Error(
      `Environment variable ${name} is not set and no default provided`,
    );
  }
  return value || defaultValue || "";
}
