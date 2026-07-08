'use strict';

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./modules/events/socketManager');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./modules/logger/logger');
const { initQueueWorkers } = require('./modules/queue/queueWorkers');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function bootstrap() {
  try {
    // 1. Conectar base de datos
    await connectDatabase();
    logger.info('✅ MongoDB conectado');

    // 1b. Sembrar datos iniciales
    await require('./modules/seed/migrate')();
    logger.info('✅ Datos iniciales sembrados');

    // 2. Conectar Redis
    await connectRedis();
    logger.info('✅ Redis conectado');

    // 3. Iniciar servidor HTTP
    const server = http.createServer(app);

    // 4. Iniciar Socket.IO
    initSocket(server);
    logger.info('✅ Socket.IO inicializado');

    // 5. Iniciar workers de cola
    initQueueWorkers();
    logger.info('✅ Queue workers inicializados');

    // 6. Escuchar
    server.listen(PORT, HOST, () => {
      logger.info(`🚀 Servidor corriendo en http://${HOST}:${PORT}`);
      logger.info(`📚 Documentación API: http://${HOST}:${PORT}/api-docs`);
      logger.info(`🌍 Entorno: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));

  } catch (error) {
    logger.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(server) {
  logger.info('🛑 Iniciando apagado graceful...');
  server.close(() => {
    logger.info('✅ Servidor HTTP cerrado');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('❌ Timeout de apagado forzado');
    process.exit(1);
  }, 10000);
}

bootstrap();
