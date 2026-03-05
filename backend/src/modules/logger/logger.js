'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `[${timestamp}] ${level}: ${message} ${metaStr}`;
  })
);

const transports = [
  // Consola
  new winston.transports.Console({
    format: consoleFormat,
    silent: process.env.NODE_ENV === 'test'
  }),
  // Archivo rotativo - todos los logs
  new DailyRotateFile({
    filename: path.join(LOG_DIR, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat
  }),
  // Archivo rotativo - solo errores
  new DailyRotateFile({
    filename: path.join(LOG_DIR, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: logFormat
  }),
  // Archivo rotativo - trading (auditoría)
  new DailyRotateFile({
    filename: path.join(LOG_DIR, 'trading-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '50m',
    maxFiles: '90d',
    format: logFormat
  })
];

const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  exitOnError: false
});

/**
 * Logger especializado para operaciones de trading (auditoría)
 */
logger.trading = (action, data) => {
  logger.info(`[TRADING] ${action}`, {
    category: 'TRADING_AUDIT',
    action,
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Logger especializado para seguridad
 */
logger.security = (event, data) => {
  logger.warn(`[SECURITY] ${event}`, {
    category: 'SECURITY_AUDIT',
    event,
    ...data,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;
