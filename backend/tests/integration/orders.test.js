const request = require('supertest')

jest.mock('../../src/config/database', () => ({
  connectDatabase: jest.fn().mockResolvedValue(true)
}))
jest.mock('../../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(true),
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1)
  })
}))
jest.mock('../../src/modules/connection/iqOptionConnection', () => ({
  connect: jest.fn().mockResolvedValue({ success: true, userId: 'mock-123' }),
  disconnect: jest.fn(),
  getStatus: jest.fn().mockReturnValue({ connected: true, userId: 'mock-123' }),
  on: jest.fn(), once: jest.fn(), emit: jest.fn()
}))
jest.mock('../../src/modules/logger/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
  trading: jest.fn(), security: jest.fn(), http: jest.fn()
}))
jest.mock('../../src/modules/queue/queueWorkers', () => ({
  initQueueWorkers: jest.fn(),
  queueOrder: jest.fn().mockResolvedValue({ jobId: 'job-mock-1', status: 'queued' }),
  getQueuesStatus: jest.fn().mockReturnValue({ queues: [] })
}))
jest.mock('../../src/modules/order-execution/orderExecutionModule', () => ({
  getOpenPositions: jest.fn().mockReturnValue([
    { id: 'pos-1', activeId: 1, symbol: 'EURUSD', direction: 'call', amount: 10, openPrice: 1.2345, openedAt: new Date() }
  ]),
  getOrderHistory: jest.fn().mockReturnValue([]),
  closePosition: jest.fn().mockResolvedValue({ id: 'pos-1', status: 'closed', pnl: 8 }),
  getStatus: jest.fn().mockReturnValue({ openPositions: 1, totalOrders: 5 }),
  on: jest.fn()
}))

const app = require('../../src/app')

async function getAuthToken() {
  const uid = `orders-test-${Date.now()}@test.com`
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: uid, password: 'Password123!', iqEmail: 'iq@test.com', iqPassword: 'IQ123!' })
  return reg.body.data.accessToken
}

describe('Orders API — /api/v1/orders', () => {
  let token

  beforeAll(async () => {
    token = await getAuthToken()
  })

  describe('POST /api/v1/orders/open', () => {
    test('encola orden correctamente', async () => {
      const res = await request(app)
        .post('/api/v1/orders/open')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activeId: 1,
          symbol: 'EURUSD',
          direction: 'call',
          amount: 10,
          duration: 60
        })

      expect(res.status).toBe(202)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('jobId')
    })

    test('rechaza orden sin autenticación', async () => {
      const res = await request(app)
        .post('/api/v1/orders/open')
        .send({ activeId: 1, direction: 'call', amount: 10, duration: 60 })

      expect(res.status).toBe(401)
    })

    test('rechaza orden con dirección inválida', async () => {
      const res = await request(app)
        .post('/api/v1/orders/open')
        .set('Authorization', `Bearer ${token}`)
        .send({ activeId: 1, symbol: 'EURUSD', direction: 'invalid', amount: 10, duration: 60 })

      expect(res.status).toBe(400)
    })

    test('rechaza orden con amount 0 o negativo', async () => {
      const res = await request(app)
        .post('/api/v1/orders/open')
        .set('Authorization', `Bearer ${token}`)
        .send({ activeId: 1, symbol: 'EURUSD', direction: 'call', amount: -5, duration: 60 })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/v1/orders/open', () => {
    test('retorna posiciones abiertas', async () => {
      const res = await request(app)
        .get('/api/v1/orders/open')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('GET /api/v1/orders/history', () => {
    test('retorna historial de órdenes', async () => {
      const res = await request(app)
        .get('/api/v1/orders/history')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('POST /api/v1/orders/close/:positionId', () => {
    test('cierra posición existente', async () => {
      const res = await request(app)
        .post('/api/v1/orders/close/pos-1')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('GET /api/v1/orders/status', () => {
    test('retorna estado del módulo de órdenes', async () => {
      const res = await request(app)
        .get('/api/v1/orders/status')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })
})
