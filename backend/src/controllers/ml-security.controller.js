'use strict';

const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');
const axios = require('axios');
const { createError } = require('../middlewares/errorHandler');
const logger = require('../modules/logger/logger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const MULTI_API_KEYS = process.env.ML_API_KEYS 
  ? process.env.ML_API_KEYS.split(',').map(k => k.trim())
  : process.env.ML_PUBLIC_API_KEY 
    ? [process.env.ML_PUBLIC_API_KEY]
    : [];

const WHITELISTED_IPS = process.env.ML_WHITELIST_IPS
  ? process.env.ML_WHITELIST_IPS.split(',').map(ip => ip.trim())
  : [];

let failedAttempts = new Map();
let requestLog = [];

function isValidApiKey(key) {
  if (MULTI_API_KEYS.length === 0) return true;
  return MULTI_API_KEYS.includes(key);
}

function isWhitelistedIP(ip) {
  if (WHITELISTED_IPS.length === 0) return true;
  return WHITELISTED_IPS.includes(ip);
}

function logRequest(req, isBlocked, reason) {
  const entry = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    apiKey: req.headers['x-api-key']?.substring(0, 8) + '...',
    endpoint: req.path,
    blocked: isBlocked,
    reason
  };
  
  requestLog.unshift(entry);
  if (requestLog.length > 1000) requestLog = requestLog.slice(0, 1000);
  
  if (isBlocked) {
    logger.warn('ML API blocked request', entry);
  }
}

