'use strict';

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { orderRateLimiter } = require('../middlewares/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Órdenes
 *   description: Apertura y gestión de posiciones en IQ Option
 */

/**
 * @swagger
 * /orders/open:
 *   post:
 *     summary: Abrir una nueva operación
 *     tags: [Órdenes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [activeId, direction, amount, duration]
 *             properties:
 *               activeId: { type: integer, example: 1 }
 *               direction: { type: string, enum: [call, put], example: "call" }
 *               amount: { type: number, minimum: 1, example: 10 }
 *               duration: { type: integer, example: 60 }
 *               orderType: { type: string, enum: [digital, binary, turbo], default: "digital" }
 *     responses:
 *       202: { description: Orden enviada a cola de ejecución }
 *       400: { description: Validación fallida }
 *       429: { description: Rate limit de órdenes alcanzado }
 */
router.post('/open',
  authenticate,
  orderRateLimiter,
  [
    body('activeId').isInt({ min: 1 }),
    body('direction').isIn(['call', 'put']),
    body('amount').isFloat({ min: 1 }),
    body('duration').isInt({ min: 5 }),
    body('orderType').optional().isIn(['digital', 'binary', 'turbo'])
  ],
  orderController.openOrder
);

/**
 * @swagger
 * /orders/close/{positionId}:
 *   post:
 *     summary: Cerrar una posición abierta
 *     tags: [Órdenes]
 *     parameters:
 *       - in: path
 *         name: positionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Posición cerrada }
 *       404: { description: Posición no encontrada }
 */
router.post('/close/:positionId', authenticate, orderController.closePosition);

/**
 * @swagger
 * /orders/open:
 *   get:
 *     summary: Obtener posiciones abiertas
 *     tags: [Órdenes]
 *     responses:
 *       200: { description: Lista de posiciones abiertas }
 */
router.get('/open', authenticate, orderController.getOpenPositions);

/**
 * @swagger
 * /orders/history:
 *   get:
 *     summary: Historial de órdenes recientes
 *     tags: [Órdenes]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: Historial de órdenes }
 */
router.get('/history', authenticate, orderController.getOrderHistory);

router.get('/status', authenticate, orderController.getOrdersStatus);

module.exports = router;
