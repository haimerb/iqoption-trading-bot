'use strict';

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const logger = require('../logger/logger');
const connection = require('../connection/iqOptionConnection');
const RiskModule = require('../risk-management/riskModule');
const Order = require('../../models/Order');

class OrderExecutionModule extends EventEmitter {
  constructor() {
    super();
    this.pendingOrders = new Map();
    this.openPositions = new Map();
    this.orderHistory = [];
    this.executionLock = new Set();
    this.MAX_CONCURRENT_ORDERS = parseInt(process.env.MAX_CONCURRENT_ORDERS) || 5;

    this._setupListeners();
    this._loadHistoryFromDb();
  }

  async _loadHistoryFromDb() {
    try {
      const closed = await Order.find({ status: 'closed' }).sort({ closedAt: -1 }).limit(500).lean();
      this.orderHistory = closed;
      const open = await Order.find({ status: 'open' }).lean();
      for (const pos of open) {
        this.openPositions.set(pos.id || pos._id.toString(), pos);
      }
      logger.info(`OrderExec: ${closed.length} históricas, ${open.length} abiertas cargadas desde MongoDB`);
    } catch (err) {
      logger.warn('OrderExec: No se pudo cargar historial desde MongoDB', { error: err.message });
    }
  }

  _setupListeners() {
    connection.on('orderComplete', (data) => this._handleOrderComplete(data));
    connection.on('positionChanged', (data) => this._handlePositionChanged(data));
  }

  async openOrder(params) {
    const { activeId, direction, amount, duration, orderType = 'digital', strategyId } = params;

    if (this.openPositions.size >= this.MAX_CONCURRENT_ORDERS) {
      throw new Error(`Límite de órdenes concurrentes alcanzado (${this.MAX_CONCURRENT_ORDERS})`);
    }

    if (this.executionLock.has(activeId)) {
      throw new Error(`Activo ${activeId} bloqueado durante ejecución`);
    }

    const riskCheck = await RiskModule.validateOrder({ activeId, amount, direction });
    if (!riskCheck.approved) {
      throw new Error(`Orden rechazada por riesgo: ${riskCheck.reason}`);
    }

    const localOrderId = uuidv4();
    this.executionLock.add(activeId);

    try {
      logger.trading('ORDER_OPEN', {
        localOrderId, activeId, direction, amount, duration, orderType, strategyId
      });

      const orderPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingOrders.delete(localOrderId);
          reject(new Error('Timeout esperando confirmación de orden'));
        }, 15000);

        this.pendingOrders.set(localOrderId, { resolve, reject, timeout, params });
      });

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
        localOrderId, iqOptionOrderId: result.id, activeId, direction, amount, openPrice: result.openQuote, expirationTime: result.expired
      });

      this.emit('orderOpened', result);
      return result;

    } finally {
      this.executionLock.delete(activeId);
    }
  }

  async closePosition(positionId) {
    if (!this.openPositions.has(positionId)) {
      throw new Error(`Posición ${positionId} no encontrada`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout cerrando posición'));
      }, 10000);

      connection.send('sellOption', { option_id: positionId });

      logger.trading('POSITION_CLOSE_REQUESTED', { positionId });

      this.once(`positionClosed_${positionId}`, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
  }

  _handleOrderComplete(data) {
    const requestId = data.request_id;
    const pending = this.pendingOrders.get(requestId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingOrders.delete(requestId);

      const orderData = {
        activeId: data.active_id,
        direction: data.direction,
        amount: data.price,
        duration: pending.params.duration,
        orderType: pending.params.orderType || 'digital',
        strategyId: pending.params.strategyId || null,
        openQuote: data.open_quote,
        closeQuote: data.close_quote || null,
        openedAt: data.created ? new Date(data.created * 1000) : new Date(),
        expirationTime: data.expired ? new Date(data.expired * 1000) : null,
        status: 'open'
      };

      const order = {
        id: data.id,
        requestId,
        ...orderData,
        closeQuote: null,
        pnl: null
      };

      this.openPositions.set(data.id, order);

      Order.create({ ...orderData, status: 'open' }).catch(err => {
        logger.error('OrderExec: Error guardando orden en MongoDB', { error: err.message });
      });

      pending.resolve(order);
    }
  }

  async _handlePositionChanged(data) {
    const positionId = data.id;
    const position = this.openPositions.get(positionId);

    if (position) {
      if (data.status === 'closed' || data.pnl !== undefined) {
        position.status = 'closed';
        position.closeQuote = data.close_quote;
        position.pnl = data.pnl || data.win_amount;
        position.closedAt = new Date().toISOString();

        this.openPositions.delete(positionId);
        this.orderHistory.unshift(position);

        if (this.orderHistory.length > 500) {
          this.orderHistory.pop();
        }

        try {
          await Order.updateOne(
            { activeId: position.activeId, openedAt: position.openedAt },
            { status: 'closed', closeQuote: position.closeQuote, pnl: position.pnl, closedAt: new Date(position.closedAt) }
          );
        } catch (err) {
          logger.error('OrderExec: Error actualizando orden en MongoDB', { error: err.message });
        }

        logger.trading('POSITION_CLOSED', {
          positionId, pnl: position.pnl, direction: position.direction, openQuote: position.openQuote, closeQuote: position.closeQuote
        });

        RiskModule.recordOrderResult({
          activeId: position.activeId, amount: position.amount, pnl: position.pnl
        });

        this.emit(`positionClosed_${positionId}`, position);
        this.emit('positionClosed', position);
      } else {
        Object.assign(position, { currentQuote: data.close_quote, currentPnl: data.pnl });
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
