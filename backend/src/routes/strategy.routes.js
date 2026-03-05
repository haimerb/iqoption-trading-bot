'use strict';

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const strategyController = require('../controllers/strategy.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Estrategias
 *   description: Gestión de estrategias de trading
 */

/**
 * @swagger
 * /strategies/available:
 *   get:
 *     summary: Listar estrategias disponibles en el sistema
 *     tags: [Estrategias]
 *     responses:
 *       200:
 *         description: Lista de estrategias con parámetros por defecto
 */
router.get('/available', authenticate, strategyController.getAvailableStrategies);

/**
 * @swagger
 * /strategies:
 *   get:
 *     summary: Obtener estrategias activas
 *     tags: [Estrategias]
 */
router.get('/', authenticate, strategyController.getAllStrategies);

/**
 * @swagger
 * /strategies:
 *   post:
 *     summary: Crear nueva instancia de estrategia
 *     tags: [Estrategias]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [ma-crossover, rsi, bollinger-bands, grid-trading]
 *                 example: "rsi"
 *               params:
 *                 type: object
 *                 example: { period: 14, overboughtLevel: 75, amount: 20 }
 */
router.post('/',
  authenticate,
  [
    body('type').notEmpty().isString(),
    body('params').optional().isObject()
  ],
  strategyController.createStrategy
);

/**
 * @swagger
 * /strategies/{id}/start:
 *   post:
 *     summary: Iniciar una estrategia en un activo
 *     tags: [Estrategias]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [activeId]
 *             properties:
 *               activeId: { type: integer, example: 1 }
 *               candleSizes: { type: array, items: { type: integer }, example: [60, 300] }
 */
router.post('/:id/start',
  authenticate,
  [body('activeId').isInt({ min: 1 })],
  strategyController.startStrategy
);

router.post('/:id/pause', authenticate, strategyController.pauseStrategy);
router.post('/:id/resume', authenticate, strategyController.resumeStrategy);
router.delete('/:id', authenticate, strategyController.stopStrategy);
router.patch('/:id/params', authenticate, strategyController.updateStrategyParams);

module.exports = router;
