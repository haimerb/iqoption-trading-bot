'use strict';

const axios = require('axios');
const MLPredictor = require('./mlPredictor');
const PriceActionPredictor = require('./priceActionPredictor');
const logger = require('../logger/logger');

class AIPredictionModule {
  constructor(config = {}) {
    this.config = {
      useLocal: config.useLocal !== false,
      mlServiceUrl: config.mlServiceUrl || 'http://localhost:8000',
      usePatterns: config.usePatterns !== false,
      confidenceThreshold: config.confidenceThreshold || 0.6,
      combineSignals: config.combineSignals !== false
    };

    this.localPredictor = new MLPredictor(config.ml);
    this.patternPredictor = new PriceActionPredictor(config.patterns);
    this.isInitialized = false;
    this.stats = { predictions: 0, correct: 0 };
  }

  async initialize() {
    try {
      if (this.config.usePatterns) {
        logger.info('AIPredictionModule: PriceActionPredictor inicializado');
      }

      if (this.config.useLocal) {
        await this.localPredictor.initialize();
      } else {
        try {
          const response = await axios.get(`${this.config.mlServiceUrl}/health`, { timeout: 5000 });
          logger.info('AIPredictionModule: ML Service conectado', response.data);
        } catch {
          logger.warn('AIPredictionModule: ML Service no disponible, usando predictor local');
          this.config.useLocal = true;
          await this.localPredictor.initialize();
        }
      }

      this.isInitialized = true;
      logger.info('AIPredictionModule: Inicializado correctamente');
    } catch (err) {
      logger.error('AIPredictionModule: Error al inicializar', { error: err.message });
      this.isInitialized = true;
    }
  }

  async predict(candles) {
    if (!this.isInitialized) {
      return { direction: null, confidence: 0, reason: 'Módulo no inicializado' };
    }

    const signals = { patterns: null, ml: null };
    let finalDirection = null;
    let finalConfidence = 0;
    let reasons = [];

    if (this.config.usePatterns) {
      signals.patterns = this.patternPredictor.predict(candles);
      if (signals.patterns.direction && signals.patterns.confidence >= this.config.confidenceThreshold) {
        finalDirection = signals.patterns.direction;
        finalConfidence = signals.patterns.confidence;
        reasons.push(signals.patterns.reason);
      }
    }

    if (this.config.useLocal) {
      try {
        signals.ml = await this.localPredictor.predict(candles);
      } catch (err) {
        logger.warn('AIPredictionModule: Error en predictor local', { error: err.message });
      }
    } else {
      try {
        const response = await axios.post(
          `${this.config.mlServiceUrl}/predict`,
          { candles: candles.map(c => ({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })) },
          { timeout: 10000 }
        );
        signals.ml = response.data;
      } catch (err) {
        logger.warn('AIPredictionModule: Error en ML Service', { error: err.message });
      }
    }

    if (signals.ml?.direction && signals.ml.confidence >= this.config.confidenceThreshold) {
      if (signals.ml.direction === finalDirection) {
        finalConfidence = (finalConfidence + signals.ml.confidence) / 2;
      } else if (!finalDirection) {
        finalDirection = signals.ml.direction;
        finalConfidence = signals.ml.confidence;
      } else if (this.config.combineSignals) {
        if (signals.ml.confidence > finalConfidence) {
          finalDirection = signals.ml.direction;
          finalConfidence = signals.ml.confidence;
          reasons = [signals.ml.reason];
        }
      }
      reasons.push(signals.ml.reason);
    }

    this.stats.predictions++;

    logger.trading('AI_PREDICTION', {
      direction: finalDirection,
      confidence: finalConfidence,
      patterns: signals.patterns?.direction,
      ml: signals.ml?.direction
    });

    return {
      direction: finalDirection,
      confidence: finalConfidence,
      reasons: reasons.join(' | '),
      signals: {
        patterns: signals.patterns,
        ml: signals.ml
      },
      indicators: signals.ml?.indicators || signals.patterns?.indicators || {}
    };
  }

  async predictFromRemote(candles, asset = 'EURUSD', timeframe = '1m') {
    try {
      const response = await axios.post(
        `${this.config.mlServiceUrl}/predict`,
        {
          candles: candles.map(c => ({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
          asset,
          timeframe
        },
        { timeout: 10000 }
      );
      return response.data;
    } catch (err) {
      logger.error('AIPredictionModule: Error al llamar ML Service', { error: err.message });
      return { direction: null, confidence: 0, reason: err.message };
    }
  }

  recordResult(prediction, actual) {
    if (prediction?.direction === actual) {
      this.stats.correct++;
    }
    this.patternPredictor.recordResult(prediction?.direction === actual);
  }

  getStats() {
    return {
      ...this.stats,
      accuracy: this.stats.predictions > 0 ? this.stats.correct / this.stats.predictions : 0
    };
  }

  dispose() {
    this.localPredictor.dispose();
    this.isInitialized = false;
  }
}

module.exports = AIPredictionModule;