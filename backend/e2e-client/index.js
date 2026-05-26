'use strict';

const axios = require('axios');
const { io } = require('socket.io-client');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL || 'hbarbetti.ing@icloud.com';
const PASSWORD = process.env.E2E_PASSWORD || 'DeporvidaCdc1*';

(async () => {
  try {
    console.log('E2E: Iniciando login...');
    const r = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, { email: EMAIL, password: PASSWORD }, { timeout: 10000 });
    const token = r.data?.data?.token;
    if (!token) {
      console.error('E2E: No se recibió token en la respuesta:', r.data);
      process.exit(2);
    }
    console.log('E2E: Token obtenido, conectando Socket.IO...');

    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false
    });

    socket.on('connect', () => {
      console.log('E2E: Socket conectado', socket.id);
      socket.emit('get:status');
    });

    socket.on('bot:status', (data) => {
      console.log('E2E: evento bot:status recibido:');
      console.log(JSON.stringify(data, null, 2));
      socket.disconnect();
      process.exit(0);
    });

    socket.on('connect_error', (err) => {
      console.error('E2E: connect_error:', err.message || err);
      process.exit(3);
    });

    socket.on('error', (err) => {
      console.error('E2E: socket error:', err);
    });

    // Timeout por si no llega la respuesta
    setTimeout(() => {
      console.error('E2E: Timeout esperando bot:status');
      process.exit(4);
    }, 15000);

  } catch (err) {
    console.error('E2E: Error', err.message || err);
    process.exit(5);
  }
})();
