// src/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { signXdr } = require('./controllers/signController');
const { NETWORK } = require('./config');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Health check
app.get('/health', (req, res) => {
  console.log('[SignService] GET /health');
  res.json({ status: 'ok', network: NETWORK });
});

// Endpoint para firma de XDR
app.post('/sign', signXdr);

// Catch-all 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// Manejador genérico de errores
app.use((err, _req, res, _next) => {
  console.error('[SignService] Error no manejado:', err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Stellar Signing Service corriendo en puerto ${PORT} (network: ${NETWORK})`);
});