'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const marketData = require('../modules/market-data/marketDataModule');

/**
 * @swagger
 * tags:
 *   name: Instrumentos
 *   description: Activos e instrumentos disponibles en IQ Option
 */

router.get('/', authenticate, async (req, res, next) => {
  try {
    const instruments = await marketData.getAvailableAssets();
    res.json({ success: true, data: instruments, count: instruments.length });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const instruments = await marketData.getAvailableAssets();
    const instrument = instruments.find(i => i.id === parseInt(req.params.id));
    if (!instrument) {
      return res.status(404).json({ success: false, error: 'Instrumento no encontrado' });
    }
    res.json({ success: true, data: instrument });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
