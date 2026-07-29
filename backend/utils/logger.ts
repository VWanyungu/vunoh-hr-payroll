import pino from 'pino';
import * as rfs from 'rotating-file-stream';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV !== 'production';

const stream = rfs.createStream('app.log', {
  path: path.join(__dirname, '../logs'),
  size: '10M',
  interval: '1d',
  compress: 'gzip',
  maxFiles: 1,
});

const logger = pino(
  {
    level: logLevel,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isDevelopment
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      })
    : pino.multistream([
        { stream },
        { level: 'error', stream: process.stderr },
      ])
);

export default logger;
