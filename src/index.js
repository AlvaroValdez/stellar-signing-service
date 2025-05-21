require('dotenv').config();
const express       = require('express');
const CryptoJS      = require('crypto-js');
const { Keypair, TransactionBuilder, Networks, Server } = require('stellar-sdk');
const { PrismaClient } = require('@prisma/client');

const app     = express();
const prisma  = new PrismaClient();
app.use(express.json());

// Config
const PORT = process.env.PORT || 3002;

// Healthcheck (opcional)
app.get('/health', (req, res) => res.send({ ok: true }));

// POST /sign → { signedXdr }
app.post('/sign', async (req, res) => {
  try {
    const { xdr, userId } = req.body;
    if (!xdr || !userId) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }

    // 1) Recupera la secretKey cifrada del usuario en BD
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { encryptedSecret: true }
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // 2) Descifra la secretKey
    const key = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_KEY);
    const iv  = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_IV);
    const bytes = CryptoJS.AES.decrypt(user.encryptedSecret, key, { iv });
    const secretKey = bytes.toString(CryptoJS.enc.Utf8);

    // 3) Firma la transacción
    const tx = new TransactionBuilder.fromXDR(xdr, NETWORKS.TESTNET);
    tx.sign(Keypair.fromSecret(secretKey));

    // 4) Devuelve el XDR firmado
    const signedXdr = tx.toXDR();
    res.json({ signedXdr });

  } catch (error) {
    console.error('sign error:', error);
    res.status(500).json({ error: 'Error firmando XDR' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 stellar-signing-service corriendo en http://localhost:${PORT}`);
});