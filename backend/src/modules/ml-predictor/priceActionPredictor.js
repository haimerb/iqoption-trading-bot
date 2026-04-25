'use strict';

const logger = require('../logger/logger');

class PriceActionPredictor {
  constructor(config = {}) {
    this.config = {
      minConfidence: config.minConfidence || 0.6,
      maxPatterns: config.maxPatterns || 10
    };
    this.patterns = this._initPatterns();
    this.stats = { totalPredictions: 0, correct: 0 };
  }

  _initPatterns() {
    return [
      {
        name: 'doji_reversal',
        pattern: (candles) => this._detectDoji(candles),
        direction: (last, prev) => prev?.close > prev?.open ? 'put' : 'call',
        weight: 0.7
      },
      {
        name: 'hammer_reversal',
        pattern: (candles) => this._detectHammer(candles),
        direction: (last, prev) => prev?.close < prev?.open ? 'call' : 'put',
        weight: 0.75
      },
      {
        name: 'shooting_star_reversal',
        pattern: (candles) => this._detectShootingStar(candles),
        direction: (last, prev) => prev?.close > prev?.open ? 'put' : 'call',
        weight: 0.72
      },
      {
        name: 'morning_star',
        pattern: (candles) => this._detectMorningStar(candles),
        direction: () => 'call',
        weight: 0.8
      },
      {
        name: 'evening_star',
        pattern: (candles) => this._detectEveningStar(candles),
        direction: () => 'put',
        weight: 0.8
      },
      {
        name: 'three_white_soldiers',
        pattern: (candles) => this._detectThreeWhiteSoldiers(candles),
        direction: () => 'call',
        weight: 0.85
      },
      {
        name: 'three_black_crows',
        pattern: (candles) => this._detectThreeBlackCrows(candles),
        direction: () => 'put',
        weight: 0.85
      },
      {
        name: 'engulfing_bullish',
        pattern: (candles) => this._detectEngulfingBullish(candles),
        direction: () => 'call',
        weight: 0.78
      },
      {
        name: 'engulfing_bearish',
        pattern: (candles) => this._detectEngulfingBearish(candles),
        direction: () => 'put',
        weight: 0.78
      },
      {
        name: 'trend_exhaustion',
        pattern: (candles) => this._detectTrendExhaustion(candles),
        direction: (last, prev) => this._getTrendDirection(candles) === 'up' ? 'put' : 'call',
        weight: 0.7
      }
    ];
  }

  _detectDoji(candles) {
    if (candles.length < 1) return false;
    const c = candles[candles.length - 1];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    return range > 0 && body / range < 0.1;
  }

  _detectHammer(candles) {
    if (candles.length < 1) return false;
    const c = candles[candles.length - 1];
    const body = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.max(c.close, c.open);
    const lowerWick = Math.min(c.close, c.open) - c.low;
    const range = c.high - c.low;
    return lowerWick > body * 2 && upperWick < body * 0.5 && range > 0;
  }

  _detectShootingStar(candles) {
    if (candles.length < 1) return false;
    const c = candles[candles.length - 1];
    const body = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.min(c.close, c.open);
    const lowerWick = Math.min(c.close, c.open) - c.low;
    const range = c.high - c.low;
    return upperWick > body * 2 && lowerWick < body * 0.5 && range > 0;
  }

  _detectMorningStar(candles) {
    if (candles.length < 3) return false;
    const [c1, c2, c3] = candles.slice(-3);
    const c1Bearish = c1.close < c1.open;
    const c2Small = Math.abs(c2.close - c2.open) < Math.abs(c1.close - c1.open) * 0.3;
    const c3Bullish = c3.close > c3.open;
    const c3Engulfs = c3.close > c1.open && c3.open < c1.close;
    return c1Bearish && c2Small && c3Bullish && c3Engulfs;
  }

  _detectEveningStar(candles) {
    if (candles.length < 3) return false;
    const [c1, c2, c3] = candles.slice(-3);
    const c1Bullish = c1.close > c1.open;
    const c2Small = Math.abs(c2.close - c2.open) < Math.abs(c1.close - c1.open) * 0.3;
    const c3Bearish = c3.close < c3.open;
    const c3Engulfs = c3.close < c1.open && c3.open > c1.close;
    return c1Bullish && c2Small && c3Bearish && c3Engulfs;
  }

  _detectThreeWhiteSoldiers(candles) {
    if (candles.length < 3) return false;
    const recent = candles.slice(-3);
    return recent.every(c => c.close > c.open) &&
           recent.every((c, i) => i === 0 || c.close > recent[i - 1].close) &&
           recent.every((c, i) => i === 0 || c.open > recent[i - 1].open);
  }

