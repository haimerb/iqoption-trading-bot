'use strict';

const tf = require('@tensorflow/tfjs-node');
const logger = require('../logger/logger');

class MLPredictor {
  constructor(config = {}) {
    this.model = null;
    this.isReady = false;
    this.config = {
      lookback: config.lookback || 20,
      features: config.features || ['close', 'rsi', 'macd', 'bb_upper', 'bb_lower'],
      threshold: config.threshold || 0.6,
      modelPath: config.modelPath || './models/market-predictor'
    };
    this.history = [];
  }

  async initialize() {
    try {
      this.model = await tf.loadLayersFileSystem(this.config.modelPath);
      this.isReady = true;
      logger.info('ML Predictor: Modelo cargado', { modelPath: this.config.modelPath });
    } catch (err) {
      logger.warn('ML Predictor: No hay modelo existente, usando predicción por defecto');
      this.model = this._createDefaultModel();
      this.isReady = true;
    }
  }

  _createDefaultModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape: [this.config.lookback * this.config.features.length],
      units: 64,
      activation: 'relu'
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    return model;
  }

  async train(candles, labels) {
    if (candles.length < this.config.lookback) {
      throw new Error(`Se necesitan al menos ${this.config.lookback} velas para entrenar`);
    }

    const features = this._extractFeatures(candles);
    const xs = tf.tensor2d(features.map(f => f.slice(0, -1)), [features.length, this.config.lookback * this.config.features.length]);
    const ys = tf.tensor2d(labels.map(l => l === 1 ? [1, 0] : [0, 1]), [labels.length, 2]);

    await this.model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            logger.info(`ML Predictor: Época ${epoch} - loss: ${logs.loss.toFixed(4)}, acc: ${logs.acc.toFixed(4)}`);
          }
        }
      }
    });

    xs.dispose();
    ys.dispose();
    logger.info('ML Predictor: Entrenamiento completado');
  }

  _extractFeatures(candles) {
    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume || 0);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const features = [];
    for (let i = this.config.lookback; i < candles.length; i++) {
      const window = candles.slice(i - this.config.lookback, i);
      const rsi = this._calculateRSI(closes.slice(0, i), 14);
      const macd = this._calculateMACD(closes.slice(0, i));
      const bb = this._calculateBollinger(closes.slice(0, i));

      const featureVector = [];
      for (const featureName of this.config.features) {
        switch (featureName) {
          case 'close':
            featureVector.push(window[window.length - 1].close / closes[0]);
            break;
          case 'rsi':
            featureVector.push(rsi / 100);
            break;
          case 'macd':
            featureVector.push(macd.macd / closes[0]);
            break;
          case 'bb_upper':
            featureVector.push((bb?.upper || closes[0]) / closes[0]);
            break;
          case 'bb_lower':
            featureVector.push((bb?.lower || closes[0]) / closes[0]);
            break;
          case 'volume':
            featureVector.push(volumes[i] / Math.max(...volumes));
            break;
        }
      }
      features.push(featureVector);
    }
    return features;
  }

  _calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const rs = gains / (losses || 1);
    return 100 - (100 / (1 + rs));
  }

  _calculateMACD(closes, fast = 12, slow = 26) {
    const fastEMA = this._ema(closes, fast);
    const slowEMA = this._ema(closes, slow);
    return { macd: fastEMA - slowEMA, signal: 0, histogram: fastEMA - slowEMA };
  }

  _ema(closes, period) {
    if (closes.length < period) return closes[closes.length - 1];
    const k = 2 / (period + 1);
    let ema = closes[0];
    for (let i = 1; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  }

  _calculateBollinger(closes, period = 20) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return { upper: sma + 2 * stdDev, middle: sma, lower: sma - 2 * stdDev };
  }

  async predict(candles) {
    if (!this.isReady || candles.length < this.config.lookback) {
      return { direction: null, confidence: 0, reason: 'Sin datos suficientes' };
    }

    const features = candles.slice(-this.config.lookback);
    const closes = candles.map(c => c.close);
    const featureVector = [];

    for (const featureName of this.config.features) {
      switch (featureName) {
        case 'close':
          featureVector.push(features[features.length - 1].close / closes[0]);
          break;
        case 'rsi':
          featureVector.push(this._calculateRSI(closes, 14) / 100);
          break;
        case 'macd':
          featureVector.push(this._calculateMACD(closes).macd / closes[0]);
          break;
        case 'bb_upper':
          featureVector.push((this._calculateBollinger(closes)?.upper || closes[0]) / closes[0]);
          break;
        case 'bb_lower':
          featureVector.push((this._calculateBollinger(closes)?.lower || closes[0]) / closes[0]);
          break;
        case 'volume':
          featureVector.push((features[features.length - 1].volume || 0) / Math.max(...closes.map((_, i) => candles[i].volume || 0)));
          break;
      }
    }

    const input = tf.tensor2d([featureVector], [1, this.config.lookback * this.config.features.length]);
    const prediction = this.model.predict(input);
    const probabilities = await prediction.data();
    input.dispose();
    prediction.dispose();

    const callProb = probabilities[0];
    const putProb = probabilities[1];

    let direction = null;
    let confidence = 0;

    if (callProb > this.config.threshold) {
      direction = 'call';
      confidence = callProb;
    } else if (putProb > this.config.threshold) {
      direction = 'put';
      confidence = putProb;
    }

    return {
      direction,
      confidence: Math.max(callProb, putProb),
      probabilities: { call: callProb, put: putProb },
      reason: direction ? `IA predice ${direction} con ${(confidence * 100).toFixed(1)}% de confianza` : 'Sin señal clara'
    };
  }

  async save(path) {
    await this.model.save(`file://${path || this.config.modelPath}`);
    logger.info('ML Predictor: Modelo guardado', { path: path || this.config.modelPath });
  }

  dispose() {
    if (this.model) {
      this.model.dispose();
    }
    this.history = [];
    this.isReady = false;
  }
}

module.exports = MLPredictor;