module.exports = {
  getHealth(req, res, next) {
    axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 })
      .then(response => res.json({ success: true, data: response.data }))
      .catch(() => res.json({ success: true, data: { status: 'unavailable', service: 'ml-predictor' } }));
  },

  publicPredict(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, details: errors.array() });
    }

    const clientIP = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const apiKey = req.headers['x-api-key'];

    if (MULTI_API_KEYS.length > 0 && !apiKey) {
      logRequest(req, true, 'No API key provided');
      return res.status(401).json({ success: false, error: 'API key requerida', code: 'API_KEY_REQUIRED' });
    }

    if (apiKey && !isValidApiKey(apiKey)) {
      const keyHash = apiKey.substring(0, 8);
      const attempts = failedAttempts.get(keyHash) || 0;
      failedAttempts.set(keyHash, attempts + 1);
      
      logRequest(req, true, 'Invalid API key');
      
      if (attempts + 1 >= 5) {
        return res.status(429).json({ 
          success: false, 
          error: 'Demasiados intentos fallidos. Cuenta bloqueada por 1 hora',
          code: 'ACCOUNT_LOCKED'
        });
      }
      
      return res.status(401).json({ 
        success: false, 
        error: `API key inválida. Intentos restantes: ${5 - attempts - 1}`,
        code: 'INVALID_API_KEY'
      });
    }

    if (WHITELISTED_IPS.length > 0 && !isWhitelistedIP(clientIP)) {
      logRequest(req, true, 'IP not whitelisted');
      return res.status(403).json({ 
        success: false, 
        error: 'Tu IP no está autorizada',
        code: 'IP_NOT_AUTHORIZED'
      });
    }

    failedAttempts.delete(apiKey?.substring(0, 8));

    const { candles, asset, timeframe } = req.body;

    if (!candles || candles.length < 20) {
      logRequest(req, true, 'Insufficient candles');
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren al menos 20 velas',
        code: 'INSUFFICIENT_DATA'
      });
    }

    const validCandles = candles.map(c => ({
      open: c.open || c.close,
      high: c.high || c.close,
      low: c.low || c.close,
      close: c.close,
      volume: c.volume || 0
    }));

    axios.post(
      `${ML_SERVICE_URL}/predict`,
      { candles: validCandles, asset: asset || 'EURUSD', timeframe: timeframe || '1m' },
      { timeout: 15000 }
    )
    .then(response => {
      logRequest(req, false, 'Success');
      res.json({ success: true, data: response.data });
    })
    .catch(err => {
      logRequest(req, true, 'ML service error');
      next(createError('ML Service no disponible', 503, 'SERVICE_UNAVAILABLE'));
    });
  },

  predict(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, details: errors.array() });
      }

      const { candles, asset, timeframe } = req.body;

      if (!candles || candles.length < 20) {
        throw createError('Se requieren al menos 20 velas', 400, 'INSUFFICIENT_DATA');
      }

      const validCandles = candles.map(c => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0
      }));

      axios.post(
        `${ML_SERVICE_URL}/predict`,
        { candles: validCandles, asset: asset || 'EURUSD', timeframe: timeframe || '1m' },
        { timeout: 15000 }
      )
      .then(response => res.json({ success: true, data: response.data }))
      .catch(err => {
        if (err.response) {
          next(createError(err.response.data?.detail || 'Error en ML Service', 500, 'ML_ERROR'));
        } else {
          next(createError('ML Service no disponible', 503, 'SERVICE_UNAVAILABLE'));
        }
      });
    } catch (err) {
      next(err);
    }
  },

  train(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, details: errors.array() });
      }

      const { candles, labels, asset, modelType, timeframe } = req.body;

      if (!candles || candles.length < 100) {
        throw createError('Se requieren al menos 100 velas para entrenar', 400, 'INSUFFICIENT_DATA');
      }

      if (!labels || labels.length !== candles.length) {
        throw createError('Labels deben tener la misma longitud que candles', 400, 'INVALID_LABELS');
      }

      const validCandles = candles.map(c => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0
      }));

      axios.post(
        `${ML_SERVICE_URL}/train`,
        {
          candles: validCandles,
          labels,
          asset: asset || 'EURUSD',
          timeframe: timeframe || '1m',
          model_type: modelType || 'gradient_boosting'
        },
        { timeout: 60000 }
      )
      .then(response => {
        logger.info('Modelo entrenado', { asset: asset || 'EURUSD', accuracy: response.data.accuracy });
        res.json({ success: true, data: response.data });
      })
      .catch(err => {
        if (err.response) {
          next(createError(err.response.data?.detail || 'Error en entrenamiento', 500, 'TRAIN_ERROR'));
        } else {
          next(createError('ML Service no disponible', 503, 'SERVICE_UNAVAILABLE'));
        }
      });
    } catch (err) {
      next(err);
    }
  },

  listModels(req, res, next) {
    axios.get(`${ML_SERVICE_URL}/models`, { timeout: 5000 })
      .then(response => res.json({ success: true, data: response.data }))
      .catch(() => res.json({ success: true, data: { models: [] } }));
  },

  deleteModel(req, res, next) {
    const { asset } = req.params;
    axios.delete(`${ML_SERVICE_URL}/models/${asset}`, { timeout: 5000 })
      .then(response => res.json({ success: true, data: response.data }))
      .catch(() => next(createError('Modelo no encontrado', 404, 'MODEL_NOT_FOUND')));
  },

  getStats(req, res) {
    res.json({
      success: true,
      data: {
        totalRequests: requestLog.length,
        recentRequests: requestLog.slice(0, 50),
        blockedIPs: Array.from(failedAttempts.entries()).filter(([k, v]) => v >= 5).map(([k, v]) => ({ key: k, attempts: v })),
        config: {
          apiKeysCount: MULTI_API_KEYS.length,
          whitelistedIPsCount: WHITELISTED_IPS.length
        }
      }
    });
  },

  clearBlocked(req, res) {
    if (req.query.key) {
      failedAttempts.delete(req.query.key);
      res.json({ success: true, message: 'Key desbloqueada' });
    } else {
      failedAttempts.clear();
      res.json({ success: true, message: 'Todas las keys desbloqueadas' });
    }
  },

  async autoTrain(req, res, next) {
    try {
      const { asset, minDataPoints, threshold } = req.body;
      const assetName = asset || 'EURUSD';

      const marketDataModule = require('../modules/market-data/marketDataModule');
      const candles = marketDataModule.getCandles(assetName, 60, minDataPoints || 100);

      if (!candles || candles.length < (minDataPoints || 100)) {
        return res.json({
          success: false,
          error: 'No hay suficientes datos históricos',
          need: (minDataPoints || 100),
          have: candles?.length || 0
        });
      }

      const labels = [];
      for (let i = 0; i < candles.length - 1; i++) {
        const change = (candles[i + 1].close - candles[i].close) / candles[i].close;
        if (change > (threshold || 0.002)) labels.push(1);
        else if (change < -(threshold || 0.002)) labels.push(-1);
        else labels.push(0);
      }
      labels.push(0);

      const response = await axios.post(
        `${ML_SERVICE_URL}/train`,
        {
          candles,
          labels,
          asset: assetName,
          timeframe: '1m',
          model_type: 'gradient_boosting'
        },
        { timeout: 60000 }
      );

      logger.info('Auto-entrenamiento completado', { asset: assetName, ...response.data });

      res.json({
        success: true,
        data: response.data,
        message: `Modelo entrenado para ${assetName}`
      });
    } catch (err) {
      res.json({ success: false, error: err.message });
    }
  },

  async getCandles(req, res, next) {
    try {
      const { asset, timeframe, count } = req.params;
      const assetName = asset || 'EURUSD';

      const marketDataModule = require('../modules/market-data/marketDataModule');
      const candles = marketDataModule.getCandles(
        assetName,
        timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : 60,
        count || 100
      );

      res.json({
        success: true,
        data: { asset: assetName, candles: candles || [] }
      });
    } catch (err) {
      res.json({ success: true, data: { asset: req.params.asset, candles: [] } });
    }
  }
};