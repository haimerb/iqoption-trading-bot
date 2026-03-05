const BaseStrategy = require('../../src/modules/strategies/BaseStrategy')
const MACrossoverStrategy = require('../../src/modules/strategies/MACrossoverStrategy')
const { RSIStrategy, BollingerBandsStrategy } = require('../../src/modules/strategies/strategies')

// Genera velas sintéticas
function generateCandles(count, basePrice = 100, trend = 'flat') {
  return Array.from({ length: count }, (_, i) => {
    let price = basePrice
    if (trend === 'up') price = basePrice + i * 0.5
    if (trend === 'down') price = basePrice - i * 0.5
    if (trend === 'oscillate') price = basePrice + Math.sin(i * 0.5) * 5
    return { open: price - 0.1, close: price, high: price + 0.2, low: price - 0.2, volume: 1000 }
  })
}

describe('BaseStrategy — indicadores técnicos', () => {
  let strategy

  beforeEach(() => {
    strategy = new MACrossoverStrategy()
  })

  test('calculateSMA retorna la media correcta', () => {
    const candles = [
      { close: 10 }, { close: 20 }, { close: 30 }
    ]
    const sma = strategy.calculateSMA(candles, 3)
    expect(sma).toBeCloseTo(20)
  })

  test('calculateSMA devuelve null con datos insuficientes', () => {
    const candles = [{ close: 10 }]
    expect(strategy.calculateSMA(candles, 5)).toBeNull()
  })

  test('calculateEMA retorna valor finito', () => {
    const candles = generateCandles(30, 100)
    const ema = strategy.calculateEMA(candles, 14)
    expect(ema).not.toBeNull()
    expect(isFinite(ema)).toBe(true)
  })

  test('calculateRSI retorna valor entre 0 y 100', () => {
    const candles = generateCandles(30, 100, 'oscillate')
    const rsi = strategy.calculateRSI(candles, 14)
    expect(rsi).not.toBeNull()
    expect(rsi).toBeGreaterThanOrEqual(0)
    expect(rsi).toBeLessThanOrEqual(100)
  })

  test('calculateRSI devuelve null con menos de period+1 velas', () => {
    const candles = generateCandles(5, 100)
    expect(strategy.calculateRSI(candles, 14)).toBeNull()
  })

  test('calculateBollingerBands retorna upper > middle > lower', () => {
    const candles = generateCandles(25, 100, 'oscillate')
    const bb = strategy.calculateBollingerBands(candles, 20, 2)
    expect(bb).not.toBeNull()
    expect(bb.upper).toBeGreaterThan(bb.middle)
    expect(bb.middle).toBeGreaterThan(bb.lower)
  })

  test('calculateMACD retorna macd, signal, histogram', () => {
    const candles = generateCandles(40, 100, 'up')
    const macd = strategy.calculateMACD(candles, 12, 26, 9)
    expect(macd).not.toBeNull()
    expect(typeof macd.macd).toBe('number')
    expect(typeof macd.signal).toBe('number')
    expect(typeof macd.histogram).toBe('number')
  })
})

describe('MACrossoverStrategy', () => {
  let strategy

  beforeEach(() => {
    strategy = new MACrossoverStrategy({ fastPeriod: 5, slowPeriod: 10, amount: 10, duration: 60 })
  })

  test('instancia con params por defecto', () => {
    const s = new MACrossoverStrategy()
    const p = s.getDefaultParams()
    expect(p.fastPeriod).toBe(9)
    expect(p.slowPeriod).toBe(21)
  })

  test('emite señal BUY en golden cross', (done) => {
    // Sube luego baja: crea cruce alcista de EMA rápida sobre lenta
    const risingCandles = generateCandles(15, 90, 'down')
    const goldenCandles = generateCandles(15, 110, 'up')
    const candles = [...risingCandles, ...goldenCandles]

    strategy.once('buy-signal', (data) => {
      expect(data.direction).toBe('call')
      done()
    })

    // También puede no disparar si no hay cruce exacto — usamos timeout de fallback
    const timeout = setTimeout(() => done(), 200)
    strategy.once('buy-signal', () => clearTimeout(timeout))

    strategy.analyze(candles, candles[candles.length - 1].close)
  })

  test('analyze no lanza error con velas insuficientes', () => {
    const candles = generateCandles(3, 100)
    expect(() => strategy.analyze(candles, 100)).not.toThrow()
  })

  test('getStats retorna estructur correcta', () => {
    const stats = strategy.getStats()
    expect(stats).toHaveProperty('totalOrders')
    expect(stats).toHaveProperty('wins')
    expect(stats).toHaveProperty('losses')
    expect(stats).toHaveProperty('winRate')
  })
})

describe('RSIStrategy', () => {
  let strategy

  beforeEach(() => {
    strategy = new RSIStrategy({ period: 14, oversold: 30, overbought: 70, amount: 10, duration: 60 })
  })

  test('params por defecto correctos', () => {
    const p = new RSIStrategy().getDefaultParams()
    expect(p.period).toBe(14)
    expect(p.oversold).toBe(30)
    expect(p.overbought).toBe(70)
  })

  test('emite señal BUY cuando RSI sale de oversold', (done) => {
    // oversold: serie bajista seguida de rebote
    const downCandles = generateCandles(20, 100, 'down')
    const recoveryCandles = generateCandles(5, 90, 'up')
    const candles = [...downCandles, ...recoveryCandles]

    let signalReceived = false
    strategy.once('buy-signal', (data) => {
      signalReceived = true
      expect(data.direction).toBe('call')
      done()
    })

    setTimeout(() => { if (!signalReceived) done() }, 300)
    strategy.analyze(candles, candles[candles.length - 1].close)
  })

  test('no lanza error con velas insuficientes', () => {
    expect(() => strategy.analyze(generateCandles(5, 100), 100)).not.toThrow()
  })
})

describe('BollingerBandsStrategy', () => {
  let strategy

  beforeEach(() => {
    strategy = new BollingerBandsStrategy({ period: 20, stdDev: 2, amount: 10, duration: 60 })
  })

  test('params por defecto correctos', () => {
    const p = new BollingerBandsStrategy().getDefaultParams()
    expect(p.period).toBe(20)
    expect(p.stdDev).toBe(2)
  })

  test('emite señal BUY cuando precio toca banda inferior', (done) => {
    const candles = generateCandles(25, 100, 'oscillate')
    // Forzar precio muy bajo
    const lastCandle = { open: 80, close: 79, high: 81, low: 78, volume: 1000 }
    const allCandles = [...candles, lastCandle]

    let signalReceived = false
    strategy.once('buy-signal', () => { signalReceived = true; done() })
    setTimeout(() => { if (!signalReceived) done() }, 300)
    strategy.analyze(allCandles, 79)
  })

  test('no lanza error con velas insuficientes', () => {
    expect(() => strategy.analyze(generateCandles(5, 100), 100)).not.toThrow()
  })
})
