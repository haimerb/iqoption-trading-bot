'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../logger/logger');
const marketData = require('../market-data/marketDataModule');
const orderExecution = require('../order-execution/orderExecutionModule');
const strategyManager = require('../strategies/StrategyManager');

let io = null;

/**
 * Inicializar Socket.IO y configurar namespaces y eventos
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 30000,
    pingInterval: 10000
  });

  // Middleware de autenticación JWT en WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Token requerido para conexión WebSocket'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Token WebSocket inválido'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket: Cliente conectado [${socket.id}] user=${socket.user?.email}`);

    // Unirse a sala personal
    socket.join(`user_${socket.user.userId}`);

    // ====================================
    // Eventos del cliente
    // ====================================

    // Suscribirse a precios de un activo
    socket.on('subscribe:asset', ({ activeId, size = 60 }) => {
      socket.join(`asset_${activeId}_${size}`);
      logger.info(`Socket: ${socket.id} suscrito a activo ${activeId}`);
    });

    // Desuscribirse
    socket.on('unsubscribe:asset', ({ activeId, size = 60 }) => {
      socket.leave(`asset_${activeId}_${size}`);
    });

    // Solicitar estado actual del bot
    socket.on('get:status', () => {
      socket.emit('bot:status', getBotStatus());
    });

    socket.on('disconnect', () => {
      logger.info(`Socket: Cliente desconectado [${socket.id}]`);
    });
  });

  // ====================================
  // Retransmitir eventos del sistema
  // ====================================

  // Actualizaciones de precios
  marketData.on('priceUpdate', (data) => {
    io.to(`asset_${data.activeId}_60`).emit('market:price', data);
  });

  // Actualizaciones de velas
  marketData.on('candleUpdate', (candle) => {
    io.to(`asset_${candle.activeId}_${candle.size}`).emit('market:candle', candle);
  });

  // Señales de estrategias
  strategyManager.on('signal', (signal) => {
    io.emit('strategy:signal', signal);
  });

  // Órdenes abiertas
  orderExecution.on('orderOpened', (order) => {
    io.emit('order:opened', order);
  });

  // Posiciones cerradas
  orderExecution.on('positionClosed', (position) => {
    io.emit('order:closed', position);
  });

  // Actualizaciones de posiciones
  orderExecution.on('positionUpdated', (position) => {
    io.emit('order:updated', position);
  });

  // Errores de estrategias
  strategyManager.on('strategyError', (data) => {
    io.emit('strategy:error', data);
  });

  logger.info('Socket.IO: Inicializado correctamente');
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO no inicializado');
  return io;
}

function emitToUser(userId, event, data) {
  if (io) io.to(`user_${userId}`).emit(event, data);
}

function getBotStatus() {
  return {
    connection: require('../connection/iqOptionConnection').getStatus(),
    marketData: marketData.getStatus(),
    orders: orderExecution.getStatus(),
    strategies: strategyManager.getAllStrategies(),
    timestamp: new Date().toISOString()
  };
}

module.exports = { initSocket, getIO, emitToUser };
