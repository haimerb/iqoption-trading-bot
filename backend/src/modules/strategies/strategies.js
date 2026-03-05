'use strict';

const BaseStrategy = require('./BaseStrategy');

/**
 * Estrategia: RSI Overbought/Oversold
 * 
 * Señal de compra: RSI sale de zona de sobreventa (< oversoldLevel)
 * Señal de venta: RSI sale de zona de sobrecompra (> overboughtLevel)
 */
class RSIStrategy extends BaseStrategy {
  constructor(params = {}) {
    super({
      name: 'RSI Strategy',
      description: 'Señales basadas en zonas de sobrecompra/sobreventa del RSI',
      version: '1.0.0',
      params
    });

    this.previousRSI = null;
    this.inOversoldZone = false;
    this.inOverboughtZone = false;
  }

  getDefaultParams() {
    return {
      period: 14,
      overboughtLevel: 70,
      oversoldLevel: 30,
      amount: 10,
      duration: 60,
      exitOverbought: 65,   // Nivel para confirmar salida sobrecompra
      exitOversold: 35,     // Nivel para confirmar salida sobreventa
      minCandlesRequired: 20
    };
  }

  async analyze(candles, currentPrice) {
    if (!candles || candles.length < this.params.period + 5) {
      return null;
    }

    const closes = candles.map(c => c.close);
    const rsi = this.calculateRSI(closes, this.params.period);

    if (rsi === null) return null;

    let signal = null;

    // Entrar en zona de sobreventa
    if (rsi < this.params.oversoldLevel) {
      this.inOversoldZone = true;
    }
    // Entrar en zona de sobrecompra
    if (rsi > this.params.overboughtLevel) {
      this.inOverboughtZone = true;
    }

    // Señal de compra: salir de sobreventa
    if (this.inOversoldZone && rsi > this.params.exitOversold) {
      this.inOversoldZone = false;
      signal = this.emitBuySignal({
        amount: this.params.amount,
        duration: this.params.duration,
        confidence: this._calculateConfidence(rsi, 'oversold'),
        reason: `RSI salió de sobreventa (${rsi.toFixed(2)})`,
        indicators: { rsi, oversoldLevel: this.params.oversoldLevel }
      });
    }
    // Señal de venta: salir de sobrecompra
    else if (this.inOverboughtZone && rsi < this.params.exitOverbought) {
      this.inOverboughtZone = false;
      signal = this.emitSellSignal({
        amount: this.params.amount,
        duration: this.params.duration,
        confidence: this._calculateConfidence(rsi, 'overbought'),
        reason: `RSI salió de sobrecompra (${rsi.toFixed(2)})`,
        indicators: { rsi, overboughtLevel: this.params.overboughtLevel }
      });
    }

    this.previousRSI = rsi;
    return signal;
  }

  _calculateConfidence(rsi, zone) {
    if (zone === 'oversold') {
      // Más bajo el RSI, más confianza en la señal
      return Math.min(1, (this.params.oversoldLevel - rsi) / this.params.oversoldLevel + 0.5);
    } else {
      return Math.min(1, (rsi - this.params.overboughtLevel) / (100 - this.params.overboughtLevel) + 0.5);
    }
  }
}

/**
 * Estrategia: Bandas de Bollinger
 *
 * Señal de compra: precio toca/cruza banda inferior
 * Señal de venta: precio toca/cruza banda superior
 */
class BollingerBandsStrategy extends BaseStrategy {
  constructor(params = {}) {
    super({
      name: 'Bollinger Bands',
      description: 'Señales basadas en toques de bandas de Bollinger con reversión a media',
      version: '1.0.0',
      params
    });
  }

  getDefaultParams() {
    return {
      period: 20,
      stdDev: 2,
      amount: 10,
      duration: 60,
      bandTouchThreshold: 0.001, // % de proximidad a la banda para señal
      requireConfirmation: false
    };
  }

