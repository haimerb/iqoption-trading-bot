'use strict';

const EventEmitter = require('events');
const logger = require('../logger/logger');
const marketData = require('../market-data/marketDataModule');
const orderExecution = require('../order-execution/orderExecutionModule');

// Estrategias disponibles
const MACrossoverStrategy = require('./MACrossoverStrategy');
const { RSIStrategy, BollingerBandsStrategy, GridTradingStrategy } = require('./strategies');

/**
 * Mapa de estrategias disponibles (registro)
 */
const STRATEGY_REGISTRY = {
  'ma-crossover': MACrossoverStrategy,
  'rsi': RSIStrategy,
  'bollinger-bands': BollingerBandsStrategy,
  'grid-trading': GridTradingStrategy
};

/**
 * Gestor de Estrategias
 * Instancia, registra y coordina el ciclo de vida de todas las estrategias.
 */
class StrategyManager extends EventEmitter {
  constructor() {
    super();
    this.strategies = new Map();     // strategyId -> instancia
    this.candleListeners = new Map(); // strategyId -> listener function
  }

  /**
   * Obtener lista de estrategias disponibles en el registro
   */
  getAvailableStrategies() {
    return Object.keys(STRATEGY_REGISTRY).map(key => {
      const StratClass = STRATEGY_REGISTRY[key];
      const temp = new StratClass();
      return {
        type: key,
        name: temp.name,
        description: temp.description,
        version: temp.version,
        defaultParams: temp.getDefaultParams()
      };
    });
  }

  /**
   * Crear una nueva instancia de estrategia
   * @param {string} type - Tipo de estrategia (key en STRATEGY_REGISTRY)
   * @param {Object} params - Parámetros configurables
   * @returns {Object} - La estrategia serializada
   */
  createStrategy(type, params = {}) {
    const StratClass = STRATEGY_REGISTRY[type];
    if (!StratClass) {
      throw new Error(`Tipo de estrategia desconocido: ${type}. Disponibles: ${Object.keys(STRATEGY_REGISTRY).join(', ')}`);
    }

    const instance = new StratClass(params);
    this.strategies.set(instance.id, instance);

    // Conectar resultados de órdenes a la estrategia
    orderExecution.on('positionClosed', (result) => {
      instance.onOrderResult(result);
    });

    logger.info(`StrategyManager: Estrategia creada: ${instance.name} (${instance.id})`);
    return instance.toJSON();
  }

  /**
   * Iniciar una estrategia
   * @param {string} strategyId
   * @param {number} activeId - Activo a operar
   * @param {number[]} candleSizes - Tamaños de vela para análisis
   */
  async startStrategy(strategyId, activeId, candleSizes = [60]) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);

    await strategy.start(activeId);

    // Suscribir al activo
    marketData.subscribe(activeId, `Asset_${activeId}`, candleSizes);

    // Crear listener de velas
    const listener = async (candle) => {
      if (strategy.status !== 'running') return;

      try {
        const candles = marketData.getCachedCandles(activeId, candleSizes[0]);
        const currentPrice = marketData.getCurrentPrice(activeId);
        const signal = await strategy.analyze(candles, currentPrice);

        if (signal) {
          await this._executeSignal(signal);
        }
      } catch (err) {
        logger.error(`StrategyManager: Error en análisis de ${strategy.name}`, { error: err.message });
        strategy.status = 'error';
        this.emit('strategyError', { strategyId, error: err.message });
      }
    };

    const eventName = `candle_${activeId}_${candleSizes[0]}`;
    marketData.on(eventName, listener);
    this.candleListeners.set(strategyId, { eventName, listener });

    // Conectar señales de la estrategia
    strategy.on('signal', (signal) => {
      this.emit('signal', signal);
    });

    logger.info(`StrategyManager: Estrategia ${strategy.name} iniciada en activo ${activeId}`);
    return strategy.toJSON();
  }

  /**
   * Pausar una estrategia
   */
  async pauseStrategy(strategyId) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);
    await strategy.pause();
    return strategy.toJSON();
  }

  /**
   * Resumir estrategia pausada
   */
  async resumeStrategy(strategyId) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);
    await strategy.resume();
    return strategy.toJSON();
  }

  /**
   * Detener y eliminar estrategia
   */
  async stopStrategy(strategyId) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);

    await strategy.stop();

    // Remover listener
    const listenerData = this.candleListeners.get(strategyId);
    if (listenerData) {
      marketData.removeListener(listenerData.eventName, listenerData.listener);
      this.candleListeners.delete(strategyId);
    }

    this.strategies.delete(strategyId);
    logger.info(`StrategyManager: Estrategia ${strategy.name} detenida y eliminada`);
    return { success: true };
  }

  /**
   * Actualizar parámetros de una estrategia
   */
  updateStrategyParams(strategyId, params) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);
    strategy.updateParams(params);
    return strategy.toJSON();
  }

  /**
   * Obtener todas las estrategias activas
   */
  getAllStrategies() {
    return Array.from(this.strategies.values()).map(s => s.toJSON());
  }

  /**
   * Ejecutar señal generada por una estrategia
   */
  async _executeSignal(signal) {
    try {
      logger.trading('EXECUTING_SIGNAL', signal);
      const order = await orderExecution.openOrder({
        activeId: signal.activeId,
        direction: signal.direction,
        amount: signal.amount,
        duration: signal.duration,
        strategyId: signal.strategyId
      });
      this.emit('orderOpened', { signal, order });
      return order;
    } catch (err) {
      logger.error(`StrategyManager: Error ejecutando señal`, {
        signal,
        error: err.message
      });
      this.emit('signalExecutionError', { signal, error: err.message });
      throw err;
    }
  }
}

module.exports = new StrategyManager();
