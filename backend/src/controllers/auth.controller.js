'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const logger = require('../modules/logger/logger');
const connection = require('../modules/connection/iqOptionConnection');
const CryptoJS = require('crypto-js');
const User = require('../models/User');

const users = new Map();

async function loadUsersFromDb() {
  try {
    const docs = await User.find({}).lean();
    for (const doc of docs) {
      users.set(doc.email, doc);
    }
    logger.info(`Auth: ${docs.length} usuarios cargados desde MongoDB`);
  } catch (err) {
    logger.warn('Auth: No se pudieron cargar usuarios desde MongoDB', { error: err.message });
  }
}
loadUsersFromDb();

const loginTokens = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of loginTokens) {
    if (data.expiresAt < now) loginTokens.delete(token);
  }
}, 300000);

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
    const encryptedIqPassword = CryptoJS.AES.encrypt(iqPassword, encryptionKey).toString();

    const userData = {
      email,
      password: hashedPassword,
      iqEmail,
      iqPassword: encryptedIqPassword,
      role: 'user'
    };

    const created = await User.create(userData);
    const newUser = created.toObject();
    users.set(email, newUser);

    logger.security('USER_REGISTERED', { userId: newUser._id.toString(), email });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: { userId: newUser._id, email, role: newUser.role }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Usuario ya existe', code: 'USER_EXISTS' });
    }
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validación fallida', details: errors.array() });
    }

    const { email, password } = req.body;
    let user = users.get(email);

    if (!user) {
      user = await User.findOne({ email }).lean();
      if (user) users.set(email, user);
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      logger.security('FAILED_LOGIN_ATTEMPT', { email, ip: req.ip });
      return res.status(401).json({
        success: false, error: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS'
      });
    }

    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_encryption_key_32chars_long';
    const iqPassword = CryptoJS.AES.decrypt(user.iqPassword, encryptionKey).toString(CryptoJS.enc.Utf8);

    let iqSession = null;
    try {
      iqSession = await connection.connect(user.iqEmail, iqPassword);
    } catch (iqErr) {
      logger.warn('Auth: IQ Option no disponible, continuando sin sesión', { error: iqErr.message });
    }

    const payload = {
      userId: user._id ? user._id.toString() : user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });

    await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

    logger.security('USER_LOGIN', { userId: payload.userId, email, ip: req.ip });

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        expiresIn: 86400,
        user: { id: payload.userId, email: user.email, role: user.role },
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

async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'refreshToken requerido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    let user = users.get(decoded.email);

    if (!user) {
      user = await User.findOne({ email: decoded.email }).lean();
      if (!user) {
        return res.status(401).json({ success: false, error: 'Usuario no encontrado' });
      }
      users.set(decoded.email, user);
    }

    const newToken = jwt.sign(
      { userId: user._id ? user._id.toString() : user.id, email: user.email, role: user.role },
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

async function logout(req, res, next) {
  try {
    connection.disconnect();
    logger.security('USER_LOGOUT', { userId: req.user?.userId });
    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
  } catch (err) {
    next(err);
  }
}

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

async function generateLoginToken(req, res, next) {
  try {
    let user = users.get(req.user.email);
    if (!user) {
      user = await User.findOne({ email: req.user.email }).lean();
    }
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const token = require('uuid').v4();
    loginTokens.set(token, {
      userId: user._id ? user._id.toString() : user.id,
      email: user.email,
      role: user.role,
      expiresAt: Date.now() + 300000
    });

    logger.security('LOGIN_TOKEN_GENERATED', { userId: user._id?.toString() || user.id, email: user.email });
    res.json({ success: true, data: { token, expiresIn: 300 } });
  } catch (err) {
    next(err);
  }
}

async function loginWithToken(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token requerido' });
    }

    const tokenData = loginTokens.get(token);
    if (!tokenData) {
      return res.status(401).json({ success: false, error: 'Token inválido o expirado', code: 'INVALID_LOGIN_TOKEN' });
    }

    if (tokenData.expiresAt < Date.now()) {
      loginTokens.delete(token);
      return res.status(401).json({ success: false, error: 'Token expirado', code: 'LOGIN_TOKEN_EXPIRED' });
    }

    loginTokens.delete(token);

    const payload = { userId: tokenData.userId, email: tokenData.email, role: tokenData.role };
    const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });

    res.json({
      success: true,
      data: { token: jwtToken, refreshToken, expiresIn: 86400, user: payload }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refreshToken, logout, getSessionStatus, generateLoginToken, loginWithToken };
