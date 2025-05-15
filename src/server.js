require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Keypair, Transaction } = require('stellar-sdk');
const { decrypt } = require('./utils/encryption');

const app = express();
app.use(cors());
app.use(express.json());

// Health-check
app.get('/', (_req, res) => res.send('✅ signing-service OK'));

// Endpoint para firmar XDR
app.post('/firmar-transaccion', (req, res) => {
  try {
    const { xdr } = req.body;
    if (!xdr) {
      return res.status(400).json({ error: 'Falta campo xdr en body' });
    }

    // Desencripta tu key secret
    const secret = decrypt(process.env.SIGNER_SECRET_ENCRYPTED);
    const keypair = Keypair.fromSecret(secret);

    // Construye la transacción desde XDR
    const network = process.env.STELLAR_NETWORK === 'Public'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015';

    const tx = new Transaction(xdr, network);
    tx.sign(keypair);

    // Devuelve el XDR firmado
    return res.json({ signedXdr: tx.toXDR() });
  } catch (err) {
    console.error('Error firmando XDR:', err);
    return res.status(500).json({ error: 'Error interno al firmar transacción' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 signing-service listening on http://localhost:${PORT}`);
});