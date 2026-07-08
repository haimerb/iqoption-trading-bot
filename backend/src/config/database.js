'use strict';

const mongoose = require('mongoose');
const logger = require('../modules/logger/logger');

let isConnected = false;

async function connectDatabase() {
  if (isConnected) return;
  const envUri = process.env.MONGODB_URI;
  const envFallback = process.env.MONGODB_URI_FALLBACK;
  const defaultUri = 'mongodb://localhost:27017/iqoption_bot';

  // Construir lista de URIs a intentar (env first, then sensible fallbacks)
  const urisToTry = [];
  if (envUri) urisToTry.push(envUri);
  if (envFallback) urisToTry.push(envFallback);
  if (envUri && envUri.includes('iqbot-mongodb')) {
    // fallback cuando se ejecuta localmente fuera de Docker
    urisToTry.push(envUri.replace(/iqbot-mongodb/g, 'localhost'));
  }
  if (!envUri && !envFallback) urisToTry.push(defaultUri);

  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info('MongoDB: Conexión establecida');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB: Error de conexión', err);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB: Desconectado');
  });

  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
  };

  function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

  // Intentar conectar a cada URI con algunos reintentos exponenciales
  let lastError = null;
  for (const uri of urisToTry) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        logger.info(`MongoDB: intentando conexión (intento ${attempt}) a ${uri}`);
        await mongoose.connect(uri, options);
        // Si conecta, retornamos
        return;
      } catch (err) {
        lastError = err;
        logger.error(`MongoDB: intento ${attempt} fallido para ${uri}`, err);
        // esperar antes de reintentar
        const delay = 1000 * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  // Si llegamos aquí, no se pudo conectar a ninguna URI
  throw lastError || new Error('MongoDB: No se pudo establecer conexión');
}

async function disconnectDatabase() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}

function getConnection() {
  return mongoose.connection;
}

module.exports = { connectDatabase, disconnectDatabase, getConnection };
