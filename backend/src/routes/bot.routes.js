'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const connection = require('../modules/connection/iqOptionConnection');
const marketData = require('../modules/market-data/marketDataModule');
const orderExecution = require('../modules/order-execution/orderExecutionModule');
const strategyManager = require('../modules/strategies/StrategyManager');
const riskModule = require('../modules/risk-management/riskModule');
const { getQueuesStatus } = require('../modules/queue/queueWorkers');

/**
 * @swagger
 * tags:
 *   name: Bot
 *   description: Control y estado general del bot de trading
 */

/**
 * GET /api/v1/bot/status
 * Estado completo del bot
 */
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const [queuesStatus] = await Promise.all([getQueuesStatus()]);

    res.json({
      success: true,
      data: {
        connection: connection.getStatus(),
        marketData: marketData.getStatus(),
        orders: orderExecution.getStatus(),
        strategies: strategyManager.getAllStrategies(),
        risk: riskModule.getStats(),
        queues: queuesStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/bot/emergency-stop
 * Detener todas las estrategias activas de emergencia
 */
router.post('/emergency-stop', authenticate, authorize('admin', 'user'), async (req, res, next) => {
  try {
    const strategies = strategyManager.getAllStrategies();
    const stopPromises = strategies
      .filter(s => s.status === 'running')
      .map(s => strategyManager.stopStrategy(s.id).catch(e => e));

    await Promise.all(stopPromises);

    const logger = require('../modules/logger/logger');
    logger.security('EMERGENCY_STOP', {
      userId: req.user.userId,
      strategiesStopped: strategies.length
    });

    res.json({
      success: true,
      message: `Parada de emergencia ejecutada. ${strategies.length} estrategias detenidas.`,
      data: { strategiesStopped: strategies.length }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/bot/health
 * Health check detallado del sistema
 */
router.get('/health', async (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
