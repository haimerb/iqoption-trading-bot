'use strict';

const express = require('express');
const router = express.Router();
const marketDataController = require('../controllers/marketData.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Market Data
 *   description: Datos de mercado en tiempo real e histórico
 */

router.get('/instruments', authenticate, marketDataController.getInstruments);
router.get('/price/:activeId', authenticate, marketDataController.getCurrentPrice);
router.get('/candles/:activeId', authenticate, marketDataController.getCandles);
router.post('/subscribe', authenticate, marketDataController.subscribeToAsset);
router.post('/unsubscribe', authenticate, marketDataController.unsubscribeFromAsset);
router.get('/status', authenticate, marketDataController.getMarketDataStatus);

module.exports = router;
