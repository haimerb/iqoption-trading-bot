// Set JWT secrets for test environment (app.js doesn't load .env)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_32_chars_long_xxx'
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_key_32_char'

const request = require('supertest')

// Mocks antes de importar app
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
  getStatus: jest.fn().mockReturnValue({ isConnected: true, isAuthenticated: true, sessionData: { userId: 'mock-123' } }),
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn()
}))

jest.mock('../../src/modules/logger/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
  trading: jest.fn(), security: jest.fn(),
  http: jest.fn()
}))

jest.mock('../../src/models/User', () => {
  const mockDb = new Map()
  return {
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    findOne: jest.fn().mockImplementation(({ email }) => ({
      lean: jest.fn().mockResolvedValue(mockDb.get(email) || null)
    })),
    create: jest.fn().mockImplementation((data) => {
      const doc = { ...data, _id: require('uuid').v4(), toObject: () => ({ ...doc, _id: doc._id }) }
      mockDb.set(data.email, doc)
      return Promise.resolve(doc)
    }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    countDocuments: jest.fn().mockResolvedValue(0)
  }
})

const app = require('../../src/app')

describe('Auth API — /api/v1/auth', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'Password123!',
    iqEmail: 'iq@example.com',
    iqPassword: 'IQPass123!'
  }
  let accessToken
  let refreshToken

  describe('POST /api/v1/auth/register', () => {
    test('registra usuario correctamente', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('userId')
      expect(res.body.data).toHaveProperty('email')
      expect(res.body.data.email).toBe(testUser.email)
    })

    test('rechaza registro con email duplicado', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)

      expect(res.status).toBe(409)
      expect(res.body.success).toBe(false)
    })

    test('rechaza registro sin campos requeridos', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com' })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/v1/auth/login', () => {
    test('login exitoso con credenciales correctas', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('token')

      accessToken = res.body.data.token
      refreshToken = res.body.data.refreshToken
    })

    test('rechaza login con contraseña incorrecta', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword!' })

      expect(res.status).toBe(401)
    })

    test('rechaza login con usuario inexistente', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'noexiste@example.com', password: 'Password123!' })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/v1/auth/refresh', () => {
    test('renueva token correctamente', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('token')
    })

    test('rechaza refresh con token inválido', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/auth/status', () => {
    test('retorna estado de sesión con token válido', async () => {
      const res = await request(app)
        .get('/api/v1/auth/status')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('isAuthenticated', true)
    })

    test('rechaza petición sin token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/status')

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/v1/auth/logout', () => {
    test('cierra sesión correctamente', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })
})
