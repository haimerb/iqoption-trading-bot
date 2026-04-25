'use strict';

const axios = require('axios');
const EventEmitter = require('events');
const logger = require('../logger/logger');

class MLWebSocketService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      mlServiceUrl: config.mlServiceUrl || process.env.ML_SERVICE_URL || 'http://localhost:8000',
      predictInterval: config.predictInterval || 60000,
      autoTrainInterval: config.autoTrainInterval || 3600000
    };
    this.io = null;
    this.activeAssets = new Set();
    this.intervals = new Map();
  }

  initialize(io) {
    this.io = io;
    
    io.on('connection', (socket) => {
      logger.info('ML WebSocket cliente conectado', { socketId: socket.id });
      
      socket.on('ml:subscribe', (data) => {
        const { asset, timeframe } = data;
        this.subscribeToAsset(socket, asset, timeframe);
      });
      
      socket.on('ml:unsubscribe', (data) => {
        const { asset } = data;
        this.unsubscribeFromAsset(socket, asset);
      });
      
      socket.on('ml:predict', (data) => {
        this.predict(socket, data);
      });
    });
    
    logger.info('ML WebSocket service inicializado');
  }

  subscribeToAsset(socket, asset, timeframe = '1m') {
    const room = `ml:${asset}:${timeframe}`;
    socket.join(room);
    this.activeAssets.add(asset);
    
    if (!this.intervals.has(asset)) {
      const interval = setInterval(() => {
        this.predictForAsset(asset, timeframe);
      }, this.config.predictInterval);
      
      this.intervals.set(asset, interval);
    }
    
    logger.info('Cliente suscrito a ML predictions', { asset, timeframe, socketId: socket.id });
    
    this.predictForAsset(asset, timeframe).then(prediction => {
      socket.emit('ml:prediction', {
        asset,
        timeframe,
        ...prediction,
        timestamp: new Date().toISOString()
      });
    });
  }

  unsubscribeFromAsset(socket, asset) {
    const rooms = Array.from(this.intervals.keys()).filter(r => r.startsWith(asset));
    rooms.forEach(room => {
      socket.leave(`ml:${room}`);
    });
    
    logger.info('Cliente desuscrito de ML predictions', { asset, socketId: socket.id });
  }

  async predictForAsset(asset, timeframe = '1m') {
    try {
      const response = await axios.post(
        `${this.config.mlServiceUrl}/predict`,
        { asset, timeframe },
        { timeout: 15000 }
      );
      
      const prediction = response.data;
      
      if (this.io) {
        this.io.to(`ml:${asset}:${timeframe}`).emit('ml:prediction', {
          asset,
          timeframe,
          ...prediction,
          timestamp: new Date().toISOString()
        });
      }
      
      logger.trading('ML_PREDICTION', { asset, confidence: prediction.confidence, direction: prediction.direction });
      
      return prediction;
    } catch (err) {
      logger.error('Error en predicción ML', { error: err.message, asset });
      return { direction: null, confidence: 0, reason: err.message };
    }
  }

  async predict(socket, data) {
    const { asset, timeframe } = data;
    const prediction = await this.predictForAsset(asset, timeframe);
    
    socket.emit('ml:prediction', {
      asset,
      timeframe,
      ...prediction,
      timestamp: new Date().toISOString()
    });
  }

  async autoTrain(asset, data = {}) {
    try {
      const { 
        minDataPoints = 100,
        threshold = 0.002,
        holdTime = 1 
      } = data;
      
      logger.info('ML auto-training iniciado', { asset, minDataPoints });
      
      const response = await axios.post(
        `${this.config.mlServiceUrl}/auto-train`,
        { asset, minDataPoints, threshold, holdTime },
        { timeout: 120000 }
      );
      
      if (response.data.success) {
        logger.info('ML auto-training completado', { 
          asset, 
          accuracy: response.data.accuracy,
          samples: response.data.samples 
        });
        
        if (this.io) {
          this.io.emit('ml:trained', {
            asset,
            success: true,
            accuracy: response.data.accuracy,
            samples: response.data.samples,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      return response.data;
    } catch (err) {
      logger.error('Error en auto-training', { error: err.message, asset });
      return { success: false, error: err.message };
    }
  }

  startAutoTrainForAll(activeAssets) {
    activeAssets.forEach(asset => {
      setInterval(() => {
        this.autoTrain(asset);
      }, this.config.autoTrainInterval);
    });
    
    logger.info('ML auto-training configurado para activos', { assets: activeAssets });
  }

  dispose() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.activeAssets.clear();
    
    logger.info('ML WebSocket service disposed');
  }
}

module.exports = MLWebSocketService;