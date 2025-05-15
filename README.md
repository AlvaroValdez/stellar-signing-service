# stellar-signing-service

Micro-servicio para firmar transacciones Stellar (XDR).

## Setup

1. Copia `.env.example` a `.env` y completa variables:
   - `ENCRYPTION_KEY` y `ENCRYPTION_IV`: valores hex de tu llave de encriptación.
   - `SIGNER_SECRET_ENCRYPTED`: tu clave Stellar encriptada (hex).
2. `npm install`
3. `npm start`

## Endpoints

- `GET /`  
  Health-check.

- `POST /firmar-transaccion`  
  Body JSON: `{ "xdr": "<XDR base64>" }`  
  Response: `{ "signedXdr": "<XDR base64 firmado>" }`
