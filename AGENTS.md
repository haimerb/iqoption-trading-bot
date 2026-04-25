# Agent Guidelines for IQ Option Trading Bot

## Project Overview
Full-stack trading bot for IQ Option with Node.js/Express backend, React frontend, MongoDB, Redis, and real-time WebSocket via Socket.IO.

## Build Commands

### Backend (`backend/`)
```bash
cd backend
yarn install             # Install dependencies
yarn dev                # Start with hot-reload
yarn start              # Production start
yarn lint               # Lint source files

# Testing
yarn test               # All tests with coverage
yarn test:unit         # Unit tests only
yarn test:integration  # Integration tests only
yarn test:api          # API tests only
yarn test --coverage --verbose  # Detailed coverage

# Single test
yarn test tests/unit/strategies.test.js
yarn test tests/unit/strategies.test.js --testNamePattern="RSI"
```

### Frontend (`frontend/`)
```bash
cd frontend
yarn install
yarn dev                # Dev server (port 5173)
yarn build              # Production build
yarn preview            # Preview build
yarn lint
```

### Docker
```bash
docker compose up -d    # Start all services
docker compose down     # Stop all services
```

## Code Style Guidelines

### Backend (Node.js/Express)

**File Structure & Imports:**
```javascript
'use strict';
const express = require('express');
const { validationResult } = require('express-validator');
const logger = require('../modules/logger/logger');
```
- Always use `'use strict';` at the top
- Use CommonJS `require()` not ES modules
- Group imports: built-ins, external, internal modules

**Naming Conventions:**
- Files: `kebab-case.js` (e.g., `auth.controller.js`)
- Classes: `PascalCase` (e.g., `RiskManagementModule`)
- Functions/variables: `camelCase` (e.g., `calculatePositionSize`)
- Constants: `UPPER_SNAKE_CASE`
- Routes: lowercase with hyphens (`/api/v1/auth/login`)

**Controller Pattern:**
```javascript
async function getOrders(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, details: errors.array() });
    }
    const result = await someAsyncOperation();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
```

**Error Handling:**
```javascript
const { createError } = require('../middlewares/errorHandler');
throw createError('Message', 400, 'ERROR_CODE');
```

### Frontend (React)

**File Structure:**
- Components: `PascalCase.jsx` (e.g., `LoginPage.jsx`)
- Hooks/stores: `camelCase.js` (e.g., `useAuth.js`, `useBotStore.js`)

**Imports and Patterns:**
```javascript
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { useAuthStore } from '@/store';

// Default export for pages
export default function DashboardPage() {
  const { user } = useAuthStore();
  useEffect(() => { return () => {}; }, [dep]);
  return <Box>Content</Box>;
}

// Zustand store
export const useBotStore = create((set, get) => ({
  isConnected: false,
  setConnectionStatus: (isConnected) => set({ isConnected }),
}));
```

**API Response Format:**
```javascript
// Success
res.json({ success: true, data: result });
// Error
res.status(400).json({ success: false, error: 'Message', code: 'ERROR_CODE' });
```

### Testing Patterns (Jest)
```javascript
const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('Strategy', () => {
  let strategy;
  beforeEach(() => { strategy = new MyStrategy(config); });
  
  it('should emit signal on oversold RSI', async () => {
    const signal = strategy.analyze(candles, price);
    expect(signal.direction).toBe('call');
  });
});
```

## Project Architecture

### Backend Flow
```
Request → Middleware → Controller → Module → Response
                                   ↓
                         WebSocket/Socket.IO
```

### Key Modules
- `modules/connection/` - IQ Option WebSocket
- `modules/market-data/` - Price/candle caching
- `modules/order-execution/` - Order operations
- `modules/risk-management/` - RiskModule singleton
- `modules/strategies/` - Extends BaseStrategy
- `modules/queue/` - Bull job workers

### Environment Variables
Create `backend/.env` from `.env.example`:
- `IQOPTION_EMAIL`, `IQOPTION_PASSWORD`
- `JWT_SECRET` (32+ chars)
- `ENCRYPTION_KEY`
- `MONGODB_URI`, `REDIS_HOST`

## WebSocket Events

**Server → Client:**
- `market:price`, `market:candle`
- `strategy:signal`
- `order:opened`, `order:closed`
- `bot:status`

**Client → Server:**
- `subscribe:asset`, `get:status`