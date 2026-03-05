'use strict';

const jwt = require('jsonwebtoken');
const logger = require('../modules/logger/logger');

/**
 * Middleware de autenticación JWT
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token de autorización requerido',
      code: 'AUTH_TOKEN_REQUIRED'
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        code: 'AUTH_TOKEN_EXPIRED'
      });
    }
    logger.security('INVALID_TOKEN_ATTEMPT', {
      ip: req.ip,
      token: token.slice(0, 20) + '...'
    });
    return res.status(401).json({
      success: false,
      error: 'Token inválido',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
}

/**
 * Middleware de verificación de roles
 * @param {...string} roles - Roles permitidos
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado',
        code: 'AUTH_REQUIRED'
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      logger.security('UNAUTHORIZED_ACCESS_ATTEMPT', {
        userId: req.user.userId,
        requiredRoles: roles,
        userRole: req.user.role,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes',
        code: 'AUTH_FORBIDDEN'
      });
    }

    next();
  };
}

module.exports = { authenticate, authorize };
