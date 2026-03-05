'use strict';

const Redis = require('ioredis');
const logger = require('../modules/logger/logger');

let client = null;

async function connectRedis() {
  client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    enableOfflineQueue: true
  });

  client.on('connect', () => logger.info('Redis: Conectado'));
  client.on('error', (err) => logger.error('Redis: Error', err));
  client.on('close', () => logger.warn('Redis: Conexión cerrada'));

  await client.ping();
  return client;
}

function getRedisClient() {
  if (!client) throw new Error('Redis no inicializado. Llama connectRedis() primero.');
  return client;
}

async function disconnectRedis() {
  if (client) {
    await client.quit();
    client = null;
  }
}

module.exports = { connectRedis, getRedisClient, disconnectRedis };
