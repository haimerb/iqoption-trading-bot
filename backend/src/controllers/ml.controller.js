'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const { createError } = require('../middlewares/errorHandler');
const logger = require('../modules/logger/logger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const PUBLIC_API_KEY = process.env.ML_PUBLIC_API_KEY || null;

async function getHealth(req, res, next) {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 });
    res.json({ success: true, data: response.data });
  } catch (err) {
    res.json({ success: true, data: { status: 'unavailable', service: 'ml-predictor' } });
  }
}

async function publicPredict(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, details: errors.array() });
    }

    const apiKey = req.headers['x-api-key'];
    if (PUBLIC_API_KEY && apiKey !== PUBLIC_API_KEY) {
      throw createError('API key inválida', 401, 'INVALID_API_KEY');
    }

    const { candles, asset, timeframe } = req.body;

    if (!candles || candles.length < 20) {
      throw createError('Se requieren al menos 20 velas', 400, 'INSUFFICIENT_DATA');
    }

    const validCandles = candles.map(c => ({
      open: c.open || c.close,
      high: c.high || c.close,
      low: c.low || c.close,
      close: c.close,
      volume: c.volume || 0
    }));

    const response = await axios.post(
      `${ML_SERVICE_URL}/predict`,
      { candles: validCandles, asset: asset || 'EURUSD', timeframe: timeframe || '1m' },
      { timeout: 15000 }
    );

    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response) {
      next(createError(err.response.data?.detail || 'Error en ML Service', 500, 'ML_ERROR'));
    } else {
      next(createError('ML Service no disponible', 503, 'SERVICE_UNAVAILABLE'));
    }
  }
}

async function predict(req, res, next) {
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

    const response = await axios.post(
      `${ML_SERVICE_URL}/predict`,
      { candles: validCandles, asset: asset || 'EURUSD', timeframe: timeframe || '1m' },
      { timeout: 15000 }
    );

    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response) {
      next(createError(err.response.data?.detail || 'Error en ML Service', 500, 'ML_ERROR'));
    } else {
      next(createError('ML Service no disponible', 503, 'SERVICE_UNAVAILABLE'));
    }
  }
}

async function train(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, details: errors.array() });
    }

    const { candles, labels, asset, modelType } = req.body;

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

    const response = await axios.post(
      `${ML_SERVICE_URL}/train`,
      {
        candles: validCandles,
        labels,
        asset: asset || 'EURUSD',
        timeframe: timeframe || '1m',
        model_type: modelType || 'gradient_boosting'
      },
      { timeout: 60000 }
    );

    logger.info('Modelo entrenado', { asset: asset || 'EURUSD', accuracy: response.data.accuracy });

    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response) {
      next(createError(err.response.data?.detail || 'Error en entrenamiento', 500, 'TRAIN_ERROR'));
    } else {
      next(createError('ML Service no disponible', 503, 'SERVICE_UNAVAILABLE'));
    }
  }
}

async function listModels(req, res, next) {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/models`, { timeout: 5000 });
    res.json({ success: true, data: response.data });
  } catch (err) {
    res.json({ success: true, data: { models: [] } });
  }
}

async function deleteModel(req, res, next) {
  try {
    const { asset } = req.params;
    const response = await axios.delete(`${ML_SERVICE_URL}/models/${asset}`, { timeout: 5000 });
    res.json({ success: true, data: response.data });
  } catch (err) {
    next(createError('Modelo no encontrado', 404, 'MODEL_NOT_FOUND'));
  }
}

module.exports = {
  getHealth,
  publicPredict,
  predict,
  train,
  listModels,
  deleteModel
};