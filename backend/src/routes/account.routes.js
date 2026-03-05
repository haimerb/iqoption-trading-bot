'use strict';

const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');

/**
 * @swagger
 * tags:
 *   name: Cuenta
 *   description: Información de cuenta y configuración de riesgo
 */

router.get('/balance', authenticate, accountController.getBalance);
router.get('/profile', authenticate, accountController.getProfile);
router.get('/risk-stats', authenticate, accountController.getRiskStats);
router.put('/risk-config',
  authenticate,
  [
    body('maxDailyLoss').optional().isFloat({ min: 0 }),
    body('maxOrderAmount').optional().isFloat({ min: 1 }),
    body('maxConsecutiveLosses').optional().isInt({ min: 1 }),
    body('maxOrdersPerHour').optional().isInt({ min: 1 })
  ],
  accountController.updateRiskConfig
);

module.exports = router;
