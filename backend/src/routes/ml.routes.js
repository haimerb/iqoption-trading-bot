'use strict';

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const mlController = require('../controllers/ml-security.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.get('/health', mlController.getHealth);

const publicPredictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Demasiadas peticiones, intenta en 15 minutos', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  }
});

const publicTrainLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Demasiadas peticiones de entrenamiento', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post(
  '/predict/public',
  publicPredictLimiter,
  [
    body('candles').isArray({ min: 20 }).withMessage('Se requieren al menos 20 velas'),
    body('candles.*.close').isFloat({ min: 0 }).withMessage('close es requerido'),
    body('asset').optional().isString(),
    body('timeframe').optional().isString()
  ],
  mlController.publicPredict
);

router.get('/stats', authenticate, mlController.getStats);
router.post('/unlock', authenticate, mlController.clearBlocked);

router.post(
  '/auto-train',
  authenticate,
  [
    body('asset').optional().isString(),
    body('minDataPoints').optional().isInt({ min: 50, max: 1000 }),
    body('threshold').optional().isFloat({ min: 0.001, max: 0.01 })
  ],
  mlController.autoTrain
);

router.get(
  '/candles/:asset',
  authenticate,
  [
    query('timeframe').optional().isString(),
    query('count').optional().isInt({ min: 10, max: 500 })
  ],
  mlController.getCandles
);

router.post(
  '/train',
  authenticate,
  publicTrainLimiter,
  [
    body('candles').isArray({ min: 100 }).withMessage('Se requieren al menos 100 velas'),
    body('labels').isArray({ min: 100 }).withMessage('Labels requerido'),
    body('asset').optional().isString(),
    body('timeframe').optional().isString(),
    body('modelType').optional().isIn(['random_forest', 'gradient_boosting'])
  ],
  mlController.train
);

router.get('/models', authenticate, mlController.listModels);
router.delete('/models/:asset', authenticate, mlController.deleteModel);

router.post(
  '/predict',
  authenticate,
  [
    body('candles').isArray({ min: 20 }).withMessage('Se requieren al menos 20 velas'),
    body('candles.*.open').isFloat({ min: 0 }).optional(),
    body('candles.*.high').isFloat({ min: 0 }).optional(),
    body('candles.*.low').isFloat({ min: 0 }).optional(),
    body('candles.*.close').isFloat({ min: 0 }).withMessage('close es requerido'),
    body('asset').optional().isString(),
    body('timeframe').optional().isString()
  ],
  mlController.predict
);

module.exports = router;