'use strict';

const EventEmitter = require('events');

/**
 * Clase base abstracta para todas las estrategias de trading.
 * Todas las estrategias deben extender esta clase.
 */
class BaseStrategy extends EventEmitter {
  /**
   * @param {Object} config - Configuración de la estrategia
   * @param {string} config.name - Nombre único de la estrategia
   * @param {string} config.description - Descripción de la estrategia
   * @param {Object} config.params - Parámetros configurables
   */
  constructor(config) {
    super();

    if (new.target === BaseStrategy) {
      throw new Error('BaseStrategy es una clase abstracta y no puede instanciarse directamente');
    }

    this.id = config.id || require('uuid').v4();
    this.name = config.name;
    this.description = config.description || '';
    this.version = config.version || '1.0.0';
    this.author = config.author || 'System';
    this.params = this._mergeWithDefaults(config.params || {});
    this.status = 'stopped'; // 'stopped' | 'running' | 'paused' | 'error'
    this.stats = {
      totalOrders: 0,
      wins: 0,
      losses: 0,
      totalPnl: 0,
      startedAt: null,
      lastSignalAt: null
    };
    this.activeId = null;
    this.logger = require('../logger/logger');
  }

  // ========================
  // MÉTODOS ABSTRACTOS
  // Deben ser implementados en cada estrategia
  // ========================

  /**
   * Retorna los parámetros por defecto de la estrategia
   * @returns {Object} Definición de parámetros con defaults
   */
  getDefaultParams() {
    throw new Error(`${this.name}: getDefaultParams() no implementado`);
  }

  /**
   * Lógica principal de análisis y generación de señales.
   * Se llama cada vez que llega una nueva vela.
   * @param {Object[]} candles - Array de velas (ohlcv)
   * @param {Object} currentPrice - Precio actual
   * @returns {Promise<Object|null>} Señal o null si no hay señal
   */
  async analyze(candles, currentPrice) {
    throw new Error(`${this.name}: analyze() no implementado`);
  }

  /**
   * Inicialización específica de la estrategia
   */
  async onStart() {
    // Opcional: sobreescribir en subclase
  }

  /**
   * Limpieza al detener la estrategia
   */
  async onStop() {
    // Opcional: sobreescribir en subclase
  }

  // ========================
  // MÉTODOS DEL CICLO DE VIDA
  // ========================

  async start(activeId) {
    if (this.status === 'running') {
      throw new Error(`Estrategia ${this.name} ya está corriendo`);
    }

    this.activeId = activeId;
    this.status = 'running';
    this.stats.startedAt = new Date().toISOString();

    await this.onStart();

    this.logger.info(`Estrategia iniciada: ${this.name}`, {
      id: this.id,
      activeId,
      params: this.params
    });

    this.emit('started', { strategyId: this.id, name: this.name });
  }

  async pause() {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.emit('paused', { strategyId: this.id });
    this.logger.info(`Estrategia pausada: ${this.name}`);
  }

  async resume() {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.emit('resumed', { strategyId: this.id });
    this.logger.info(`Estrategia resumida: ${this.name}`);
  }

  async stop() {
    this.status = 'stopped';
    await this.onStop();
    this.emit('stopped', { strategyId: this.id, stats: this.stats });
    this.logger.info(`Estrategia detenida: ${this.name}`, { stats: this.stats });
  }

  // ========================
  // SEÑALES
  // ========================

  /**
   * Emitir señal de compra
   */
  emitBuySignal(data = {}) {
    const signal = this._createSignal('call', data);
    this.stats.lastSignalAt = signal.timestamp;
    this.emit('signal', signal);
    this.logger.trading('STRATEGY_SIGNAL', { strategy: this.name, signal });
    return signal;
  }

