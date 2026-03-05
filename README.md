# IQ Option Trading Bot

Bot de trading automatizado completo para IQ Option, con backend Node.js/Express, WebSocket nativo, sistema de estrategias plug-and-play y frontend React.

---

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Requisitos](#requisitos)
- [Instalación rápida (Docker)](#instalación-rápida-docker)
- [Instalación manual](#instalación-manual)
- [Configuración](#configuración)
- [API REST](#api-rest)
- [Estrategias de trading](#estrategias-de-trading)
- [Frontend UI](#frontend-ui)
- [WebSocket en tiempo real](#websocket-en-tiempo-real)
- [Seguridad](#seguridad)
- [Testing](#testing)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Solución de problemas](#solución-de-problemas)

---

## Arquitectura



<img width="1408" height="768" alt="comp-bot" src="https://github.com/user-attachments/assets/60fab4b3-6b6d-4dcd-b535-9a248df7cf8c" />


### Flujo de una señal de trading

```
MarketData (candle) → StrategyManager → BaseStrategy.analyze()
  → signal (buy/sell) → RiskModule.validateOrder()
    → if approved → OrderExecution.openOrder()
      → IQOption WebSocket (buyV3)
        → position-changed event → recordOrderResult()
          → Socket.IO broadcast → Frontend update
```

---

## Requisitos

- **Node.js** 18+ 
- **MongoDB** 6+
- **Redis** 7+
- Cuenta en **IQ Option** (real o demo)
- (Opcional) **Docker** + **Docker Compose**

---

## Instalación rápida (Docker)

```bash
git clone <repo>
cd iqoption-trading-bot

# Copiar y editar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con tus credenciales de IQ Option

# Levantar todo con Docker Compose
docker compose up -d

# Acceder al frontend: http://localhost:5173
# Swagger UI:          http://localhost:3000/api-docs
```

---

## Instalación manual

### Backend

```bash
cd backend
yarn install
cp .env.example .env
# Editar .env con tus credenciales

# Desarrollo (hot-reload)
yarn dev

# Producción
yarn start
```

### Frontend

```bash
cd frontend
yarn install

# Desarrollo
yarn dev

# Build para producción
yarn build
yarn preview
```

---

## Configuración

Copia `backend/.env.example` a `backend/.env` y ajusta los valores:

### Variables críticas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `IQOPTION_EMAIL` | Email de tu cuenta IQ Option | `tu@email.com` |
| `IQOPTION_PASSWORD` | Contraseña de IQ Option | `tu_password` |
| `JWT_SECRET` | Secreto para firmar JWT (32+ chars) | `supersecret...` |
| `ENCRYPTION_KEY` | Clave AES para cifrar credenciales | `32chars...` |
| `MONGODB_URI` | Cadena de conexión MongoDB | `mongodb://localhost/iqbot` |
| `REDIS_HOST` | Host de Redis | `localhost` |

### Variables de riesgo

| Variable | Descripción | Default |
|---|---|---|
| `MAX_DAILY_LOSS` | Pérdida máxima diaria en $ | `100` |
| `MAX_ORDER_AMOUNT` | Monto máximo por orden | `50` |
| `MAX_CONSECUTIVE_LOSSES` | Para el bot tras N pérdidas seguidas | `5` |
| `MAX_ORDERS_PER_HOUR` | Límite de órdenes por hora | `20` |
| `COOLDOWN_AFTER_LOSS` | Segundos de espera tras pérdida | `60` |

---

## API REST

La documentación interactiva Swagger está disponible en `http://localhost:3000/api-docs`.

### Autenticación

Todos los endpoints (excepto `/auth/register` y `/auth/login`) requieren header:

```
Authorization: Bearer <access_token>
```

### Endpoints principales

#### Auth — `/api/v1/auth`

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/register` | Registrar usuario |
| `POST` | `/login` | Iniciar sesión + conectar IQ Option |
| `POST` | `/refresh` | Renovar access token |
| `POST` | `/logout` | Cerrar sesión |
| `GET` | `/status` | Estado de la sesión |

#### Account — `/api/v1/account`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/balance` | Balance de cuenta IQ Option |
| `GET` | `/profile` | Perfil del usuario |
| `GET` | `/risk-stats` | Estadísticas de riesgo del día |
| `PUT` | `/risk-config` | Actualizar configuración de riesgo |

#### Orders — `/api/v1/orders`

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/open` | Abrir orden (encolada) |
| `POST` | `/close/:positionId` | Cerrar posición |
| `GET` | `/open` | Posiciones abiertas |
| `GET` | `/history` | Historial de órdenes |
| `GET` | `/status` | Estado del módulo |

**Ejemplo — Abrir orden:**
```json
POST /api/v1/orders/open
{
  "activeId": 1,
  "symbol": "EURUSD",
  "direction": "call",
  "amount": 10,
  "duration": 60
}
```

#### Strategies — `/api/v1/strategies`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/available` | Estrategias disponibles en el sistema |
| `GET` | `/` | Estrategias creadas por el usuario |
| `POST` | `/` | Crear nueva estrategia |
| `POST` | `/:id/start` | Iniciar estrategia |
| `POST` | `/:id/pause` | Pausar estrategia |
| `POST` | `/:id/resume` | Reanudar estrategia |
| `DELETE` | `/:id` | Eliminar estrategia |
| `PATCH` | `/:id/params` | Actualizar parámetros |

**Ejemplo — Crear estrategia RSI:**
```json
POST /api/v1/strategies
{
  "name": "RSI EURUSD",
  "type": "rsi",
  "params": {
    "period": 14,
    "oversold": 30,
    "overbought": 70,
    "amount": 10,
    "duration": 60
  }
}
```

#### Market Data — `/api/v1/market-data`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/instruments` | Lista de instrumentos disponibles |
| `GET` | `/price/:activeId` | Precio actual |
| `GET` | `/candles/:activeId` | Velas históricas |
| `POST` | `/subscribe` | Suscribirse a actualizaciones |
| `POST` | `/unsubscribe` | Desuscribirse |

#### Bot — `/api/v1/bot`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/status` | Estado global del sistema |
| `POST` | `/emergency-stop` | Parada de emergencia |
| `GET` | `/health` | Health check |

---

## Estrategias de trading

El sistema implementa el patrón Strategy con una clase base abstracta.

### Estrategias incluidas

#### 1. MA Crossover (`ma-crossover`)
Detecta cruces de medias móviles:
- **Golden Cross** (EMA rápida cruza hacia arriba EMA lenta) → señal BUY
- **Death Cross** (EMA rápida cruza hacia abajo EMA lenta) → señal SELL

Parámetros:
```json
{
  "fastPeriod": 9,
  "slowPeriod": 21,
  "maType": "EMA",
  "amount": 10,
  "duration": 60
}
```

#### 2. RSI (`rsi`)
Detecta condiciones de sobrecompra/sobreventa:
- RSI sale de oversold (cruza hacia arriba) → señal BUY
- RSI sale de overbought (cruza hacia abajo) → señal SELL

Parámetros:
```json
{
  "period": 14,
  "oversold": 30,
  "overbought": 70,
  "amount": 10,
  "duration": 60
}
```

#### 3. Bollinger Bands (`bollinger-bands`)
Señales basadas en toques de bandas:
- Precio toca banda inferior → señal BUY
- Precio toca banda superior → señal SELL

Parámetros:
```json
{
  "period": 20,
  "stdDev": 2,
  "amount": 10,
  "duration": 60
}
```

#### 4. Grid Trading (`grid-trading`)
Crea una cuadrícula de niveles de precio:
- Precio alcanza nivel superior → señal SELL
- Precio alcanza nivel inferior → señal BUY

Parámetros:
```json
{
  "gridCount": 10,
  "gridSpacing": 0.001,
  "amount": 5,
  "duration": 60
}
```

### Crear una estrategia personalizada

```javascript
const BaseStrategy = require('./BaseStrategy')

class MyStrategy extends BaseStrategy {
  getDefaultParams() {
    return { myParam: 14, amount: 10, duration: 60 }
  }

  analyze(candles, currentPrice) {
    const rsi = this.calculateRSI(candles, this.params.myParam)
    if (!rsi) return

    if (rsi < 25) {
      this.emitBuySignal({ reason: 'RSI extremo oversold', confidence: 0.9 })
    }
  }
}

module.exports = MyStrategy
```

Registro en `StrategyManager.js`:
```javascript
this.registry.set('my-strategy', MyStrategy)
```

---

## Frontend UI

Interfaz completa en React con páginas:

| Página | Ruta | Descripción |
|---|---|---|
| Login | `/login` | Autenticación |
| Dashboard | `/` | Vista general: balance, PnL, estadísticas |
| Strategies | `/strategies` | Gestión de estrategias (CRUD + start/pause/stop) |
| Orders | `/orders` | Posiciones abiertas + abrir orden manual |
| History | `/history` | Historial de operaciones + estadísticas |
| Logs | `/logs` | Logs en tiempo real con filtros |
| Settings | `/settings` | Configuración de riesgo |

---

## WebSocket en tiempo real

El frontend se conecta via Socket.IO con autenticación JWT.

### Eventos del servidor → cliente

| Evento | Datos | Descripción |
|---|---|---|
| `market:price` | `{activeId, price, time}` | Actualización de precio |
| `market:candle` | `{activeId, size, candle}` | Nueva vela completada |
| `strategy:signal` | `{strategyId, signal, asset}` | Señal generada |
| `order:opened` | `{id, activeId, direction, amount}` | Orden abierta |
| `order:closed` | `{id, pnl, status}` | Orden cerrada |
| `bot:status` | `{connected, strategies, positions}` | Estado global |

### Eventos cliente → servidor

```javascript
// Suscribirse a un activo
socket.emit('subscribe:asset', { activeId: 1, size: 60 })

// Solicitar estado del bot
socket.emit('get:status')
```

---

## Seguridad

- **JWT**: Tokens de acceso (24h) + refresh tokens (7d)
- **AES encryption**: Las credenciales de IQ Option se almacenan cifradas
- **Rate limiting**: 100 req/15min general, 10/15min en auth, 20/min en órdenes
- **Helmet**: Headers de seguridad HTTP
- **CORS**: Configurado solo para el origen del frontend
- **bcrypt**: Contraseñas hasheadas con salt rounds = 12
- **express-validator**: Validación y sanitización de inputs

---

## Testing

```bash
cd backend

# Todos los tests
yarn test

# Solo tests unitarios
yarn test:unit

# Solo tests de integración
yarn test:integration

# Con informe de cobertura detallado
yarn test --coverage --verbose
```

### Estructura de tests

```
backend/tests/
├── unit/
│   ├── strategies.test.js   # BaseStrategy + 3 estrategias
│   └── riskModule.test.js   # RiskModule: validación y Kelly
├── integration/
│   ├── auth.test.js         # Registro, login, refresh, logout
│   └── orders.test.js       # Abrir, cerrar, listar órdenes
└── mocks/
    └── iqOptionMock.js      # Mock del WebSocket de IQ Option
```

---

## Estructura del proyecto

```
iqoption-trading-bot/
├── backend/
│   ├── src/
│   │   ├── app.js                      # Express app
│   │   ├── server.js                   # Bootstrap
│   │   ├── config/
│   │   │   ├── database.js             # MongoDB
│   │   │   ├── redis.js                # Redis
│   │   │   └── swagger.js              # Swagger/OpenAPI
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── account.controller.js
│   │   │   ├── order.controller.js
│   │   │   ├── strategy.controller.js
│   │   │   └── marketData.controller.js
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js      # JWT authenticate + authorize
│   │   │   ├── rateLimiter.js
│   │   │   ├── errorHandler.js
│   │   │   ├── notFoundHandler.js
│   │   │   └── requestLogger.js
│   │   ├── modules/
│   │   │   ├── connection/             # IQ Option WebSocket
│   │   │   ├── market-data/            # Caché de precios y velas
│   │   │   ├── order-execution/        # Apertura/cierre de órdenes
│   │   │   ├── risk-management/        # Validación de riesgo
│   │   │   ├── strategies/             # Motor de estrategias
│   │   │   ├── events/                 # Socket.IO manager
│   │   │   ├── queue/                  # Bull workers
│   │   │   └── logger/                 # Winston logger
│   │   └── routes/
│   │       ├── auth.routes.js
│   │       ├── account.routes.js
│   │       ├── order.routes.js
│   │       ├── strategy.routes.js
│   │       ├── marketData.routes.js
│   │       ├── history.routes.js
│   │       ├── instrument.routes.js
│   │       └── bot.routes.js
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── mocks/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/layout/
│   │   ├── pages/
│   │   ├── services/           # axios + socket.io client
│   │   ├── store/              # Zustand stores
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## Solución de problemas

### El bot no conecta a IQ Option
- Verifica que `IQOPTION_EMAIL` y `IQOPTION_PASSWORD` sean correctos
- IQ Option puede requerir verificación 2FA — deshabilítala temporalmente
- Comprueba que no haya firewall bloqueando `wss://iqoption.com`

### Error "Cannot find module 'bull'"
```bash
cd backend && yarn install
```

### MongoDB no conecta
```bash
# Con Docker:
docker compose up -d mongodb
# Manual: asegúrate de que mongod esté corriendo en el puerto 27017
```

### Redis no conecta
```bash
docker compose up -d redis
# o: redis-server (si está instalado localmente)
```

### Frontend no muestra datos en tiempo real
- Verifica que el backend esté corriendo en el puerto 3000
- Revisa la consola del navegador en busca de errores de CORS
- Comprueba que `VITE_API_URL` esté configurado correctamente

### Tests fallan con "Cannot connect to MongoDB"
Los tests de integración usan mocks completos y no requieren MongoDB real. Si fallan, comprueba que las dependencias estén instaladas:
```bash
cd backend && yarn install
```