  _detectThreeBlackCrows(candles) {
    if (candles.length < 3) return false;
    const recent = candles.slice(-3);
    return recent.every(c => c.close < c.open) &&
           recent.every((c, i) => i === 0 || c.close < recent[i - 1].close) &&
           recent.every((c, i) => i === 0 || c.open < recent[i - 1].open);
  }

  _detectEngulfingBullish(candles) {
    if (candles.length < 2) return false;
    const [prev, last] = candles.slice(-2);
    const prevBearish = prev.close < prev.open;
    const lastBullish = last.close > last.open;
    const engulfs = last.close > prev.open && last.open < prev.close;
    return prevBearish && lastBullish && engulfs;
  }

  _detectEngulfingBearish(candles) {
    if (candles.length < 2) return false;
    const [prev, last] = candles.slice(-2);
    const prevBullish = prev.close > prev.open;
    const lastBearish = last.close < last.open;
    const engulfs = last.close < prev.open && last.open > prev.close;
    return prevBullish && lastBearish && engulfs;
  }

  _detectTrendExhaustion(candles) {
    if (candles.length < 5) return false;
    const recent = candles.slice(-5);
    const trend = this._getTrendDirection(recent);
    if (trend === 'flat') return false;
    const last = recent[recent.length - 1];
    const body = Math.abs(last.close - last.open);
    const wick = Math.max(last.high - Math.max(last.close, last.open), Math.min(last.close, last.open) - last.low);
    return wick > body * 2;
  }

  _getTrendDirection(candles) {
    if (candles.length < 5) return 'flat';
    const first = candles[0].close;
    const last = candles[candles.length - 1].close;
    const change = ((last - first) / first) * 100;
    if (change > 1) return 'up';
    if (change < -1) return 'down';
    return 'flat';
  }

  predict(candles) {
    if (!candles || candles.length < 3) {
      return { direction: null, confidence: 0, reason: 'Sin datos suficientes de velas' };
    }

    const signals = [];
    for (const pattern of this.patterns) {
      if (pattern.pattern(candles)) {
        const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
        const direction = pattern.direction(candles[candles.length - 1], prev);
        signals.push({
          pattern: pattern.name,
          direction,
          confidence: pattern.weight,
          weight: pattern.weight
        });
      }
    }

    if (signals.length === 0) {
      return { direction: null, confidence: 0, reason: 'No se detectó ningún patrón' };
    }

    signals.sort((a, b) => b.confidence - a.confidence);
    const topSignals = signals.slice(0, this.config.maxPatterns);

    const callSignals = topSignals.filter(s => s.direction === 'call');
    const putSignals = topSignals.filter(s => s.direction === 'put');

    const callConfidence = callSignals.reduce((sum, s) => sum + s.confidence, 0) / callSignals.length || 0;
    const putConfidence = putSignals.reduce((sum, s) => sum + s.confidence, 0) / putSignals.length || 0;

    let direction = null;
    let confidence = 0;
    let reason = '';

    if (callConfidence > this.config.minConfidence && callConfidence > putConfidence) {
      direction = 'call';
      confidence = callConfidence;
      reason = `Patrones detectados: ${topSignals.filter(s => s.direction === 'call').map(s => s.pattern).join(', ')}`;
    } else if (putConfidence > this.config.minConfidence) {
      direction = 'put';
      confidence = putConfidence;
      reason = `Patrones detectados: ${topSignals.filter(s => s.direction === 'put').map(s => s.pattern).join(', ')}`;
    } else if (topSignals.length > 0) {
      direction = topSignals[0].direction;
      confidence = topSignals[0].confidence;
      reason = `Patrón más fuerte: ${topSignals[0].pattern}`;
    }

    this.stats.totalPredictions++;
    if (direction) {
      logger.trading('PRICE_ACTION_SIGNAL', {
        direction,
        confidence,
        patterns: topSignals.map(s => s.pattern),
        reason
      });
    }

    return {
      direction,
      confidence,
      reason,
      patterns: topSignals.map(s => s.pattern),
      signalsCount: topSignals.length
    };
  }

  getStats() {
    return {
      ...this.stats,
      accuracy: this.stats.totalPredictions > 0 ? this.stats.correct / this.stats.totalPredictions : 0
    };
  }

  recordResult(correct) {
    if (correct) this.stats.correct++;
  }
}

module.exports = PriceActionPredictor;