'use strict';

const EventEmitter = require('events');
const logger = require('../logger/logger');
const connection = require('../connection/iqOptionConnection');

/**
 * Módulo de Market Data
 * Gestiona precios en tiempo real, velas históricas y activos disponibles.
 */
class MarketDataModule extends EventEmitter {
  constructor() {
    super();
    this.subscribedAssets = new Map(); // activeId -> { symbol, subscribers }
    this.priceCache = new Map();       // activeId -> último precio
    this.candleCache = new Map();      // `${activeId}_${size}` -> [candles]
    this.MAX_CANDLES_CACHE = 500;

    this._setupListeners();
  }

  _setupListeners() {
    connection.on('candles', (data) => this._handleCandleData(data));
    connection.on('instrumentChanged', (data) => this._handlePriceUpdate(data));
  }

  /**
   * Suscribirse a datos en tiempo real de un activo
   * @param {number} activeId - ID del activo en IQ Option
   * @param {string} symbol - Símbolo legible (EURUSD, AAPL, etc.)
   * @param {number[]} sizes - Tamaños de vela en segundos [60, 300, 3600]
   */
  subscribe(activeId, symbol, sizes = [60]) {
    if (!this.subscribedAssets.has(activeId)) {
      this.subscribedAssets.set(activeId, { symbol, sizes, subscriberCount: 0 });
    }

    const asset = this.subscribedAssets.get(activeId);
    asset.subscriberCount++;

    for (const size of sizes) {
      connection.subscribeToAsset(activeId, size);
      logger.info(`MarketData: Suscrito a ${symbol} (ID: ${activeId}) size=${size}s`);
    }
  }

  /**
   * Desuscribirse de un activo
   */
  unsubscribe(activeId) {
    const asset = this.subscribedAssets.get(activeId);
    if (!asset) return;

    asset.subscriberCount--;
    if (asset.subscriberCount <= 0) {
      this.subscribedAssets.delete(activeId);
      connection.send('unsubscribeMessage', {
        name: 'candle-generated',
        params: { routingFilters: { active_id: activeId } }
      });
      logger.info(`MarketData: Desuscrito de activo ID: ${activeId}`);
    }
  }

  /**
   * Obtener velas históricas
   * @param {number} activeId - ID del activo
   * @param {number} size - Tamaño de la vela en segundos
   * @param {number} count - Número de velas
   * @param {number} endTime - Timestamp fin (Unix)
   */
  async getHistoricalCandles(activeId, size, count = 100, endTime = null) {
    return new Promise((resolve, reject) => {
      const requestId = Date.now();
      endTime = endTime || Math.floor(Date.now() / 1000);

      connection.send('candles', {
        active_id: activeId,
        size: size,
        to: endTime,
        count: count
      });

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout obteniendo velas para activo ${activeId}`));
      }, 10000);

      connection.once('candles', (data) => {
        clearTimeout(timeout);
        const candles = this._normalizeCandles(data);
        this._updateCandleCache(activeId, size, candles);
        resolve(candles);
      });
    });
  }

  /**
   * Obtener precio actual cacheado
   */
  getCurrentPrice(activeId) {
    return this.priceCache.get(activeId) || null;
  }

  /**
   * Obtener velas cacheadas
   */
  getCachedCandles(activeId, size) {
    return this.candleCache.get(`${activeId}_${size}`) || [];
  }

  /**
   * Obtener velas cacheadas por símbolo (para compatibilidad con ML controller)
   * @param {string} symbol - Símbolo del activo (EURUSD, BTCUSD, etc.)
   * @param {number} size - Tamaño de vela en segundos
   * @param {number} count - Número máximo de velas
   * @returns {Array} Velas cacheadas
   */
  getCandles(symbol, size = 60, count = 100) {
    for (const [activeId, asset] of this.subscribedAssets) {
      if (asset.symbol === symbol) {
        const candles = this.getCachedCandles(activeId, size);
        return candles.slice(-count);
      }
    }
    return [];
  }

  /**
   * Obtener lista de activos disponibles
   */
  async getAvailableAssets() {
    return new Promise((resolve, reject) => {
      connection.send('get-instruments', { type: 'digital-option' });

      const timeout = setTimeout(() => reject(new Error('Timeout obteniendo instrumentos')), 10000);

      connection.once('instruments', (data) => {
        clearTimeout(timeout);
        resolve(this._normalizeInstruments(data));
      });
    });
  }

  /**
   * Manejar actualización de precios
   */
  _handlePriceUpdate(data) {
    if (data.active_id && data.ask && data.bid) {
      const priceData = {
        activeId: data.active_id,
        ask: data.ask,
        bid: data.bid,
        mid: (data.ask + data.bid) / 2,
        timestamp: new Date().toISOString()
      };
      this.priceCache.set(data.active_id, priceData);
      this.emit('priceUpdate', priceData);
    }
  }

  /**
   * Manejar datos de velas
   */
  _handleCandleData(data) {
    const candle = {
      activeId: data.active_id,
      size: data.size,
      open: data.open,
      close: data.close,
      high: data.max,
      low: data.min,
      volume: data.volume,
      timestamp: data.at,
      isClosed: data.is_closed || false
    };

    const key = `${data.active_id}_${data.size}`;
    if (!this.candleCache.has(key)) {
      this.candleCache.set(key, []);
    }
    const candles = this.candleCache.get(key);
    candles.push(candle);

    // Limitar caché
    if (candles.length > this.MAX_CANDLES_CACHE) {
      candles.shift();
    }

    this.emit('candleUpdate', candle);
    this.emit(`candle_${data.active_id}_${data.size}`, candle);
  }

  /**
   * Normalizar formato de velas de IQ Option
   */
  _normalizeCandles(rawCandles) {
    if (!Array.isArray(rawCandles)) return [];
    return rawCandles.map(c => ({
      timestamp: c.at || c.from,
      open: parseFloat(c.open),
      high: parseFloat(c.max || c.high),
      low: parseFloat(c.min || c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume || 0)
    }));
  }

  /**
   * Normalizar instrumentos
   */
  _normalizeInstruments(rawData) {
    if (!rawData || !rawData.instruments) return [];
    return rawData.instruments.map(i => ({
      id: i.id || i.active_id,
      symbol: i.ticker || i.name,
      name: i.name,
      type: i.type,
      precision: i.precision,
      isActive: i.is_active || !i.suspended
    }));
  }

  _updateCandleCache(activeId, size, candles) {
    const key = `${activeId}_${size}`;
    this.candleCache.set(key, candles.slice(-this.MAX_CANDLES_CACHE));
  }

  getStatus() {
    return {
      subscribedAssets: Array.from(this.subscribedAssets.entries()).map(([id, data]) => ({
        id, ...data
      })),
      cachedPrices: this.priceCache.size,
      cachedCandleSets: this.candleCache.size
    };
  }
}

module.exports = new MarketDataModule();
