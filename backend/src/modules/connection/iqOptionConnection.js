'use strict';

const EventEmitter = require('events');
const logger = require('../logger/logger');

/**
 * Módulo de Conexión y Autenticación con IQ Option
 * 
 * Gestiona la conexión WebSocket con la API de IQ Option,
 * autenticación, reconexión automática y estado de sesión.
 * 
 * NOTA: Usar la librería oficial: https://github.com/iqoptionapi/iqoptionapi
 * npm install iqoptionapi (Python wrapper) o equivalente Node.js
 */
class IQOptionConnection extends EventEmitter {
  constructor() {
    super();
    this.api = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.credentials = null;
    this.sessionData = null;
    this.heartbeatInterval = null;
  }

  /**
   * Inicializar conexión con IQ Option
   * @param {string} email - Email de la cuenta IQ Option
   * @param {string} password - Contraseña (debe estar cifrada en .env)
   */
  async connect(email, password) {
    try {
      logger.info('IQOption: Iniciando conexión...');
      this.credentials = { email, password };

      // =====================================================
      // INTEGRACIÓN CON LIBRERÍA OFICIAL IQ OPTION
      // =====================================================
      // La librería oficial de IQ Option es en Python.
      // Para Node.js se usa un bridge o la API websocket directamente.
      // 
      // Opción 1: Usar el bridge Python (iqoptionapi)
      // Opción 2: Implementar cliente WebSocket directo
      // 
      // Implementación WebSocket nativa:
      const WebSocket = require('ws');
      
      this.ws = new WebSocket('wss://iqoption.com/echo/websocket', {
        headers: {
          'Origin': 'https://iqoption.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      await this._setupWebSocket();
      await this._authenticate(email, password);
      this._startHeartbeat();

      logger.info('IQOption: Conexión y autenticación exitosa');
      this.emit('connected', this.sessionData);
      return this.sessionData;

    } catch (error) {
      logger.error('IQOption: Error de conexión', { error: error.message });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Configurar listeners del WebSocket
   */
  _setupWebSocket() {
    return new Promise((resolve, reject) => {
      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info('IQOption WebSocket: Conexión abierta');
        resolve();
      });

      this.ws.on('message', (data) => {
        this._handleMessage(JSON.parse(data));
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        this.isAuthenticated = false;
        logger.warn('IQOption WebSocket: Conexión cerrada', { code, reason: reason.toString() });
        this.emit('disconnected', { code, reason });
        this._scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        logger.error('IQOption WebSocket: Error', { error: error.message });
        this.emit('wsError', error);
        reject(error);
      });

      // Timeout de conexión
      setTimeout(() => reject(new Error('Timeout de conexión WebSocket')), 15000);
    });
  }

  /**
   * Autenticación con IQ Option
   */
  async _authenticate(email, password) {
    return new Promise((resolve, reject) => {
      const authPayload = {
        name: 'ssid',
        msg: {
          login: email,
          password: password,
          remember: true
        }
      };

      this.ws.send(JSON.stringify(authPayload));

      const authTimeout = setTimeout(() => {
        reject(new Error('Timeout de autenticación'));
      }, 10000);

      this.once('authResult', (result) => {
        clearTimeout(authTimeout);
        if (result.isSuccessful) {
          this.isAuthenticated = true;
          this.sessionData = result;
          resolve(result);
        } else {
          reject(new Error(`Autenticación fallida: ${result.message}`));
        }
      });
    });
  }

  /**
   * Manejar mensajes del WebSocket
   */
  _handleMessage(message) {
    switch (message.name) {
      case 'profile':
        this.emit('authResult', { isSuccessful: true, ...message.msg });
        break;
      case 'heartbeat':
        this.emit('heartbeat', message.msg);
        break;
      case 'candles':
        this.emit('candles', message.msg);
        break;
      case 'buy-complete':
        this.emit('orderComplete', message.msg);
        break;
      case 'position-changed':
        this.emit('positionChanged', message.msg);
        break;
      case 'instrument-changed':
        this.emit('instrumentChanged', message.msg);
        break;
      default:
        this.emit('message', message);
    }
  }

  /**
   * Enviar mensaje al WebSocket
   */
  send(name, msg) {
    if (!this.isConnected || !this.ws) {
      throw new Error('No hay conexión activa con IQ Option');
    }
    this.ws.send(JSON.stringify({ name, msg }));
  }

  /**
   * Heartbeat para mantener conexión activa
   */
  _startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('heartbeat', { heartbeatTime: new Date().toISOString() });
      }
    }, 30000);
  }

  /**
   * Programar reconexión automática
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('IQOption: Máximo de intentos de reconexión alcanzado');
      this.emit('maxReconnectReached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    logger.info(`IQOption: Reconectando en ${delay}ms (intento ${this.reconnectAttempts})`);

    setTimeout(async () => {
      if (this.credentials) {
        try {
          await this.connect(this.credentials.email, this.credentials.password);
        } catch (err) {
          logger.error('IQOption: Error en reconexión', { error: err.message });
        }
      }
    }, delay);
  }

  /**
   * Suscribirse a precios en tiempo real
   */
  subscribeToAsset(activeId, size = 1) {
    this.send('subscribeMessage', {
      name: 'candle-generated',
      params: {
        routingFilters: {
          active_id: activeId,
          size: size
        }
      }
    });
  }

  /**
   * Desconectar
   */
  disconnect() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isAuthenticated = false;
    logger.info('IQOption: Desconectado manualmente');
  }

  /**
   * Obtener estado actual de la conexión
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts,
      sessionData: this.sessionData ? {
        userId: this.sessionData.userId,
        currency: this.sessionData.currency,
        balance: this.sessionData.balance
      } : null
    };
  }
}

// Singleton
const connectionInstance = new IQOptionConnection();
module.exports = connectionInstance;
