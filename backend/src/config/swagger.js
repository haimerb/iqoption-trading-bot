'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IQ Option Trading Bot API',
      version: '1.0.0',
      description: `
## API REST para Bot de Trading en IQ Option

Sistema completo de trading automatizado con:
- Autenticación JWT segura
- Gestión de órdenes en tiempo real
- Estrategias configurables
- Historial y analytics
- WebSocket para datos en tiempo real
      `,
      contact: {
        name: 'Trading Bot Support',
        email: 'support@tradingbot.io'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Desarrollo'
      },
      {
        url: 'https://api.tradingbot.io/v1',
        description: 'Producción'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT. Obtener en /auth/login'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Mensaje de error' },
            code: { type: 'string', example: 'ERROR_CODE' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string' }
          }
        }
      }
    },
    security: [{ BearerAuth: [] }]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

module.exports = swaggerJsdoc(options);
