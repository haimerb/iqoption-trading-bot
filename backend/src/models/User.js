'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  iqEmail: { type: String, default: null },
  iqPassword: { type: String, default: null },
  refreshToken: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true });

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.iqPassword;
  delete obj.refreshToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
