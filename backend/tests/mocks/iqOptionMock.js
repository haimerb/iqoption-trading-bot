const EventEmitter = require('events')

class IQOptionConnectionMock extends EventEmitter {
  constructor() {
    super()
    this.connected = false
    this.userId = null
    this._sentMessages = []
    this._subscriptions = new Map()
  }

  async connect(email, password) {
    this.connected = true
    this.userId = 'mock-user-123'
    this.emit('connected', { id: this.userId })
    return { success: true, userId: this.userId }
  }

  disconnect() {
    this.connected = false
    this.emit('disconnected')
  }

  send(name, msg) {
    this._sentMessages.push({ name, msg, ts: Date.now() })

    if (name === 'buyV3') {
      setTimeout(() => {
        this.emit('buy-complete', {
          id: `order-${Date.now()}`,
          active_id: msg.active_id,
          direction: msg.direction,
          price: 1.2345,
          expired: Date.now() + (msg.expired || 60) * 1000,
          profit_percent: 80
        })
      }, 50)
    }

    if (name === 'sellOption') {
      setTimeout(() => {
        this.emit('position-changed', {
          ext_id: msg.id,
          status: 'closed',
          pnl: 10
        })
      }, 50)
    }
  }

  subscribeToAsset(activeId, size) {
    this._subscriptions.set(`${activeId}_${size}`, true)
    this.send('subscribeMessage', {
      name: 'candle-generated',
      params: { active_id: activeId, size }
    })
  }

  getStatus() {
    return {
      connected: this.connected,
      userId: this.userId,
      subscriptions: [...this._subscriptions.keys()]
    }
  }

  simulatePriceUpdate(activeId, price) {
    this.emit('price-update', { active_id: activeId, price, time: Date.now() })
  }

  simulateCandleUpdate(activeId, size, candle) {
    this.emit('candle-update', {
      active_id: activeId,
      size,
      ...candle
    })
  }

  simulateOpenOrder(orderId, activeId, direction, profit = 0) {
    this.emit('position-changed', {
      ext_id: orderId,
      active_id: activeId,
      direction,
      status: profit > 0 ? 'win' : 'loose',
      pnl: profit
    })
  }

  clearMessages() {
    this._sentMessages = []
  }

  getLastMessage(name) {
    return [...this._sentMessages].reverse().find(m => m.name === name)
  }
}

const mockConnection = new IQOptionConnectionMock()

module.exports = { IQOptionConnectionMock, mockConnection }
