'use strict';

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const logger = require('../logger/logger');
const connection = require('../connection/iqOptionConnection');
const RiskModule = require('../risk-management/riskModule');

/**
 * Módulo de Ejecución de Órdenes
 * Gestiona apertura, cierre y monitoreo de posiciones en IQ Option.
 */
class OrderExecutionModule extends EventEmitter {
  constructor() {
    super();
    this.pendingOrders = new Map();    // orderId -> orderData
    this.openPositions = new Map();    // positionId -> positionData
    this.orderHistory = [];
    this.executionLock = new Set();    // activeIds bloqueados durante ejecución
    this.MAX_CONCURRENT_ORDERS = parseInt(process.env.MAX_CONCURRENT_ORDERS) || 5;

    this._setupListeners();
  }

  _setupListeners() {
    connection.on('orderComplete', (data) => this._handleOrderComplete(data));
    connection.on('positionChanged', (data) => this._handlePositionChanged(data));
  }

  /**
   * Abrir una operación de opción binaria
   * @param {Object} params
   * @param {number} params.activeId - ID del activo
   * @param {string} params.direction - 'call' | 'put'
   * @param {number} params.amount - Monto en USD
   * @param {number} params.duration - Duración en segundos
   * @param {string} params.orderType - 'binary' | 'turbo' | 'digital'
   * @param {string} params.strategyId - ID de la estrategia que generó la orden
   */
  async openOrder(params) {
    const { activeId, direction, amount, duration, orderType = 'digital', strategyId } = params;

    // Validaciones
    if (this.openPositions.size >= this.MAX_CONCURRENT_ORDERS) {
      throw new Error(`Límite de órdenes concurrentes alcanzado (${this.MAX_CONCURRENT_ORDERS})`);
    }

    if (this.executionLock.has(activeId)) {
      throw new Error(`Activo ${activeId} bloqueado durante ejecución`);
    }

    // Validación de riesgo
    const riskCheck = await RiskModule.validateOrder({ activeId, amount, direction });
    if (!riskCheck.approved) {
      throw new Error(`Orden rechazada por riesgo: ${riskCheck.reason}`);
    }

    const localOrderId = uuidv4();
    this.executionLock.add(activeId);

    try {
      logger.trading('ORDER_OPEN', {
        localOrderId,
        activeId,
        direction,
        amount,
        duration,
        orderType,
        strategyId
      });

      const orderPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingOrders.delete(localOrderId);
          reject(new Error('Timeout esperando confirmación de orden'));
        }, 15000);

        this.pendingOrders.set(localOrderId, { resolve, reject, timeout, params });
      });

      // Enviar orden a IQ Option
      connection.send('buyV3', {
        active_id: activeId,
        direction: direction.toLowerCase(),
        expired: duration,
        price: amount,
        type: orderType,
        request_id: localOrderId
      });

      const result = await orderPromise;

      logger.trading('ORDER_OPENED', {
        localOrderId,
        iqOptionOrderId: result.id,
        activeId,
        direction,
        amount,
        openPrice: result.openQuote,
        expirationTime: result.expired
      });

      this.emit('orderOpened', result);
      return result;

    } finally {
      this.executionLock.delete(activeId);
    }
  }

  /**
   * Cerrar posición manualmente (opciones digitales)
   * @param {string} positionId - ID de la posición de IQ Option
   */
  async closePosition(positionId) {
    if (!this.openPositions.has(positionId)) {
      throw new Error(`Posición ${positionId} no encontrada`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout cerrando posición'));
      }, 10000);

      connection.send('sellOption', {
        option_id: positionId
      });

      logger.trading('POSITION_CLOSE_REQUESTED', { positionId });

      this.once(`positionClosed_${positionId}`, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
  }

  /**
   * Manejar confirmación de orden
   */
  _handleOrderComplete(data) {
    const requestId = data.request_id;
    const pending = this.pendingOrders.get(requestId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingOrders.delete(requestId);

      const order = {
        id: data.id,
        requestId,
        activeId: data.active_id,
        direction: data.direction,
        amount: data.price,
        openQuote: data.open_quote,
        closeQuote: data.close_quote,
        openTime: data.created,
        expirationTime: data.expired,
        status: 'open',
        pnl: null
      };

      this.openPositions.set(data.id, order);
      pending.resolve(order);
    }
  }

  /**
   * Manejar cambio de estado de posición
   */
  _handlePositionChanged(data) {
    const positionId = data.id;

    if (this.openPositions.has(positionId)) {
      const position = this.openPositions.get(positionId);

      if (data.status === 'closed' || data.pnl !== undefined) {
        position.status = 'closed';
        position.closeQuote = data.close_quote;
        position.pnl = data.pnl || data.win_amount;
        position.closedAt = new Date().toISOString();

        this.openPositions.delete(positionId);
        this.orderHistory.unshift(position);

        // Mantener historial limitado en memoria
        if (this.orderHistory.length > 500) {
          this.orderHistory.pop();
        }

        logger.trading('POSITION_CLOSED', {
          positionId,
          pnl: position.pnl,
          direction: position.direction,
          openQuote: position.openQuote,
          closeQuote: position.closeQuote
        });

        RiskModule.recordOrderResult({
          activeId: position.activeId,
          amount: position.amount,
          pnl: position.pnl
        });

        this.emit(`positionClosed_${positionId}`, position);
        this.emit('positionClosed', position);
      } else {
        // Actualización parcial
        Object.assign(position, {
          currentQuote: data.close_quote,
          currentPnl: data.pnl
        });
        this.emit('positionUpdated', position);
      }
    }
  }

  getOpenPositions() {
    return Array.from(this.openPositions.values());
  }

  getOrderHistory(limit = 50) {
    return this.orderHistory.slice(0, limit);
  }

  getStatus() {
    return {
      openPositions: this.openPositions.size,
      pendingOrders: this.pendingOrders.size,
      lockedAssets: Array.from(this.executionLock),
      maxConcurrentOrders: this.MAX_CONCURRENT_ORDERS,
      totalHistoryRecords: this.orderHistory.length
    };
  }
}

module.exports = new OrderExecutionModule();
