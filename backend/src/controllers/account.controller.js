'use strict';

const connection = require('../modules/connection/iqOptionConnection');
const riskModule = require('../modules/risk-management/riskModule');

/**
 * Obtener balance de la cuenta
 * GET /api/v1/account/balance
 */
async function getBalance(req, res, next) {
  try {
    const status = connection.getStatus();
    if (!status.isAuthenticated) {
      return res.status(503).json({
        success: false, error: 'No conectado con IQ Option', code: 'NOT_CONNECTED'
      });
    }

    res.json({
      success: true,
      data: {
        balance: status.sessionData?.balance || 0,
        currency: status.sessionData?.currency || 'USD',
        userId: status.sessionData?.userId
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Obtener información del perfil
 * GET /api/v1/account/profile
 */
async function getProfile(req, res, next) {
  try {
    const status = connection.getStatus();
    res.json({
      success: true,
      data: {
        ...status.sessionData,
        riskStats: riskModule.getStats()
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Actualizar configuración de riesgo
 * PUT /api/v1/account/risk-config
 */
async function updateRiskConfig(req, res, next) {
  try {
    const config = req.body;
    riskModule.updateConfig(config);
    res.json({
      success: true,
      message: 'Configuración de riesgo actualizada',
      data: riskModule.getStats()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Obtener estadísticas de riesgo
 * GET /api/v1/account/risk-stats
 */
async function getRiskStats(req, res, next) {
  try {
    res.json({ success: true, data: riskModule.getStats() });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBalance, getProfile, updateRiskConfig, getRiskStats };
