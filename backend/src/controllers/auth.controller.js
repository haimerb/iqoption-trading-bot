'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const logger = require('../modules/logger/logger');
const connection = require('../modules/connection/iqOptionConnection');
const CryptoJS = require('crypto-js');
const { users: seededUsers } = require('../modules/seed/users');

const users = seededUsers;

/**
 * Registrar usuario en el sistema local
 * POST /api/v1/auth/register
 */
async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validación fallida', details: errors.array() });
    }

    const { email, password, iqEmail, iqPassword } = req.body;

    if (users.has(email)) {
      return res.status(409).json({
        success: false, error: 'Usuario ya existe', code: 'USER_EXISTS'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_encryption_key_32chars_long';
    const encryptedIqPassword = CryptoJS.AES.encrypt(
      iqPassword,
      encryptionKey
    ).toString();

    const userId = require('uuid').v4();
    const user = {
      id: userId,
      email,
      password: hashedPassword,
      iqEmail,
      iqPassword: encryptedIqPassword,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    users.set(email, user);

    logger.security('USER_REGISTERED', { userId, email });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: { userId, email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Login en el sistema y autenticar con IQ Option
 * POST /api/v1/auth/login
 */
async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validación fallida', details: errors.array() });
    }

    const { email, password } = req.body;
    const user = users.get(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      logger.security('FAILED_LOGIN_ATTEMPT', { email, ip: req.ip });
      return res.status(401).json({
        success: false, error: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS'
      });
    }

    // Desencriptar credenciales IQ Option
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_encryption_key_32chars_long';
    const iqPassword = CryptoJS.AES.decrypt(
      user.iqPassword,
      encryptionKey
    ).toString(CryptoJS.enc.Utf8);

    // Conectar con IQ Option (opcional - no falla el login)
    let iqSession = null;
    try {
      iqSession = await connection.connect(user.iqEmail, iqPassword);
    } catch (iqErr) {
      logger.warn('Auth: IQ Option no disponible, continuando sin sesión', { error: iqErr.message });
    }

    // Generar JWT
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });

    logger.security('USER_LOGIN', { userId: user.id, email, ip: req.ip });

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        expiresIn: 86400,
        user: { id: user.id, email: user.email, role: user.role },
        iqSession: {
          balance: iqSession?.balance || 10000,
          currency: iqSession?.currency || 'USD',
          userId: iqSession?.userId || null,
          connected: !!iqSession
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Refrescar token JWT
 * POST /api/v1/auth/refresh
 */
async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'refreshToken requerido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = users.get(decoded.email);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuario no encontrado' });
    }

    const newToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({ success: true, data: { token: newToken, expiresIn: 86400 } });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Refresh token expirado', code: 'REFRESH_TOKEN_EXPIRED' });
    }
    next(err);
  }
}

/**
 * Logout - desconectar de IQ Option
 * POST /api/v1/auth/logout
 */
async function logout(req, res, next) {
  try {
    connection.disconnect();
    logger.security('USER_LOGOUT', { userId: req.user?.userId });
    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
  } catch (err) {
    next(err);
  }
}

/**
 * Estado de la sesión actual
 * GET /api/v1/auth/status
 */
async function getSessionStatus(req, res) {
  const status = connection.getStatus();
  res.json({
    success: true,
    data: {
      isConnected: status.isConnected,
      isAuthenticated: status.isAuthenticated,
      session: status.sessionData
    }
  });
}

module.exports = { register, login, refreshToken, logout, getSessionStatus };
