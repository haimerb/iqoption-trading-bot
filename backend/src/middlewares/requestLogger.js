'use strict';

const logger = require('../modules/logger/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Middleware de logging de requests HTTP
 */
function requestLogger(req, res, next) {
  const requestId = uuidv4();
  req.requestId = requestId;
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](`${req.method} ${req.originalUrl}`, {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });

  next();
}

module.exports = { requestLogger };
