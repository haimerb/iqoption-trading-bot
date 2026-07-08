'use strict';

const EventEmitter = require('events');
const logger = require('../logger/logger');
const https = require('https');

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

  async connect(email, password) {
    try {
      logger.info('IQOption: Iniciando conexión...');
      this.credentials = { email, password };

      const ssid = await this._httpLogin(email, password);
      logger.info('IQOption: SSID obtenido exitosamente');

      const WebSocket = require('ws');

      this.ws = new WebSocket('wss://iqoption.com/echo/websocket', {
        headers: {
          'Origin': 'https://iqoption.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      await this._setupWebSocket();
      await this._authenticate(ssid);
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

  _httpLogin(email, password) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ identifier: email, password });

      const options = {
        hostname: 'auth.iqoption.com',
        path: '/api/v2/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          const cookies = res.headers['set-cookie'] || [];
          const ssidCookie = cookies.find(c => c.startsWith('ssid='));
          if (ssidCookie) {
            const ssid = ssidCookie.split(';')[0].replace('ssid=', '');
            resolve(ssid);
          } else {
            try {
              const parsed = JSON.parse(body);
              reject(new Error(parsed.message || 'Login HTTP fallido'));
            } catch {
              reject(new Error('No se recibió SSID en la respuesta'));
            }
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(postData);
      req.end();
    });
  }

  _setupWebSocket() {
    return new Promise((resolve, reject) => {
      const connectionTimeout = setTimeout(() => {
        reject(new Error('Timeout de conexión WebSocket'));
      }, 15000);

      this.ws.on('open', () => {
        clearTimeout(connectionTimeout);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info('IQOption WebSocket: Conexión abierta');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          this._handleMessage(JSON.parse(data));
        } catch (e) {
          logger.warn('IQOption: Mensaje no válido recibido', { raw: data.toString().substring(0, 200) });
        }
      });

      this.ws.on('close', (code, reason) => {
        clearTimeout(connectionTimeout);
        this.isConnected = false;
        this.isAuthenticated = false;
        logger.warn('IQOption WebSocket: Conexión cerrada', { code, reason: reason ? reason.toString() : '' });
        this.emit('disconnected', { code, reason });
        if (code !== 1000) {
          this._scheduleReconnect();
        } else {
          logger.info('IQOption: Conexión cerrada normalmente (code 1000), no se reintenta');
        }
      });

      this.ws.on('error', (error) => {
        clearTimeout(connectionTimeout);
        logger.error('IQOption WebSocket: Error', { error: error.message });
        this.emit('wsError', error);
        reject(error);
      });
    });
  }

  _authenticate(ssid) {
    return new Promise((resolve, reject) => {
      const authPayload = {
        name: 'ssid',
        msg: ssid
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

  send(name, msg) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== 1) {
      logger.warn('IQOption: WebSocket no conectado, ignorando mensaje');
      return;
    }
    this.ws.send(JSON.stringify({ name, msg }));
  }

  _startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === 1) {
        try {
          this.send('heartbeat', { heartbeatTime: new Date().toISOString() });
        } catch (e) {
          logger.warn('IQOption: Error en heartbeat', { error: e.message });
        }
      }
    }, 30000);
  }

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
          logger.warn('IQOption: Error en reconexión, reintentando...', { error: err.message });
        }
      }
    }, delay);
  }

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

const connectionInstance = new IQOptionConnection();
module.exports = connectionInstance;
