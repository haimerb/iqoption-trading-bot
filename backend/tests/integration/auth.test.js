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
  getStatus: jest.fn().mockReturnValue({ connected: true, userId: 'mock-123' }),
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn()
}))

jest.mock('../../src/modules/logger/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
  trading: jest.fn(), security: jest.fn(),
  http: jest.fn()
}))

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
      expect(res.body.data).toHaveProperty('accessToken')
      expect(res.body.data).toHaveProperty('refreshToken')
      expect(res.body.data.user.email).toBe(testUser.email)

      accessToken = res.body.data.accessToken
      refreshToken = res.body.data.refreshToken
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
      expect(res.body.data).toHaveProperty('accessToken')

      accessToken = res.body.data.accessToken
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
      expect(res.body.data).toHaveProperty('accessToken')
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
      expect(res.body.data).toHaveProperty('authenticated', true)
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
