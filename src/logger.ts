import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.logLevel,
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
  redact: {
    paths: ['api_key', 'password', 'smtp_pass', 'cookies', 'authorization'],
    censor: '[REDACTED]',
  },
});
