// src/tests/sign.test.js
const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../index'); // Importa la app (sin arrancar el servidor)

// Mock de PrismaClient
jest.mock('@prisma/client', () => {
  const mUser = { findUnique: jest.fn() };
  const mSigningLog = { create: jest.fn() };
  const mPrisma = {
    user: mUser,
    signingLog: mSigningLog,
    $disconnect: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

describe('POST /sign', () => {
  let prisma;
  const validUserId = 1;

  // JWT válido para userId = 1
  const jwtToken = jwt.sign({ userId: validUserId }, process.env.JWT_SECRET, { expiresIn: '1h' });

  beforeAll(() => {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe rechazar sin Authorization (401)', async () => {
    const res = await request(app)
      .post('/sign')
      .send({ xdr: 'AAA' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'No autorizado: falta header Authorization.' });
  });

  it('debe rechazar con JWT inválido (403)', async () => {
    const res = await request(app)
      .post('/sign')
      .set('Authorization', 'Bearer token_invalido')
      .send({ xdr: 'AAA' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Token inválido o expirado.' });
  });

  it('debe devolver 400 si falta campo xdr', async () => {
    const res = await request(app)
      .post('/sign')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Falta campo obligatorio: xdr.' });
  });

  it('debe devolver 404 si user.findUnique devuelve null', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/sign')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ xdr: 'AAA' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: validUserId },
      select: { secretKeyEncrypted: true }
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Usuario no encontrado' });

    expect(prisma.signingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: validUserId,
          xdrUnsigned: 'AAA',
          xdrSigned: null,
          success: false,
          errorMessage: 'Usuario no encontrado'
        })
      })
    );
  });

  it('debe devolver 422 si secretKey desencriptada es inválida', async () => {
    const fakeUser = { secretKeyEncrypted: 'textoNoValido' };
    prisma.user.findUnique.mockResolvedValue(fakeUser);

    const res = await request(app)
      .post('/sign')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ xdr: 'base64_incorrecto' });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'Clave secreta inválida' });

    expect(prisma.signingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: validUserId,
          xdrUnsigned: 'base64_incorrecto',
          xdrSigned: null,
          success: false,
          errorMessage: 'Clave secreta inválida'
        })
      })
    );
  });

  it('debe devolver 422 si XDR no parsea para la red', async () => {
    // Simulamos un user con clave válida en formato 'S...'
    const realSecret = 'S' + 'A'.repeat(55);
    const CryptoJS = require('crypto-js');
    const key = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_KEY);
    const iv  = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_IV);
    const encrypted = CryptoJS.AES.encrypt(realSecret, key, { iv }).toString();
    prisma.user.findUnique.mockResolvedValue({ secretKeyEncrypted: encrypted });

    const res = await request(app)
      .post('/sign')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ xdr: 'XDR_INVALIDO' });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'XDR inválido o passphrase incorrecta' });

    expect(prisma.signingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: validUserId,
          xdrUnsigned: 'XDR_INVALIDO',
          xdrSigned: null,
          success: false,
          errorMessage: 'XDR inválido o passphrase incorrecta'
        })
      })
    );
  });

  it('debe devolver 422 si falla la firma (clave secreta no válida para Keypair)', async () => {
    // Clave de 56 caracteres pero no válida para Keypair
    const fakeSecret = 'S' + 'B'.repeat(55);
    const CryptoJS = require('crypto-js');
    const key = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_KEY);
    const iv  = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_IV);
    const encrypted = CryptoJS.AES.encrypt(fakeSecret, key, { iv }).toString();
    prisma.user.findUnique.mockResolvedValue({ secretKeyEncrypted: encrypted });

    // Intentamos firmar un XDR presumiblemente válido
    const res = await request(app)
      .post('/sign')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ xdr: 'XDR_VALIDO_PARA_TESTNET' });

    expect(res.status).toBe(422);
    expect(['XDR inválido o passphrase incorrecta', 'Error al firmar: clave secreta inválida']).toContain(res.body.error);

    expect(prisma.signingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: validUserId,
          xdrUnsigned: 'XDR_VALIDO_PARA_TESTNET',
          xdrSigned: null,
          success: false,
          errorMessage: expect.any(String)
        })
      })
    );
  });

  it('debe devolver 200 y XDR firmado cuando todo es válido', async () => {
    // En lugar de usar Horizon, creamos un XDR testnet localmente:
    const {
      Keypair,
      TransactionBuilder,
      Networks,
      Operation,
      Asset,
      Account
    } = require('stellar-sdk');

    // 1) Crear keypairs
    const sourceKeypair      = Keypair.random();
    const destinationKeypair = Keypair.random();

    // 2) Construir transacción local con sequence = "0"
    const fakeAccount = new Account(sourceKeypair.publicKey(), "0");
    const tx = new TransactionBuilder(fakeAccount, {
      fee: '100',
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(Operation.payment({
        destination: destinationKeypair.publicKey(),
        asset: Asset.native(),
        amount: '1'
      }))
      .setTimeout(30)
      .build();
    const xdrUnsigned = tx.toXDR();

    // 3) Cifrar la secretKey de sourceKeypair
    const realSecret = sourceKeypair.secret();
    const CryptoJS = require('crypto-js');
    const key = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_KEY);
    const iv  = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_IV);
    const encrypted = CryptoJS.AES.encrypt(realSecret, key, { iv }).toString();
    prisma.user.findUnique.mockResolvedValue({ secretKeyEncrypted: encrypted });

    // 4) Ejecutar petición real
    const res = await request(app)
      .post('/sign')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ xdr: xdrUnsigned });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('signedXdr');

    // 5) Verificar que el signedXdr sea parseable
    const signedTx = TransactionBuilder.fromXDR(res.body.signedXdr, Networks.TESTNET);
    expect(signedTx.signatures.length).toBeGreaterThan(0);

    // 6) Verificar que SigningLog se creó con éxito
    expect(prisma.signingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: validUserId,
          xdrUnsigned,
          xdrSigned: res.body.signedXdr,
          success: true,
          errorMessage: null
        })
      })
    );
  });
});