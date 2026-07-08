'use strict';

const mongoose = require('mongoose');

const strategySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  version: { type: String, default: '1.0.0' },
  params: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['stopped', 'running', 'paused', 'error'], default: 'stopped' },
  activeId: { type: Number, default: null },
  stats: {
    totalOrders: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalPnl: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    lastSignalAt: { type: Date, default: null }
  }
}, { timestamps: true });

module.exports = mongoose.model('Strategy', strategySchema);
