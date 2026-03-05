'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const orderExecution = require('../modules/order-execution/orderExecutionModule');

/**
 * @swagger
 * tags:
 *   name: Historial
 *   description: Historial de operaciones y estadísticas P&L
 */

/**
 * GET /api/v1/history
 * Historial completo de operaciones
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const history = orderExecution.getOrderHistory(limit);

    // Calcular estadísticas
    const stats = history.reduce((acc, order) => {
      acc.totalOrders++;
      acc.totalPnl += order.pnl || 0;
      if ((order.pnl || 0) > 0) acc.wins++;
      else acc.losses++;
      return acc;
    }, { totalOrders: 0, wins: 0, losses: 0, totalPnl: 0 });

    stats.winRate = stats.totalOrders > 0
      ? ((stats.wins / stats.totalOrders) * 100).toFixed(2)
      : 0;

    res.json({ success: true, data: history, stats, count: history.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/history/stats
 * Estadísticas resumidas
 */
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const history = orderExecution.getOrderHistory(500);
    const openPositions = orderExecution.getOpenPositions();

    const closedStats = history.reduce((acc, o) => {
      acc.total++;
      acc.totalPnl += o.pnl || 0;
      if ((o.pnl || 0) > 0) { acc.wins++; acc.totalProfit += o.pnl; }
      else { acc.losses++; acc.totalLoss += Math.abs(o.pnl || 0); }
      return acc;
    }, { total: 0, wins: 0, losses: 0, totalPnl: 0, totalProfit: 0, totalLoss: 0 });

    res.json({
      success: true,
      data: {
        closed: { ...closedStats, winRate: closedStats.total > 0 ? (closedStats.wins / closedStats.total * 100).toFixed(2) + '%' : '0%' },
        open: { count: openPositions.length, positions: openPositions },
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
