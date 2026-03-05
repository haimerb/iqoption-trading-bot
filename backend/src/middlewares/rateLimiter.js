'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter general para la API
 */
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Por favor espera antes de reintentar.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

/**
 * Rate limiter estricto para autenticación (evitar fuerza bruta)
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: {
    success: false,
    error: 'Demasiados intentos de autenticación. Intenta en 15 minutos.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

/**
 * Rate limiter para ejecución de órdenes (evitar spam)
 */
const orderRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,
  message: {
    success: false,
    error: 'Límite de órdenes por minuto alcanzado.',
    code: 'ORDER_RATE_LIMIT_EXCEEDED'
  }
});

module.exports = { rateLimiter, authRateLimiter, orderRateLimiter };
