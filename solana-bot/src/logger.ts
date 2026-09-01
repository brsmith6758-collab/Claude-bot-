import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: ts }) => `${ts} [${level}] ${message}`);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), consoleFormat),
    }),
    new winston.transports.File({
      filename: 'logs/bot.log',
      format: combine(timestamp(), winston.format.json()),
    }),
    new winston.transports.File({
      filename: 'logs/trades.log',
      level: 'info',
      format: combine(timestamp(), winston.format.json()),
    }),
  ],
});
