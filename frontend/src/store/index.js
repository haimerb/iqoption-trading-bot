import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Store global de autenticación
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      login: (token, refreshToken, user) => set({
        token,
        refreshToken,
        user,
        isAuthenticated: true
      }),

      logout: () => set({
        token: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false
      }),

      updateToken: (token) => set({ token }),

      getToken: () => get().token
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

/**
 * Store ML / IA Predictions
 */
export const useMLStore = create((set, get) => ({
  // Modelos entrenados
  models: [],
  
  // Predicciones actuales por activo
  predictions: {},
  
  // Histórico de predicciones
  predictionHistory: [],
  
  // Stats del ML
  mlStats: {
    totalPredictions: 0,
    correct: 0,
    accuracy: 0
  },
  
  // Configuración
  config: {
    minConfidence: 0.65,
    usePatterns: true,
    useML: true,
    selectedAsset: 'EURUSD',
    selectedTimeframe: '1m'
  },
  
  // Estado
  isLoading: false,
  lastError: null,
  
  setModels: (models) => set({ models }),
  
  setPrediction: (asset, prediction) => set(state => ({
    predictions: { ...state.predictions, [asset]: prediction }
  })),
  
  addToHistory: (prediction) => set(state => ({
    predictionHistory: [{
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...prediction
    }, ...state.predictionHistory].slice(0, 500)
  })),
  
  setMLStats: (stats) => set({ mlStats: stats }),
  
  updateConfig: (config) => set(state => ({
    config: { ...state.config, ...config }
  })),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (lastError) => set({ lastError })
}))

/**
 * Store del bot de trading
 */
export const useBotStore = create((set, get) => ({
  // Estado de conexión
  isConnected: false,
  iqBalance: 0,
  iqCurrency: 'USD',

  // Órdenes
  openPositions: [],
  orderHistory: [],

  // Estrategias activas
  strategies: [],

  // Precios en tiempo real
  livePrices: {},

  // Logs en tiempo real
  logs: [],
  maxLogs: 200,

  // Alertas
  alerts: [],

  // Estadísticas
  stats: {
    totalOrders: 0,
    wins: 0,
    losses: 0,
    totalPnl: 0,
    winRate: 0
  },

  // Acciones
  setConnectionStatus: (isConnected) => set({ isConnected }),

  setBalance: (balance, currency) => set({ iqBalance: balance, iqCurrency: currency }),

  setOpenPositions: (positions) => set({ openPositions: positions }),

  addPosition: (position) => set(state => ({
    openPositions: [...state.openPositions, position]
  })),

  removePosition: (positionId) => set(state => ({
    openPositions: state.openPositions.filter(p => p.id !== positionId)
  })),

  addToHistory: (order) => set(state => ({
    orderHistory: [order, ...state.orderHistory].slice(0, 500),
    stats: {
      totalOrders: state.stats.totalOrders + 1,
      wins: state.stats.wins + (order.pnl > 0 ? 1 : 0),
      losses: state.stats.losses + (order.pnl <= 0 ? 1 : 0),
      totalPnl: state.stats.totalPnl + (order.pnl || 0),
      winRate: ((state.stats.wins + (order.pnl > 0 ? 1 : 0)) /
        (state.stats.totalOrders + 1) * 100).toFixed(1)
    }
  })),

  setStrategies: (strategies) => set({ strategies }),

  updateStrategy: (updatedStrategy) => set(state => ({
    strategies: state.strategies.map(s =>
      s.id === updatedStrategy.id ? updatedStrategy : s
    )
  })),

  addStrategy: (strategy) => set(state => ({
    strategies: [...state.strategies, strategy]
  })),

  removeStrategy: (strategyId) => set(state => ({
    strategies: state.strategies.filter(s => s.id !== strategyId)
  })),

  updatePrice: (activeId, priceData) => set(state => ({
    livePrices: { ...state.livePrices, [activeId]: priceData }
  })),

  addLog: (log) => set(state => {
    const newLogs = [
      {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...log
      },
      ...state.logs
    ].slice(0, state.maxLogs)
    return { logs: newLogs }
  }),

  clearLogs: () => set({ logs: [] }),

  addAlert: (alert) => set(state => ({
    alerts: [{ id: Date.now(), readAt: null, createdAt: new Date().toISOString(), ...alert }, ...state.alerts]
  })),

  markAlertRead: (alertId) => set(state => ({
    alerts: state.alerts.map(a => a.id === alertId ? { ...a, readAt: new Date().toISOString() } : a)
  }))
}))
