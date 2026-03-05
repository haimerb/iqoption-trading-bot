'use strict';

const BaseStrategy = require('./BaseStrategy');

/**
 * Estrategia: Cruce de Medias Móviles (MA Crossover)
 * 
 * Señal de compra: MA rápida cruza hacia arriba a MA lenta
 * Señal de venta: MA rápida cruza hacia abajo a MA lenta
 */
class MACrossoverStrategy extends BaseStrategy {
  constructor(params = {}) {
    super({
      name: 'MA Crossover',
      description: 'Genera señales cuando la media móvil rápida cruza a la lenta',
      version: '1.0.0',
      params
    });

    this.previousFastMA = null;
    this.previousSlowMA = null;
  }

  getDefaultParams() {
    return {
      fastPeriod: 9,           // Período MA rápida
      slowPeriod: 21,          // Período MA lenta
      maType: 'EMA',           // 'SMA' | 'EMA'
      amount: 10,              // Monto de la orden
      duration: 60,            // Duración en segundos
      minCandlesRequired: 30,  // Mínimo de velas para calcular
      confirmationCandles: 1   // Velas de confirmación del cruce
    };
  }

  async analyze(candles, currentPrice) {
    if (!candles || candles.length < this.params.slowPeriod + 2) {
      return null; // No hay suficientes datos
    }

    const closes = candles.map(c => c.close);

    const fastMA = this.params.maType === 'EMA'
      ? this.calculateEMA(closes, this.params.fastPeriod)
      : this.calculateSMA(closes, this.params.fastPeriod);

    const slowMA = this.params.maType === 'EMA'
      ? this.calculateEMA(closes, this.params.slowPeriod)
      : this.calculateSMA(closes, this.params.slowPeriod);

    if (!fastMA || !slowMA) return null;

    let signal = null;

    // Cruce hacia arriba: señal de compra
    if (this.previousFastMA !== null && this.previousSlowMA !== null) {
      const prevDiff = this.previousFastMA - this.previousSlowMA;
      const currDiff = fastMA - slowMA;

      if (prevDiff < 0 && currDiff > 0) {
        // Golden Cross
        signal = this.emitBuySignal({
          amount: this.params.amount,
          duration: this.params.duration,
          reason: 'Golden Cross - MA rápida cruzó sobre MA lenta',
          indicators: { fastMA, slowMA, prevDiff, currDiff }
        });
      } else if (prevDiff > 0 && currDiff < 0) {
        // Death Cross
        signal = this.emitSellSignal({
          amount: this.params.amount,
          duration: this.params.duration,
          reason: 'Death Cross - MA rápida cruzó bajo MA lenta',
          indicators: { fastMA, slowMA, prevDiff, currDiff }
        });
      }
    }

    this.previousFastMA = fastMA;
    this.previousSlowMA = slowMA;

    return signal;
  }

  _validateParams(params) {
    if (params.fastPeriod && params.slowPeriod && params.fastPeriod >= params.slowPeriod) {
      throw new Error('fastPeriod debe ser menor que slowPeriod');
    }
    return params;
  }
}

module.exports = MACrossoverStrategy;
