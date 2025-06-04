// src/index.js
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: envFile });

const express       = require('express');
const CryptoJS      = require('crypto-js');
const jwt           = require('jsonwebtoken');
const { Keypair, TransactionBuilder, Networks } = require('stellar-sdk');
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('./middleware/auth');

const app    = express();
const prisma = new PrismaClient();
app.use(express.json());

/**
 * POST /sign
 * - Header: Authorization: Bearer <JWT>
 * - Body: { xdr: "<base64_sin_firmar>" }
 */
app.post('/sign', verifyToken, async (req, res) => {
  const { xdr } = req.body;
  const userId   = req.userId;

  // 1) Validar que venga el campo xdr
  if (!xdr) {
    return res.status(400).json({ error: 'Falta campo obligatorio: xdr.' });
  }

  let signedXdr = null;
  let success   = false;
  let errorMsg  = null;

  try {
    // 2) Recuperar clave cifrada del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { secretKeyEncrypted: true }
    });
    if (!user) {
      errorMsg = 'Usuario no encontrado';
      return res.status(404).json({ error: errorMsg });
    }

    // 3) Desencriptar la clave secreta
    const key       = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_KEY);
    const iv        = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_IV);
    const bytes     = CryptoJS.AES.decrypt(user.secretKeyEncrypted, key, { iv });
    const secretKey = bytes.toString(CryptoJS.enc.Utf8);

    // Validar formato de la clave secreta
    if (!secretKey || typeof secretKey !== 'string' || !secretKey.startsWith('S') || secretKey.length !== 56) {
      errorMsg = 'Clave secreta inválida';
      return res.status(422).json({ error: errorMsg });
    }

    // 4) Decodificar el XDR
    let tx;
    try {
      const passphrase = process.env.NETWORK_TYPE === 'public'
        ? process.env.NETWORK_PASSPHRASE_PUBLIC
        : process.env.NETWORK_PASSPHRASE_TESTNET;
      tx = TransactionBuilder.fromXDR(xdr, passphrase);
    } catch (e) {
      errorMsg = 'XDR inválido o passphrase incorrecta';
      return res.status(422).json({ error: errorMsg });
    }

    // 5) Firmar la transacción
    try {
      tx.sign(Keypair.fromSecret(secretKey));
    } catch (e) {
      errorMsg = 'Error al firmar: clave secreta inválida';
      return res.status(422).json({ error: errorMsg });
    }

    signedXdr = tx.toXDR();
    success   = true;
    return res.json({ signedXdr });

  } catch (e) {
    console.error('sign error:', e);
    errorMsg = 'Error interno firmando XDR';
    return res.status(500).json({ error: errorMsg });

  } finally {
    // 6) Registrar en SigningLog (éxito o fallo)
    try {
      await prisma.signingLog.create({
        data: {
          userId,
          xdrUnsigned: xdr,
          xdrSigned: signedXdr,
          success,
          errorMessage: errorMsg
        }
      });
    } catch (logErr) {
      console.error('Error al registrar SigningLog:', logErr);
    }
  }
});

// Healthcheck opcional
app.get('/health', (_req, res) => {
  res.send({ ok: true });
});

// ------------------------------------------------------------
// Manejo de cierre ordenado de Prisma al recibir señales
process.on('SIGINT', async () => {
  console.log('\nSIGINT recibido: desconectando Prisma...');
  try {
    await prisma.$disconnect();
    console.log('Desconexión de Prisma completada. Saliendo.');
    process.exit(0);
  } catch (e) {
    console.error('Error al desconectar Prisma en SIGINT:', e);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\nSIGTERM recibido: desconectando Prisma...');
  try {
    await prisma.$disconnect();
    console.log('Desconexión de Prisma completada. Saliendo.');
    process.exit(0);
  } catch (e) {
    console.error('Error al desconectar Prisma en SIGTERM:', e);
    process.exit(1);
  }
});
// ------------------------------------------------------------

module.exports = app;
