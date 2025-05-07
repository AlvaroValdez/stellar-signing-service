// server.js
require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { Keypair } = require('stellar-sdk');
const { decrypt } = require('./utils/encryption');

const app = express();
app.use(express.json());
const prisma = new PrismaClient();

/**
 * POST /sign
 * Recibe { userId, xdr } y devuelve { signed_xdr }
 */
app.post('/sign', async (req, res) => {
  try {
    const { userId, xdr } = req.body;
    // 1. Busca el registro de la wallet cifrada
    const record = await prisma.wallets.findFirst({
      where: { user_id: userId },
      select: { encrypted_secret: true }
    });
    if (!record) {
      return res.status(404).json({ error: 'Wallet no encontrada para firmar.' });
    }
    // 2. Descifra el secretKey
    const secretKey = decrypt(record.encrypted_secret);
    // 3. Firma el XDR
    const keypair = Keypair.fromSecret(secretKey);
    const tx = keypair.sign(Buffer.from(xdr, 'base64')); 
    // Nota: asegúrate de usar el método correcto según tu versión de SDK
    // 4. Retorna el XDR firmado (base64)
    res.json({ signed_xdr: tx.toString('base64') });
  } catch (error) {
    console.error('Error en /sign:', error);
    res.status(500).json({ error: 'Error interno del servidor en firma.' });
  }
});

// Inicia servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Stellar Signing Service corriendo en puerto ${PORT}`);});