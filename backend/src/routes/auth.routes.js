'use strict';

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authRateLimiter } = require('../middlewares/rateLimiter');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Autenticación
 *   description: Gestión de sesiones y tokens JWT
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, iqEmail, iqPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               iqEmail: { type: string, format: email }
 *               iqPassword: { type: string }
 *     responses:
 *       201: { description: Usuario registrado }
 *       409: { description: Usuario ya existe }
 */
router.post('/register',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('iqEmail').isEmail().normalizeEmail(),
    body('iqPassword').notEmpty()
  ],
  authController.register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión y conectar con IQ Option
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *               password: { type: string, example: "mypassword123" }
 *     responses:
 *       200:
 *         description: Login exitoso con token JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string }
 *                     refreshToken: { type: string }
 *                     expiresIn: { type: integer }
 *       401: { description: Credenciales inválidas }
 *       502: { description: Error conexión IQ Option }
 */
router.post('/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  authController.login
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refrescar token JWT
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Nuevo token generado }
 *       401: { description: Refresh token expirado }
 */
router.post('/refresh', authController.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión y desconectar de IQ Option
 *     tags: [Autenticación]
 *     responses:
 *       200: { description: Sesión cerrada }
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /auth/status:
 *   get:
 *     summary: Estado de la sesión actual
 *     tags: [Autenticación]
 *     responses:
 *       200: { description: Estado de conexión con IQ Option }
 */
router.get('/status', authenticate, authController.getSessionStatus);

module.exports = router;
