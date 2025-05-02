const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Networks, Transaction } = require('stellar-sdk');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SIGNER_SECRET;

app.post('/sign', async (req, res) => {
  try {
    const { xdr, network } = req.body;

    if (!xdr || !network) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos: xdr o network.' });
    }

    if (!SECRET || !SECRET.startsWith('S')) {
      return res.status(500).json({ error: 'Clave secreta no configurada correctamente en el entorno.' });
    }

    const tx = new Transaction(xdr, network === 'public' ? Networks.PUBLIC : Networks.TESTNET);
    tx.sign(require('stellar-sdk').Keypair.fromSecret(SECRET));

    return res.status(200).json({ xdr: tx.toXDR(), network });
  } catch (error) {
    console.error('❌ Error al firmar transacción:', error);
    return res.status(500).json({
      error: 'Internal server error',
      detail: error.message || error.stack
    });
  }
});

app.get('/', (req, res) => {
  res.send('✅ Servicio de firma de transacciones Stellar listo.');
});

app.listen(PORT, () => {
  console.log(`🚀 Servicio de firma corriendo en puerto ${PORT}`);
});
