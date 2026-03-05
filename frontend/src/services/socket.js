import { io } from 'socket.io-client'
import { useBotStore } from '../store'
import toast from 'react-hot-toast'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/'

let socket = null

/**
 * Inicializar conexión Socket.IO
 */
export function initSocket(token) {
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000
  })

  const store = useBotStore.getState()

  socket.on('connect', () => {
    console.log('[Socket] Conectado:', socket.id)
    store.setConnectionStatus(true)
    store.addLog({ level: 'info', message: '🟢 Socket.IO conectado', category: 'SYSTEM' })
  })

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Desconectado:', reason)
    store.setConnectionStatus(false)
    store.addLog({ level: 'warn', message: `🔴 Socket desconectado: ${reason}`, category: 'SYSTEM' })
  })

  socket.on('connect_error', (err) => {
    console.error('[Socket] Error:', err.message)
    store.addLog({ level: 'error', message: `❌ Error de socket: ${err.message}`, category: 'SYSTEM' })
  })

  // ====================================
  // Eventos del servidor
  // ====================================

  // Precio actualizado
  socket.on('market:price', (data) => {
    store.updatePrice(data.activeId, data)
  })

  // Vela actualizada
  socket.on('market:candle', (candle) => {
    // Manejar en componentes específicos si es necesario
  })

  // Señal de estrategia
  socket.on('strategy:signal', (signal) => {
    store.addLog({
      level: 'info',
      message: `📊 Señal: ${signal.strategyName} → ${signal.direction.toUpperCase()} (${signal.reason})`,
      category: 'STRATEGY',
      data: signal
    })
    toast(`Señal: ${signal.strategyName} → ${signal.direction.toUpperCase()}`, {
      icon: signal.direction === 'call' ? '📈' : '📉'
    })
  })

  // Orden abierta
  socket.on('order:opened', (order) => {
    store.addPosition(order)
    store.addLog({
      level: 'success',
      message: `✅ Orden abierta: ${order.direction?.toUpperCase()} $${order.amount} @ ${order.openQuote}`,
      category: 'ORDER',
      data: order
    })
    toast.success(`Orden abierta: ${order.direction?.toUpperCase()} $${order.amount}`)
  })

  // Posición cerrada
  socket.on('order:closed', (position) => {
    store.removePosition(position.id)
    store.addToHistory(position)
    store.addLog({
      level: position.pnl > 0 ? 'success' : 'error',
      message: `${position.pnl > 0 ? '✅ WIN' : '❌ LOSS'} $${position.pnl?.toFixed(2)} | ${position.direction?.toUpperCase()}`,
      category: 'ORDER',
      data: position
    })
    if (position.pnl > 0) {
      toast.success(`WIN: +$${position.pnl?.toFixed(2)}`)
    } else {
      toast.error(`LOSS: $${position.pnl?.toFixed(2)}`)
    }
  })

  // Posición actualizada
  socket.on('order:updated', (position) => {
    // Actualizar estado de posición abierta
  })

  // Error de estrategia
  socket.on('strategy:error', (data) => {
    store.addLog({
      level: 'error',
      message: `❌ Error en estrategia: ${data.error}`,
      category: 'STRATEGY',
      data
    })
    store.addAlert({
      type: 'error',
      title: 'Error de Estrategia',
      message: data.error,
      strategyId: data.strategyId
    })
    toast.error(`Estrategia error: ${data.error}`)
  })

  // Bot status
  socket.on('bot:status', (status) => {
    if (status.connection?.sessionData?.balance) {
      store.setBalance(
        status.connection.sessionData.balance,
        status.connection.sessionData.currency
      )
    }
    if (status.strategies) {
      store.setStrategies(status.strategies)
    }
  })

  return socket
}

export function getSocket() {
  return socket
}

export function subscribeToAsset(activeId, size = 60) {
  if (socket?.connected) {
    socket.emit('subscribe:asset', { activeId, size })
  }
}

export function unsubscribeFromAsset(activeId, size = 60) {
  if (socket?.connected) {
    socket.emit('unsubscribe:asset', { activeId, size })
  }
}

export function requestBotStatus() {
  if (socket?.connected) {
    socket.emit('get:status')
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
