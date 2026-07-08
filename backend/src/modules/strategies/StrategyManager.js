'use strict';

const EventEmitter = require('events');
const logger = require('../logger/logger');
const marketData = require('../market-data/marketDataModule');
const orderExecution = require('../order-execution/orderExecutionModule');
const Strategy = require('../../models/Strategy');

const MACrossoverStrategy = require('./MACrossoverStrategy');
const { RSIStrategy, BollingerBandsStrategy, GridTradingStrategy } = require('./strategies');
let AIStrategy = null;
try {
  AIStrategy = require('./AIStrategy');
} catch (e) {
  logger.warn('AI Strategy no disponible:', e.message);
}

const STRATEGY_REGISTRY = {
  'ma-crossover': MACrossoverStrategy,
  'rsi': RSIStrategy,
  'bollinger-bands': BollingerBandsStrategy,
  'grid-trading': GridTradingStrategy
};

if (AIStrategy) {
  STRATEGY_REGISTRY['ai-prediction'] = AIStrategy;
}

class StrategyManager extends EventEmitter {
  constructor() {
    super();
    this.strategies = new Map();
    this.candleListeners = new Map();
    this._loadFromDb();
  }

  async _loadFromDb() {
    try {
      const docs = await Strategy.find({ status: { $ne: 'stopped' } }).lean();
      for (const doc of docs) {
        try {
          const StratClass = STRATEGY_REGISTRY[doc.type];
          if (!StratClass) continue;
          const instance = new StratClass(doc.params || {});
          instance.id = doc._id.toString();
          instance.status = doc.status || 'stopped';
          if (instance.status === 'running' && doc.activeId) {
            this.strategies.set(instance.id, instance);
          }
        } catch (e) {
          logger.warn(`StrategyManager: Error cargando estrategia ${doc._id}`, { error: e.message });
        }
      }
      logger.info(`StrategyManager: ${docs.length} estrategias cargadas desde MongoDB`);
    } catch (err) {
      logger.warn('StrategyManager: No se pudieron cargar estrategias desde MongoDB', { error: err.message });
    }
  }

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

  async createStrategy(type, params = {}) {
    const StratClass = STRATEGY_REGISTRY[type];
    if (!StratClass) {
      throw new Error(`Tipo de estrategia desconocido: ${type}. Disponibles: ${Object.keys(STRATEGY_REGISTRY).join(', ')}`);
    }

    const instance = new StratClass(params);
    this.strategies.set(instance.id, instance);

    try {
      await Strategy.create({
        type,
        name: instance.name,
        description: instance.description,
        version: instance.version,
        params,
        status: 'stopped'
      });
    } catch (err) {
      logger.error('StrategyManager: Error guardando estrategia en MongoDB', { error: err.message });
    }

    orderExecution.on('positionClosed', (result) => {
      instance.onOrderResult(result);
    });

    logger.info(`StrategyManager: Estrategia creada: ${instance.name} (${instance.id})`);
    return instance.toJSON();
  }

  async startStrategy(strategyId, activeId, candleSizes = [60]) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);

    await strategy.start(activeId);

    marketData.subscribe(activeId, `Asset_${activeId}`, candleSizes);

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

    strategy.on('signal', (signal) => {
      this.emit('signal', signal);
    });

    try {
      await Strategy.updateOne({ _id: strategyId }, { status: 'running', activeId });
    } catch (err) {
      logger.error('StrategyManager: Error actualizando estrategia en MongoDB', { error: err.message });
    }

    logger.info(`StrategyManager: Estrategia ${strategy.name} iniciada en activo ${activeId}`);
    return strategy.toJSON();
  }

  async pauseStrategy(strategyId) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);
    await strategy.pause();

    try {
      await Strategy.updateOne({ _id: strategyId }, { status: 'paused' });
    } catch (err) {
      logger.error('StrategyManager: Error actualizando estrategia en MongoDB', { error: err.message });
    }

    return strategy.toJSON();
  }

  async resumeStrategy(strategyId) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);
    await strategy.resume();

    try {
      await Strategy.updateOne({ _id: strategyId }, { status: 'running' });
    } catch (err) {
      logger.error('StrategyManager: Error actualizando estrategia en MongoDB', { error: err.message });
    }

    return strategy.toJSON();
  }

  async stopStrategy(strategyId) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);

    await strategy.stop();

    const listenerData = this.candleListeners.get(strategyId);
    if (listenerData) {
      marketData.removeListener(listenerData.eventName, listenerData.listener);
      this.candleListeners.delete(strategyId);
    }

    this.strategies.delete(strategyId);

    try {
      await Strategy.updateOne({ _id: strategyId }, { status: 'stopped', activeId: null });
    } catch (err) {
      logger.error('StrategyManager: Error actualizando estrategia en MongoDB', { error: err.message });
    }

    logger.info(`StrategyManager: Estrategia ${strategy.name} detenida y eliminada`);
    return { success: true };
  }

  updateStrategyParams(strategyId, params) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Estrategia ${strategyId} no encontrada`);
    strategy.updateParams(params);

    Strategy.updateOne({ _id: strategyId }, { params }).catch(err => {
      logger.error('StrategyManager: Error actualizando params en MongoDB', { error: err.message });
    });

    return strategy.toJSON();
  }

  getAllStrategies() {
    return Array.from(this.strategies.values()).map(s => s.toJSON());
  }

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
      logger.error(`StrategyManager: Error ejecutando señal`, { signal, error: err.message });
      this.emit('signalExecutionError', { signal, error: err.message });
      throw err;
    }
  }
}

module.exports = new StrategyManager();
