'use strict';

const Bull = require('bull');
const logger = require('../logger/logger');

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

// Crear colas
const orderQueue = new Bull('order-execution', { redis: REDIS_CONFIG });
const marketDataQueue = new Bull('market-data', { redis: REDIS_CONFIG });
const strategyQueue = new Bull('strategy-analysis', { redis: REDIS_CONFIG });

/**
 * Inicializar workers para todas las colas
 */
function initQueueWorkers() {
  // =====================
  // Worker: Ejecución de Órdenes
  // =====================
  orderQueue.process('open-order', 3, async (job) => {
    const orderExecution = require('../order-execution/orderExecutionModule');
    const { params, userId } = job.data;
    logger.info('Queue [order]: Procesando apertura de orden', { jobId: job.id, params });
    return await orderExecution.openOrder(params);
  });

  orderQueue.process('close-position', 3, async (job) => {
    const orderExecution = require('../order-execution/orderExecutionModule');
    const { positionId } = job.data;
    return await orderExecution.closePosition(positionId);
  });

  orderQueue.on('completed', (job, result) => {
    logger.trading('QUEUE_ORDER_COMPLETED', { jobId: job.id, result });
  });

  orderQueue.on('failed', (job, err) => {
    logger.error('Queue [order]: Job fallido', { jobId: job.id, error: err.message });
  });

  // =====================
  // Worker: Market Data
  // =====================
  marketDataQueue.process('fetch-candles', 5, async (job) => {
    const marketData = require('../market-data/marketDataModule');
    const { activeId, size, count } = job.data;
    return await marketData.getHistoricalCandles(activeId, size, count);
  });

  // =====================
  // Worker: Análisis de Estrategias
  // =====================
  strategyQueue.process('analyze', 5, async (job) => {
    const strategyManager = require('../strategies/StrategyManager');
    const { strategyId, candles, currentPrice } = job.data;
    const strategy = strategyManager.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);
    return await strategy.analyze(candles, currentPrice);
  });

  // Monitoreo
  [orderQueue, marketDataQueue, strategyQueue].forEach(queue => {
    queue.on('error', (err) => {
      logger.error(`Queue [${queue.name}]: Error de cola`, { error: err.message });
    });
    queue.on('stalled', (job) => {
      logger.warn(`Queue [${queue.name}]: Job estancado`, { jobId: job.id });
    });
  });

  logger.info('Queue workers inicializados', {
    queues: [orderQueue.name, marketDataQueue.name, strategyQueue.name]
  });
}

/**
 * Agregar orden a la cola
 */
async function queueOrder(params, userId, options = {}) {
  return orderQueue.add('open-order', { params, userId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
    ...options
  });
}

/**
 * Obtener estado de las colas
 */
async function getQueuesStatus() {
  const [orderCounts, marketCounts, strategyCounts] = await Promise.all([
    orderQueue.getJobCounts(),
    marketDataQueue.getJobCounts(),
    strategyQueue.getJobCounts()
  ]);

  return {
    orderQueue: orderCounts,
    marketDataQueue: marketCounts,
    strategyQueue: strategyCounts
  };
}

module.exports = {
  initQueueWorkers,
  queueOrder,
  getQueuesStatus,
  orderQueue,
  marketDataQueue,
  strategyQueue
};
