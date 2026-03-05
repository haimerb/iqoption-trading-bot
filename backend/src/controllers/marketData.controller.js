'use strict';

const marketData = require('../modules/market-data/marketDataModule');

/**
 * Obtener precio actual de un activo
 * GET /api/v1/market-data/price/:activeId
 */
async function getCurrentPrice(req, res, next) {
  try {
    const activeId = parseInt(req.params.activeId);
    const price = marketData.getCurrentPrice(activeId);

    if (!price) {
      return res.status(404).json({
        success: false,
        error: `No hay precio en caché para activo ${activeId}. Suscríbete primero.`,
        code: 'PRICE_NOT_FOUND'
      });
    }

    res.json({ success: true, data: price });
  } catch (err) {
    next(err);
  }
}

/**
 * Obtener velas históricas
 * GET /api/v1/market-data/candles/:activeId
 */
async function getCandles(req, res, next) {
  try {
    const activeId = parseInt(req.params.activeId);
    const size = parseInt(req.query.size) || 60;
    const count = Math.min(parseInt(req.query.count) || 100, 500);

    const candles = await marketData.getHistoricalCandles(activeId, size, count);
    res.json({ success: true, data: candles, count: candles.length });
  } catch (err) {
    next(err);
  }
}

/**
 * Suscribirse a datos en tiempo real de un activo
 * POST /api/v1/market-data/subscribe
 */
async function subscribeToAsset(req, res, next) {
  try {
    const { activeId, symbol, sizes = [60] } = req.body;

    if (!activeId || !symbol) {
      return res.status(400).json({ success: false, error: 'activeId y symbol son requeridos' });
    }

    marketData.subscribe(activeId, symbol, sizes);
    res.json({
      success: true,
      message: `Suscrito a ${symbol} (${activeId})`,
      data: { activeId, symbol, sizes }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Desuscribirse de un activo
 * POST /api/v1/market-data/unsubscribe
 */
async function unsubscribeFromAsset(req, res, next) {
  try {
    const { activeId } = req.body;
    marketData.unsubscribe(activeId);
    res.json({ success: true, message: `Desuscrito de activo ${activeId}` });
  } catch (err) {
    next(err);
  }
}

/**
 * Estado del módulo de market data
 * GET /api/v1/market-data/status
 */
async function getMarketDataStatus(req, res, next) {
  try {
    res.json({ success: true, data: marketData.getStatus() });
  } catch (err) {
    next(err);
  }
}

/**
 * Obtener activos disponibles
 * GET /api/v1/market-data/instruments
 */
async function getInstruments(req, res, next) {
  try {
    const instruments = await marketData.getAvailableAssets();
    res.json({ success: true, data: instruments, count: instruments.length });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCurrentPrice,
  getCandles,
  subscribeToAsset,
  unsubscribeFromAsset,
  getMarketDataStatus,
  getInstruments
};
