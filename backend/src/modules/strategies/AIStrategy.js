'use strict';

const BaseStrategy = require('./BaseStrategy');
const { AIPredictionModule } = require('../ml-predictor');

class AIStrategy extends BaseStrategy {
  constructor(config) {
    const mergedConfig = {
      ...config,
      name: config.name || 'AI Prediction Strategy',
      description: config.description || 'Estrategia basada en predicción de IA combinando patrones de velas y ML',
      params: {
        amount: config.params?.amount || 10,
        duration: config.params?.duration || 60,
        minConfidence: config.params?.minConfidence || 0.65,
        usePatterns: config.params?.usePatterns !== false,
        useML: config.params?.useML !== false,
        mlServiceUrl: config.params?.mlServiceUrl || 'http://localhost:8000'
      }
    };

    super(mergedConfig);

    this.aiPredictor = null;
  }

  getDefaultParams() {
    return {
      amount: 10,
      duration: 60,
      minConfidence: 0.65,
      usePatterns: true,
      useML: true,
      mlServiceUrl: 'http://localhost:8000'
    };
  }

  async onStart() {
    this.aiPredictor = new AIPredictionModule({
      useLocal: this.params.useML,
      mlServiceUrl: this.params.mlServiceUrl,
      usePatterns: this.params.usePatterns,
      confidenceThreshold: this.params.minConfidence
    });

    await this.aiPredictor.initialize();

    this.logger.info(`AI Strategy iniciada`, {
      usePatterns: this.params.usePatterns,
      useML: this.params.useML,
      minConfidence: this.params.minConfidence
    });
  }

  async analyze(candles, currentPrice) {
    if (!candles || candles.length < 20) {
      return null;
    }

    const prediction = await this.aiPredictor.predict(candles);

    if (!prediction.direction || prediction.confidence < this.params.minConfidence) {
      return null;
    }

    const signal = prediction.direction === 'call'
      ? this.emitBuySignal({
          amount: this.params.amount,
          duration: this.params.duration,
          confidence: prediction.confidence,
          reason: prediction.reasons,
          indicators: prediction.indicators
        })
      : this.emitSellSignal({
          amount: this.params.amount,
          duration: this.params.duration,
          confidence: prediction.confidence,
          reason: prediction.reasons,
          indicators: prediction.indicators
        });

    signal.aiPrediction = {
      confidence: prediction.confidence,
      reasons: prediction.reasons,
      patternsSignal: prediction.signals?.patterns,
      mlSignal: prediction.signals?.ml
    };

    return signal;
  }

  async onStop() {
    if (this.aiPredictor) {
      this.aiPredictor.dispose();
    }
  }
}

module.exports = AIStrategy;