'use strict';

const logger = require('../logger/logger');

/**
 * Módulo de Gestión de Riesgo
 * Controla límites de pérdida, tamaño de posición y frecuencia de trading.
 */
class RiskManagementModule {
  constructor() {
    this.config = {
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 100,
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE) || 1000,
      maxConsecutiveLosses: 5,
      maxOrdersPerHour: 20,
      minOrderAmount: 1,
      maxOrderAmount: parseFloat(process.env.DEFAULT_ORDER_AMOUNT) * 10 || 100,
      cooldownAfterLoss: 60000, // 1 minuto
      martingaleMax: 3
    };

    this.dailyStats = {
      date: this._getToday(),
      totalLoss: 0,
      totalPnl: 0,
      orderCount: 0,
      wins: 0,
      losses: 0,
      consecutiveLosses: 0
    };

    this.lastLossTime = null;
    this.hourlyOrderCount = 0;
    this.hourlyCountReset = null;

    this._startDailyReset();
  }

  /**
   * Validar si una orden puede ejecutarse
   * @returns {Object} { approved: boolean, reason?: string }
   */
  async validateOrder({ activeId, amount, direction }) {
    // 1. Verificar reinicio de día
    this._checkDailyReset();

    // 2. Monto mínimo/máximo
    if (amount < this.config.minOrderAmount) {
      return { approved: false, reason: `Monto mínimo: $${this.config.minOrderAmount}` };
    }
    if (amount > this.config.maxOrderAmount) {
      return { approved: false, reason: `Monto máximo: $${this.config.maxOrderAmount}` };
    }

    // 3. Pérdida diaria máxima
    if (Math.abs(this.dailyStats.totalLoss) >= this.config.maxDailyLoss) {
      logger.security('MAX_DAILY_LOSS_REACHED', {
        currentLoss: this.dailyStats.totalLoss,
        limit: this.config.maxDailyLoss
      });
      return {
        approved: false,
        reason: `Límite de pérdida diaria alcanzado ($${this.config.maxDailyLoss})`
      };
    }

    // 4. Pérdidas consecutivas
    if (this.dailyStats.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      return {
        approved: false,
        reason: `Máximo de pérdidas consecutivas (${this.config.maxConsecutiveLosses})`
      };
    }

    // 5. Cooldown después de pérdida
    if (this.lastLossTime) {
      const elapsed = Date.now() - this.lastLossTime;
      if (elapsed < this.config.cooldownAfterLoss) {
        const remaining = Math.ceil((this.config.cooldownAfterLoss - elapsed) / 1000);
        return {
          approved: false,
          reason: `Cooldown activo. Esperar ${remaining}s`
        };
      }
    }

    // 6. Límite de órdenes por hora
    if (this.hourlyOrderCount >= this.config.maxOrdersPerHour) {
      return {
        approved: false,
        reason: `Límite de ${this.config.maxOrdersPerHour} órdenes por hora alcanzado`
      };
    }

    this.hourlyOrderCount++;
    return { approved: true };
  }

  /**
   * Registrar resultado de una orden
   */
  recordOrderResult({ activeId, amount, pnl }) {
    this._checkDailyReset();

    this.dailyStats.orderCount++;
    this.dailyStats.totalPnl += pnl;

    if (pnl > 0) {
      this.dailyStats.wins++;
      this.dailyStats.consecutiveLosses = 0;
    } else {
      this.dailyStats.losses++;
      this.dailyStats.consecutiveLosses++;
      this.dailyStats.totalLoss += Math.abs(pnl);
      this.lastLossTime = Date.now();

      logger.warn('RiskModule: Pérdida registrada', {
        pnl,
        consecutiveLosses: this.dailyStats.consecutiveLosses,
        totalLoss: this.dailyStats.totalLoss
      });
    }
  }

  /**
   * Calcular tamaño óptimo de posición (Kelly Criterion simplificado)
   * @param {number} winRate - Tasa de win histórica (0-1)
   * @param {number} avgWin - Promedio de ganancia
   * @param {number} avgLoss - Promedio de pérdida (positivo)
   * @param {number} accountBalance - Balance actual
   */
  calculatePositionSize(winRate, avgWin, avgLoss, accountBalance) {
    if (avgLoss === 0) return this.config.minOrderAmount;

    const b = avgWin / avgLoss; // ratio win/loss
    const q = 1 - winRate;
    const kelly = (b * winRate - q) / b;

    // Kelly fraccionario (quarter Kelly para conservadurismo)
    const fractionKelly = kelly * 0.25;
    const recommendedSize = accountBalance * Math.max(0, fractionKelly);

    return Math.min(
      Math.max(recommendedSize, this.config.minOrderAmount),
      this.config.maxOrderAmount
    );
  }

  /**
   * Actualizar configuración de riesgo
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('RiskModule: Configuración actualizada', this.config);
  }

  getStats() {
    return {
      config: this.config,
      dailyStats: { ...this.dailyStats },
      hourlyOrderCount: this.hourlyOrderCount
    };
  }

  _getToday() {
    return new Date().toISOString().split('T')[0];
  }

  _checkDailyReset() {
    const today = this._getToday();
    if (this.dailyStats.date !== today) {
      logger.info('RiskModule: Reinicio de estadísticas diarias');
      this.dailyStats = {
        date: today,
        totalLoss: 0,
        totalPnl: 0,
        orderCount: 0,
        wins: 0,
        losses: 0,
        consecutiveLosses: 0
      };
    }
  }

  _startDailyReset() {
    // Resetear contador horario cada hora
    this.hourlyCountReset = setInterval(() => {
      this.hourlyOrderCount = 0;
    }, 3600000);
  }
}

module.exports = new RiskManagementModule();
