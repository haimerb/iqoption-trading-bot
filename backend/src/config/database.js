'use strict';

const mongoose = require('mongoose');
const logger = require('../modules/logger/logger');

let isConnected = false;

async function connectDatabase() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/iqoption_bot';

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

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
  });
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
