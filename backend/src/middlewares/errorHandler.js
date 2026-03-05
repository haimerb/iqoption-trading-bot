'use strict';

const logger = require('../modules/logger/logger');

/**
 * Manejador global de errores
 */
function errorHandler(err, req, res, next) {
  // Log del error
  logger.error('Error no manejado', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    body: req.method !== 'GET' ? req.body : undefined
  });

  // Error de validación (express-validator / Joi)
  if (err.name === 'ValidationError' || err.isJoi) {
    return res.status(400).json({
      success: false,
      error: 'Error de validación',
      details: err.details || err.message,
      code: 'VALIDATION_ERROR'
    });
  }

  // Error de MongoDB (datos duplicados)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Recurso duplicado',
      code: 'DUPLICATE_RESOURCE'
    });
  }

  // Error JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }

  // Error personalizado con statusCode
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code || 'APP_ERROR'
    });
  }

  // Error genérico del servidor
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
    code: 'INTERNAL_ERROR'
  });
}

/**
 * Crear error personalizado con statusCode
 */
function createError(message, statusCode = 500, code = 'APP_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

module.exports = { errorHandler, createError };