  async analyze(candles, currentPrice) {
    if (!candles || candles.length < this.params.period + 5) return null;

    const closes = candles.map(c => c.close);
    const bb = this.calculateBollingerBands(closes, this.params.period, this.params.stdDev);

    if (!bb) return null;

    const price = currentPrice?.mid || closes[closes.length - 1];
    const threshold = this.params.bandTouchThreshold;

    let signal = null;

    // Precio toca banda inferior (señal de compra - reversión)
    if (price <= bb.lower * (1 + threshold)) {
      signal = this.emitBuySignal({
        amount: this.params.amount,
        duration: this.params.duration,
        confidence: Math.min(1, (bb.lower - price) / (bb.middle - bb.lower) + 0.6),
        reason: `Precio tocó banda inferior de Bollinger`,
        indicators: {
          price,
          upper: bb.upper.toFixed(5),
          middle: bb.middle.toFixed(5),
          lower: bb.lower.toFixed(5),
          bandwidth: bb.bandwidth.toFixed(4)
        }
      });
    }
    // Precio toca banda superior (señal de venta - reversión)
    else if (price >= bb.upper * (1 - threshold)) {
      signal = this.emitSellSignal({
        amount: this.params.amount,
        duration: this.params.duration,
        confidence: Math.min(1, (price - bb.upper) / (bb.upper - bb.middle) + 0.6),
        reason: `Precio tocó banda superior de Bollinger`,
        indicators: {
          price,
          upper: bb.upper.toFixed(5),
          middle: bb.middle.toFixed(5),
          lower: bb.lower.toFixed(5),
          bandwidth: bb.bandwidth.toFixed(4)
        }
      });
    }

    return signal;
  }
}

/**
 * Estrategia: Grid Trading
 *
 * Opera zonas de precio predefinidas con órdenes automáticas
 * en cada nivel del grid.
 */
class GridTradingStrategy extends BaseStrategy {
  constructor(params = {}) {
    super({
      name: 'Grid Trading',
      description: 'Trading en rangos de precio con niveles de grid automáticos',
      version: '1.0.0',
      params
    });

    this.gridLevels = [];
    this.lastGridLevel = null;
  }

  getDefaultParams() {
    return {
      lowerBound: null,  // Precio inferior del grid
      upperBound: null,  // Precio superior del grid
      gridCount: 10,     // Número de niveles
      amount: 5,         // Monto por orden
      duration: 60,
      autoRange: true    // Calcular rango automáticamente con ATR
    };
  }

  async onStart() {
    // Calcular niveles de grid
    this._calculateGridLevels();
  }

  _calculateGridLevels() {
    const { lowerBound, upperBound, gridCount } = this.params;
    if (!lowerBound || !upperBound) return;

    const step = (upperBound - lowerBound) / gridCount;
    this.gridLevels = Array.from({ length: gridCount + 1 }, (_, i) =>
      parseFloat((lowerBound + i * step).toFixed(5))
    );
    this.logger.info(`GridStrategy: ${this.gridLevels.length} niveles calculados`, {
      levels: this.gridLevels
    });
  }

  async analyze(candles, currentPrice) {
    if (!this.gridLevels.length || !currentPrice) return null;

    const price = currentPrice.mid || candles[candles.length - 1].close;
    const nearestLevel = this._findNearestLevel(price);

    if (nearestLevel === null || nearestLevel === this.lastGridLevel) return null;

    const isMovingUp = this.lastGridLevel !== null && nearestLevel > this.lastGridLevel;
    const isMovingDown = this.lastGridLevel !== null && nearestLevel < this.lastGridLevel;

    let signal = null;

    if (isMovingUp) {
      // Precio subió a siguiente nivel -> vender (espera bajada)
      signal = this.emitSellSignal({
        amount: this.params.amount,
        duration: this.params.duration,
        reason: `Grid: precio alcanzó nivel ${nearestLevel}`,
        indicators: { gridLevel: nearestLevel, price, gridLevels: this.gridLevels }
      });
    } else if (isMovingDown) {
      // Precio bajó a nivel anterior -> comprar (espera subida)
      signal = this.emitBuySignal({
        amount: this.params.amount,
        duration: this.params.duration,
        reason: `Grid: precio bajó a nivel ${nearestLevel}`,
        indicators: { gridLevel: nearestLevel, price, gridLevels: this.gridLevels }
      });
    }

    this.lastGridLevel = nearestLevel;
    return signal;
  }

  _findNearestLevel(price) {
    if (!this.gridLevels.length) return null;
    return this.gridLevels.reduce((nearest, level) =>
      Math.abs(level - price) < Math.abs(nearest - price) ? level : nearest
    );
  }

  setGridRange(lowerBound, upperBound) {
    this.params.lowerBound = lowerBound;
    this.params.upperBound = upperBound;
    this._calculateGridLevels();
  }
}

module.exports = { RSIStrategy, BollingerBandsStrategy, GridTradingStrategy };
