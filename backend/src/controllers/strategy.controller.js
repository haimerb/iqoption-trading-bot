'use strict';

const strategyManager = require('../modules/strategies/StrategyManager');
const { validationResult } = require('express-validator');

/**
 * Obtener estrategias disponibles en el registro
 * GET /api/v1/strategies/available
 */
async function getAvailableStrategies(req, res, next) {
  try {
    const available = strategyManager.getAvailableStrategies();
    res.json({ success: true, data: available });
  } catch (err) {
    next(err);
  }
}

/**
 * Obtener todas las estrategias activas
 * GET /api/v1/strategies
 */
async function getAllStrategies(req, res, next) {
  try {
    const strategies = strategyManager.getAllStrategies();
    res.json({ success: true, data: strategies, count: strategies.length });
  } catch (err) {
    next(err);
  }
}

/**
 * Crear una nueva estrategia
 * POST /api/v1/strategies
 */
async function createStrategy(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validación fallida', details: errors.array() });
    }
    const { type, params } = req.body;
    const strategy = strategyManager.createStrategy(type, params);
    res.status(201).json({ success: true, data: strategy });
  } catch (err) {
    if (err.message.includes('desconocido')) {
      return res.status(400).json({ success: false, error: err.message, code: 'UNKNOWN_STRATEGY' });
    }
    next(err);
  }
}

/**
 * Iniciar una estrategia
 * POST /api/v1/strategies/:id/start
 */
async function startStrategy(req, res, next) {
  try {
    const { id } = req.params;
    const { activeId, candleSizes = [60] } = req.body;

    if (!activeId) {
      return res.status(400).json({ success: false, error: 'activeId es requerido' });
    }

    const strategy = await strategyManager.startStrategy(id, activeId, candleSizes);
    res.json({ success: true, data: strategy });
  } catch (err) {
    if (err.message.includes('no encontrada')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    next(err);
  }
}

/**
 * Pausar estrategia
 * POST /api/v1/strategies/:id/pause
 */
async function pauseStrategy(req, res, next) {
  try {
    const strategy = await strategyManager.pauseStrategy(req.params.id);
    res.json({ success: true, data: strategy });
  } catch (err) {
    next(err);
  }
}

/**
 * Resumir estrategia
 * POST /api/v1/strategies/:id/resume
 */
async function resumeStrategy(req, res, next) {
  try {
    const strategy = await strategyManager.resumeStrategy(req.params.id);
    res.json({ success: true, data: strategy });
  } catch (err) {
    next(err);
  }
}

/**
 * Detener y eliminar estrategia
 * DELETE /api/v1/strategies/:id
 */
async function stopStrategy(req, res, next) {
  try {
    await strategyManager.stopStrategy(req.params.id);
    res.json({ success: true, message: 'Estrategia detenida y eliminada' });
  } catch (err) {
    next(err);
  }
}

/**
 * Actualizar parámetros de estrategia
 * PATCH /api/v1/strategies/:id/params
 */
async function updateStrategyParams(req, res, next) {
  try {
    const strategy = strategyManager.updateStrategyParams(req.params.id, req.body);
    res.json({ success: true, data: strategy });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAvailableStrategies,
  getAllStrategies,
  createStrategy,
  startStrategy,
  pauseStrategy,
  resumeStrategy,
  stopStrategy,
  updateStrategyParams
};
