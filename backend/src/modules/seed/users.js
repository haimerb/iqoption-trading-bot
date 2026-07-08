'use strict';

const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');

const users = new Map();

function generatePasswordHash(password) {
  return bcrypt.hashSync(password, 12);
}

function encryptIQPassword(password, key) {
  return CryptoJS.AES.encrypt(password, key).toString();
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change_me_in_production_32chars';

const hashedPassword = generatePasswordHash(process.env.SEED_USER_PASSWORD || 'ChangeMe123!');
const encryptedIqPassword = encryptIQPassword(
  process.env.SEED_IQ_PASSWORD || 'ChangeMeIQ123!',
  ENCRYPTION_KEY
);

const user = {
  id: 'user-001',
  email: process.env.SEED_USER_EMAIL || 'admin@example.com',
  password: hashedPassword,
  iqEmail: process.env.SEED_IQ_EMAIL || 'iqadmin@example.com',
  iqPassword: encryptedIqPassword,
  role: 'admin',
  createdAt: new Date().toISOString()
};

users.set(user.email, user);

module.exports = { users };