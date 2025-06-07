require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { signXdr } = require('./controllers/signController');
const { NETWORK } = require('./config');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(bodyParser.json());

// Health check (antes de todo)
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

app.listen(PORT, () => {
  console.log(`🚀 Stellar Signing Service corriendo en puerto ${PORT} (network: ${NETWORK})`);
});

// 3) src/controllers/signController.js: Validación y logging
const { Keypair, Networks, TransactionBuilder, Operation, Transaction } = require('stellar-sdk');

const SECRET_SEED = process.env.SIGNING_SEED;
const NETWORK = process.env.NETWORK;

if (!SECRET_SEED) throw new Error('SIGNING_SEED no definido en el entorno');
if (!NETWORK) throw new Error('NETWORK no definido en el entorno');

const keypair = Keypair.fromSecret(SECRET_SEED);

/**
 * Recibe { xdr } y devuelve { signedXdr }
 */
async function signXdr(req, res, next) {
  try {
    const { xdr } = req.body;
    if (!xdr) {
      const err = new Error('xdr es obligatorio');
      err.status = 400;
      throw err;
    }

    // Reconstruir y firmar transacción
    const tx = TransactionBuilder.fromXDR(
      xdr,
      NETWORK === 'testnet' ? Networks.TESTNET : Networks.PUBLIC
    );
    tx.sign(keypair);

    console.log('[SignService] XDR firmado exitosamente');
    return res.json({ signedXdr: tx.toXDR() });
  } catch (err) {
    console.error('[SignService] Error en signXdr:', err.message || err);
    return next(err);
  }
}

module.exports = { signXdr };