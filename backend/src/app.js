'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Middlewares propios
const { errorHandler } = require('./middlewares/errorHandler');
const { notFoundHandler } = require('./middlewares/notFoundHandler');
const { rateLimiter } = require('./middlewares/rateLimiter');
const { requestLogger } = require('./middlewares/requestLogger');

// Rutas
const authRoutes = require('./routes/auth.routes');
const accountRoutes = require('./routes/account.routes');
const instrumentRoutes = require('./routes/instrument.routes');
const marketDataRoutes = require('./routes/marketData.routes');
const orderRoutes = require('./routes/order.routes');
const strategyRoutes = require('./routes/strategy.routes');
const historyRoutes = require('./routes/history.routes');
const botRoutes = require('./routes/bot.routes');
const mlRoutes = require('./routes/ml.routes');

const app = express();

// ================================
// Middlewares de seguridad
// ================================
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ================================
// Middlewares de parseo y utilidades
// ================================
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ================================
// Logging
// ================================
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}
app.use(requestLogger);

// ================================
// Rate Limiting global
// ================================
app.use('/api/', rateLimiter);

// ================================
// Documentación Swagger
// ================================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { background-color: #1a1a2e; }',
  customSiteTitle: 'IQ Option Bot API'
}));

// ================================
// Health check
// ================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// ================================
// Rutas de la API
// ================================
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/account`, accountRoutes);
app.use(`${API_PREFIX}/instruments`, instrumentRoutes);
app.use(`${API_PREFIX}/market-data`, marketDataRoutes);
app.use(`${API_PREFIX}/orders`, orderRoutes);
app.use(`${API_PREFIX}/strategies`, strategyRoutes);
app.use(`${API_PREFIX}/history`, historyRoutes);
app.use(`${API_PREFIX}/bot`, botRoutes);
app.use(`${API_PREFIX}/ml`, mlRoutes);

// ================================
// Manejo de errores
// ================================
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
