import axios from 'axios'
import { useAuthStore } from '../store'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
})

// Request interceptor: agregar token JWT
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: manejar errores y refresh token
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config

    // Token expirado: intentar refresh
    if (error.response?.status === 401 &&
        error.response?.data?.code === 'AUTH_TOKEN_EXPIRED' &&
        !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const { refreshToken } = useAuthStore.getState()
        const response = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
        const { token } = response.data.data

        useAuthStore.getState().updateToken(token)
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    // Mostrar toast de error
    const message = error.response?.data?.error || 'Error de conexión'
    if (error.response?.status >= 500) {
      toast.error(`Error del servidor: ${message}`)
    }

    return Promise.reject(error.response?.data || error)
  }
)

// ================================
// Auth API
// ================================
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  getStatus: () => api.get('/auth/status'),
  generateLoginToken: () => api.post('/auth/tokens'),
  loginWithToken: (token) => api.post('/auth/login-with-token', { token })
}

// ================================
// Account API
// ================================
export const accountAPI = {
  getBalance: () => api.get('/account/balance'),
  getProfile: () => api.get('/account/profile'),
  getRiskStats: () => api.get('/account/risk-stats'),
  updateRiskConfig: (config) => api.put('/account/risk-config', config)
}

// ================================
// Market Data API
// ================================
export const marketDataAPI = {
  getInstruments: () => api.get('/market-data/instruments'),
  getCurrentPrice: (activeId) => api.get(`/market-data/price/${activeId}`),
  getCandles: (activeId, params) => api.get(`/market-data/candles/${activeId}`, { params }),
  subscribe: (data) => api.post('/market-data/subscribe', data),
  unsubscribe: (data) => api.post('/market-data/unsubscribe', data),
  getStatus: () => api.get('/market-data/status')
}

// ================================
// Orders API
// ================================
export const ordersAPI = {
  openOrder: (data) => api.post('/orders/open', data),
  closePosition: (positionId) => api.post(`/orders/close/${positionId}`),
  getOpenPositions: () => api.get('/orders/open'),
  getHistory: (params) => api.get('/orders/history', { params }),
  getStatus: () => api.get('/orders/status')
}

// ================================
// Strategies API
// ================================
export const strategiesAPI = {
  getAvailable: () => api.get('/strategies/available'),
  getAll: () => api.get('/strategies'),
  create: (data) => api.post('/strategies', data),
  start: (id, data) => api.post(`/strategies/${id}/start`, data),
  pause: (id) => api.post(`/strategies/${id}/pause`),
  resume: (id) => api.post(`/strategies/${id}/resume`),
  stop: (id) => api.delete(`/strategies/${id}`),
  updateParams: (id, params) => api.patch(`/strategies/${id}/params`, params)
}

// ================================
// History API
// ================================
export const historyAPI = {
  getHistory: (params) => api.get('/history', { params }),
  getStats: () => api.get('/history/stats')
}

// ================================
// Bot API
// ================================
export const botAPI = {
  getStatus: () => api.get('/bot/status'),
  emergencyStop: () => api.post('/bot/emergency-stop'),
  getHealth: () => api.get('/bot/health')
}

// ================================
// ML API
// ================================
export const mlAPI = {
  getHealth: () => api.get('/ml/health'),
  predict: (data) => api.post('/ml/predict', data),
  predictPublic: (data, apiKey) => api.post('/ml/predict/public', data, {
    headers: { 'x-api-key': apiKey }
  }),
  autoTrain: (data) => api.post('/ml/auto-train', data),
  train: (data) => api.post('/ml/train', data),
  getModels: () => api.get('/ml/models'),
  getStats: () => api.get('/ml/stats'),
  getCandles: (asset, params) => api.get(`/ml/candles/${asset}`, { params }),
  unlock: (key) => api.post('/ml/unlock', null, { params: { key } })
}

export default api
