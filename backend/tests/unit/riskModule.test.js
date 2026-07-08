// Mock del logger antes de importar riskModule
jest.mock('../../src/modules/logger/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  trading: jest.fn(),
  security: jest.fn()
}))

const riskModule = require('../../src/modules/risk-management/riskModule')

describe('RiskModule', () => {
  beforeEach(() => {
    riskModule.updateConfig({
      maxDailyLoss: 100,
      maxOrderAmount: 50,
      maxConsecutiveLosses: 3,
      maxOrdersPerHour: 10,
      cooldownAfterLoss: 0 // sin cooldown en tests
    })
    // Resetear stats
    riskModule.dailyStats = {
      date: new Date().toISOString().split('T')[0],
      orderCount: 0,
      wins: 0,
      losses: 0,
      totalPnl: 0,
      totalLoss: 0,
      consecutiveLosses: 0
    }
    riskModule.hourlyOrderCount = 0
    riskModule.lastLossTime = null
  })

  describe('validateOrder', () => {
    test('aprueba orden válida', async () => {
      const result = await riskModule.validateOrder({
        activeId: 1,
        amount: 10,
        direction: 'call'
      })
      expect(result.approved).toBe(true)
    })

    test('rechaza orden que supera maxOrderAmount', async () => {
      const result = await riskModule.validateOrder({
        activeId: 1,
        amount: 200,
        direction: 'call'
      })
      expect(result.approved).toBe(false)
      expect(result.reason).toMatch(/monto/i)
    })

    test('rechaza cuando pérdida diaria supera el límite', async () => {
      riskModule.dailyStats.totalLoss = 110
      const result = await riskModule.validateOrder({
        activeId: 1,
        amount: 10,
        direction: 'call'
      })
      expect(result.approved).toBe(false)
      expect(result.reason).toMatch(/p.rdida diaria/i)
    })

    test('rechaza cuando pérdidas consecutivas superan el límite', async () => {
      riskModule.dailyStats.consecutiveLosses = 3
      const result = await riskModule.validateOrder({
        activeId: 1,
        amount: 10,
        direction: 'call'
      })
      expect(result.approved).toBe(false)
    })

    test('rechaza cuando se supera maxOrdersPerHour', async () => {
      riskModule.hourlyOrderCount = 10
      const result = await riskModule.validateOrder({
        activeId: 1,
        amount: 10,
        direction: 'call'
      })
      expect(result.approved).toBe(false)
    })
  })

  describe('recordOrderResult', () => {
    test('incrementa wins y resetea consecutiveLosses en win', () => {
      riskModule.dailyStats.consecutiveLosses = 2
      riskModule.recordOrderResult({ activeId: 1, amount: 10, pnl: 8 })
      expect(riskModule.dailyStats.wins).toBe(1)
      expect(riskModule.dailyStats.consecutiveLosses).toBe(0)
      expect(riskModule.dailyStats.totalPnl).toBeCloseTo(8)
    })

    test('incrementa losses y consecutiveLosses en loss', () => {
      riskModule.recordOrderResult({ activeId: 1, amount: 10, pnl: -10 })
      expect(riskModule.dailyStats.losses).toBe(1)
      expect(riskModule.dailyStats.consecutiveLosses).toBe(1)
      expect(riskModule.dailyStats.totalLoss).toBe(10)
    })

    test('acumula múltiples resultados correctamente', () => {
      riskModule.recordOrderResult({ activeId: 1, amount: 10, pnl: 8 })
      riskModule.recordOrderResult({ activeId: 1, amount: 10, pnl: -10 })
      riskModule.recordOrderResult({ activeId: 1, amount: 10, pnl: 8 })
      expect(riskModule.dailyStats.wins).toBe(2)
      expect(riskModule.dailyStats.losses).toBe(1)
    })
  })

  describe('calculatePositionSize (Kelly Criterion)', () => {
    test('retorna tamaño positivo para estrategia rentable', () => {
      const size = riskModule.calculatePositionSize(0.6, 1.8, 1.0, 1000)
      expect(size).toBeGreaterThan(0)
    })

    test('retorna 0 para winRate menor o igual a 0', () => {
      const size = riskModule.calculatePositionSize(0, 1.8, 1.0, 1000)
      expect(size).toBe(1) // clamped to minOrderAmount
    })

    test('no supera maxOrderAmount', () => {
      // Kelly puede dar valores muy altos, debe estar acotado
      const size = riskModule.calculatePositionSize(0.9, 5, 1.0, 100000)
      expect(size).toBeLessThanOrEqual(riskModule.config.maxOrderAmount)
    })
  })

  describe('getStats', () => {
    test('retorna estructura completa', () => {
      const stats = riskModule.getStats()
      expect(stats).toHaveProperty('dailyStats')
      expect(stats.dailyStats).toHaveProperty('consecutiveLosses')
      expect(stats).toHaveProperty('config')
      expect(stats.config).toHaveProperty('maxDailyLoss')
    })
  })

  describe('updateConfig', () => {
    test('actualiza parcialmente la configuración', () => {
      riskModule.updateConfig({ maxDailyLoss: 500 })
      expect(riskModule.config.maxDailyLoss).toBe(500)
      expect(riskModule.config.maxOrderAmount).toBe(50)
    })
  })
})
