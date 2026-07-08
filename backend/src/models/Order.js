'use strict';

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  strategyId: { type: String, default: null },
  activeId: { type: Number, required: true },
  direction: { type: String, enum: ['call', 'put'], required: true },
  amount: { type: Number, required: true },
  duration: { type: Number, required: true },
  orderType: { type: String, enum: ['binary', 'turbo', 'digital'], default: 'digital' },
  status: { type: String, enum: ['open', 'closed', 'cancelled'], default: 'open' },
  openQuote: { type: Number, default: null },
  closeQuote: { type: Number, default: null },
  pnl: { type: Number, default: null },
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
