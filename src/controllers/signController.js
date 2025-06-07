const { Keypair, Networks, TransactionBuilder, Operation, Transaction } = require('stellar-sdk');

const SECRET_SEED = process.env.SIGNING_SEED;
const { NETWORK } = require('../config');

if (!SECRET_SEED) throw new Error('SIGNING_SEED no definido en el entorno');
if (!NETWORK) throw new Error('NETWORK no definido en el entorno');

const keypair = Keypair.fromSecret(SECRET_SEED);

/**
 * Recibe { xdr } en el body y devuelve { signedXdr }
 */
async function signXdr(req, res, next) {
  try {
    const { xdr } = req.body;
    if (!xdr) {
      const err = new Error('xdr es obligatorio');
      err.status = 400;
      throw err;
    }

    // Reconstruir la transacción
    const tx = TransactionBuilder.fromXDR(
      xdr,
      NETWORK === 'testnet' ? Networks.TESTNET : Networks.PUBLIC
    );

    // Firmar la transacción
    tx.sign(keypair);

    console.log('[SignService] XDR firmado exitosamente');
    return res.json({ signedXdr: tx.toXDR() });
  } catch (err) {
    console.error('[SignService] Error en signXdr:', err.message || err);
    return next(err);
  }
}

module.exports = { signXdr };