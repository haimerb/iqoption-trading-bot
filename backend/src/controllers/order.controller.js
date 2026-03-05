'use strict';

const orderExecution = require('../modules/order-execution/orderExecutionModule');
const { queueOrder } = require('../modules/queue/queueWorkers');
const { validationResult } = require('express-validator');

/**
 * Abrir una nueva orden
 * POST /api/v1/orders/open
 */
async function openOrder(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validación fallida', details: errors.array() });
    }

    const { activeId, direction, amount, duration, orderType = 'digital' } = req.body;

    // Agregar a cola de ejecución
    const job = await queueOrder(
      { activeId, direction, amount, duration, orderType },
      req.user.userId
    );

    res.status(202).json({
      success: true,
      message: 'Orden enviada a la cola de ejecución',
      data: { jobId: job.id }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Cerrar una posición abierta
 * POST /api/v1/orders/close/:positionId
 */
async function closePosition(req, res, next) {
  try {
    const { positionId } = req.params;
    const result = await orderExecution.closePosition(positionId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * Obtener posiciones abiertas
 * GET /api/v1/orders/open
 */
async function getOpenPositions(req, res, next) {
  try {
    const positions = orderExecution.getOpenPositions();
    res.json({ success: true, data: positions, count: positions.length });
  } catch (err) {
    next(err);
  }
}

/**
 * Obtener historial de órdenes en memoria
 * GET /api/v1/orders/history
 */
async function getOrderHistory(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = orderExecution.getOrderHistory(limit);
    res.json({ success: true, data: history, count: history.length });
  } catch (err) {
    next(err);
  }
}

/**
 * Estado del módulo de órdenes
 * GET /api/v1/orders/status
 */
async function getOrdersStatus(req, res, next) {
  try {
    res.json({ success: true, data: orderExecution.getStatus() });
  } catch (err) {
    next(err);
  }
}

module.exports = { openOrder, closePosition, getOpenPositions, getOrderHistory, getOrdersStatus };