  /**
   * Emitir señal de venta
   */
  emitSellSignal(data = {}) {
    const signal = this._createSignal('put', data);
    this.stats.lastSignalAt = signal.timestamp;
    this.emit('signal', signal);
    this.logger.trading('STRATEGY_SIGNAL', { strategy: this.name, signal });
    return signal;
  }

  _createSignal(direction, data) {
    return {
      strategyId: this.id,
      strategyName: this.name,
      activeId: this.activeId,
      direction,
      amount: data.amount || this.params.amount || 10,
      duration: data.duration || this.params.duration || 60,
      confidence: data.confidence || 1,
      reason: data.reason || '',
      indicators: data.indicators || {},
      timestamp: new Date().toISOString()
    };
  }

  // ========================
  // RESULTADO DE ÓRDENES
  // ========================

  onOrderResult(result) {
    this.stats.totalOrders++;
    this.stats.totalPnl += result.pnl;

    if (result.pnl > 0) {
      this.stats.wins++;
    } else {
      this.stats.losses++;
    }
  }

  // ========================
  // INDICADORES TÉCNICOS UTILITARIOS
  // ========================

  /**
   * Media Móvil Simple
   */
  calculateSMA(closes, period) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Media Móvil Exponencial
   */
  calculateEMA(closes, period) {
    if (closes.length < period) return null;
    const k = 2 / (period + 1);
    let ema = closes[0];
    for (let i = 1; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  }

  /**
   * RSI (Relative Strength Index)
   */
  calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;

    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = closes[closes.length - period + i - 1] - closes[closes.length - period + i - 2];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Bandas de Bollinger
   */
  calculateBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
    if (closes.length < period) return null;

    const slice = closes.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: sma + stdDevMultiplier * stdDev,
      middle: sma,
      lower: sma - stdDevMultiplier * stdDev,
      bandwidth: (stdDevMultiplier * 2 * stdDev) / sma
    };
  }

  /**
   * MACD - Calcula MACD con línea de señal real (EMA del MACD)
   */
  calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (closes.length < slowPeriod + signalPeriod) return null;

    const fastEMA = this.calculateEMA(closes, fastPeriod);
    const slowEMA = this.calculateEMA(closes, slowPeriod);

    if (fastEMA === null || slowEMA === null) return null;

    const macdLine = fastEMA - slowEMA;

    // Calcular señal como EMA de los valores MACD en el rango
    const macdValues = [];
    for (let i = signalPeriod; i < closes.length; i++) {
      const slice = closes.slice(0, i + 1);
      const fe = this.calculateEMA(slice, fastPeriod);
      const se = this.calculateEMA(slice, slowPeriod);
      if (fe !== null && se !== null) {
        macdValues.push(fe - se);
      }
    }

    const signal = macdValues.length >= signalPeriod
      ? this.calculateEMA(macdValues, signalPeriod)
      : macdLine * 0.2;

    return {
      macd: macdLine,
      signal: signal || macdLine * 0.2,
      histogram: macdLine - (signal || macdLine * 0.2)
    };
  }

  // ========================
  // UTILIDADES
  // ========================

  updateParams(newParams) {
    const validated = this._validateParams(newParams);
    this.params = { ...this.params, ...validated };
    this.emit('paramsUpdated', { strategyId: this.id, params: this.params });
  }

  _mergeWithDefaults(params) {
    try {
      const defaults = this.getDefaultParams();
      return { ...defaults, ...params };
    } catch {
      return params;
    }
  }

  _validateParams(params) {
    return params; // Sobreescribir en subclases para validación específica
  }

  /**
   * Retorna estadísticas de la estrategia (incluye winRate calculado)
   */
  getStats() {
    const totalOrders = this.stats.totalOrders || 1;
    return {
      ...this.stats,
      winRate: totalOrders > 0 ? (this.stats.wins / totalOrders) * 100 : 0
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version: this.version,
      status: this.status,
      params: this.params,
      stats: this.stats,
      activeId: this.activeId
    };
  }
}

module.exports = BaseStrategy;
