'use strict';

const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');
const logger = require('../logger/logger');
const User = require('../../models/User');
const Strategy = require('../../models/Strategy');

async function migrate() {
  try {
    await _seedAdminUser();
    await _seedDefaultStrategies();
  } catch (err) {
    logger.warn('Seed: Error durante migración', { error: err.message });
  }
}

async function _seedAdminUser() {
  const adminEmail = process.env.SEED_USER_EMAIL || 'admin@example.com';
  const exists = await User.findOne({ email: adminEmail });
  if (exists) return;

  const password = process.env.SEED_USER_PASSWORD || 'ChangeMe123!';
  const hashedPassword = bcrypt.hashSync(password, 12);

  const encryptionKey = process.env.ENCRYPTION_KEY || 'change_me_in_production_32chars';
  const encryptedIqPassword = CryptoJS.AES.encrypt(
    process.env.SEED_IQ_PASSWORD || 'ChangeMeIQ123!',
    encryptionKey
  ).toString();

  await User.create({
    email: adminEmail,
    password: hashedPassword,
    iqEmail: process.env.SEED_IQ_EMAIL || 'iqadmin@example.com',
    iqPassword: encryptedIqPassword,
    role: 'admin'
  });

  logger.info(`Seed: Usuario admin creado (${adminEmail})`);
}

async function _seedDefaultStrategies() {
  const count = await Strategy.countDocuments();
  if (count > 0) return;

  const defaults = [
    { type: 'rsi', name: 'RSI Strategy', description: 'Estrategia basada en RSI', params: { period: 14, overboughtLevel: 70, oversoldLevel: 30, amount: 10, duration: 60 } },
    { type: 'ma-crossover', name: 'MA Crossover', description: 'Cruce de medias móviles', params: { fastPeriod: 9, slowPeriod: 21, maType: 'EMA', amount: 10, duration: 60 } },
    { type: 'bollinger-bands', name: 'Bollinger Bands', description: 'Estrategia de Bandas de Bollinger', params: { period: 20, stdDev: 2, amount: 10, duration: 60 } },
    { type: 'grid-trading', name: 'Grid Trading', description: 'Estrategia de rejilla', params: { gridCount: 10, amount: 5, duration: 60 } }
  ];

  for (const s of defaults) {
    await Strategy.create(s);
  }

  logger.info(`Seed: ${defaults.length} estrategias por defecto creadas`);
}

module.exports = migrate;
