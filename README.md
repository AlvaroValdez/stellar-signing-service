Documentación Completa: stellar-signing-service
===========================================
Configuración de variables de entorno
-------------------------------------------
Copia (o renombra) el archivo `.env.example` a `.env` y completa los valores según tu entorno:
PORT=3002
DATABASE_URL="mysql://root:password@localhost:3306/stellar_db"
ENCRYPTION_KEY=000102030405060708090a0b0c0d0e0f
ENCRYPTION_IV=0f0e0d0c0b0a09080706050403020100
NETWORK_TYPE=testnet
NETWORK_PASSPHRASE_TESTNET="Test SDF Network ; September 2015"
NETWORK_PASSPHRASE_PUBLIC="Public Global Stellar Network ; September 2015"
JWT_SECRET=una_clave_muy_segura
-------------------------------------------
Descripción de endpoints
-------------------------------------------
1. GET /health
- Propósito: Comprobar que el servicio está levantado y en buen estado.
- Respuesta esperada:
 { "ok": true }
- Código HTTP: 200 OK
2. POST /sign
- URL: /sign
- Método: POST
- Headers:
 - Content-Type: application/json
 - Authorization: Bearer <TOKEN_JWT>
- Body:
 {
 "xdr": "<XDR_BASE64_SIN_FIRMAR>"
 }
- Descripción:
 Recibe un XDR de transacción sin firmar (en base64), lo convierte a objeto Transaction en JavaScript usan- Respuesta exitosa (HTTP 200):
 {
 "signedXdr": "<XDR_BASE64_FIRMADO>"
 }
- Códigos de error principales:
 400: "Falta campo obligatorio: xdr."
 401: "No autorizado: falta header Authorization."
 403: "Token inválido o expirado."
 404: "Usuario no encontrado"
 422: "Clave secreta inválida" / "XDR inválido o passphrase incorrecta" / "Error al firmar: clave secreta invál 500: "Error interno firmando XDR"
-------------------------------------------
Ejemplos de uso con cURL
-------------------------------------------
Healthcheck:
curl -i http://<TU_DOMAIN>/health
Invocar /sign (éxito):
curl -i -X POST http://<TU_DOMAIN>/sign -H "Content-Type: application/json" -H "Authorization: Bearer <Error 400 (falta xdr):
curl -i -X POST http://<TU_DOMAIN>/sign -H "Content-Type: application/json" -H "Authorization: Bearer <Error 401 (sin token):
curl -i -X POST http://<TU_DOMAIN>/sign -H "Content-Type: application/json" -d "{"xdr":"AAA"}"
Error 403 (token inválido):
curl -i -X POST http://<TU_DOMAIN>/sign -H "Content-Type: application/json" -H "Authorization: Bearer toError 422 (XDR de red incorrecta):
curl -i -X POST http://<TU_DOMAIN>/sign -H "Content-Type: application/json" -H "Authorization: Bearer <-------------------------------------------
Tabla de auditoría: SigningLog
-------------------------------------------
Cada vez que se invoque /sign, exitosamente o no, se inserta un registro en SigningLog.
Columnas:
id (INT PK AUTO_INCREMENT)
userId (INT FK → User.id)
xdrUnsigned (TEXT)
xdrSigned (TEXT, nullable)
createdAt (DATETIME DEFAULT CURRENT_TIMESTAMP)
success (BOOLEAN)
errorMessage (TEXT, nullable)
Ejemplo de consulta:
SELECT * FROM SigningLog ORDER BY createdAt DESC LIMIT 10;
-------------------------------------------
Integración desde remesas-api
-------------------------------------------
Flujo completo en remesas-api:
1. Autenticación del usuario → JWT.
2. Generar XDR en stellar-xdr-service → XDR sin firmar.
3. Llamar a /sign:
 const response = await axios.post(
 'https://<SIGNING_SERVICE_URL>/sign',
 { xdr: xdrUnsigned },
 { headers: { Authorization: `Bearer ${jwtToken}` } }
 );
 const signedXdr = response.data.signedXdr;
4. Enviar transacción a Horizon:
 const result = await server.submitTransaction(signedXdr);
-------------------------------------------
Errores comunes y solución
-------------------------------------------
400: falta xdr → verificar body.
401: falta Authorization → incluir header.
403: token inválido/expirado → generar nuevo token.
404: usuario no existe → verificar userId en BD.
422: clave inválida → revisar ENCRYPTION_KEY/IV y secretKeyEncrypted.
422: XDR inválido → verificar red y passphrases.
422: error al firmar → clave secreta malformada o con checksum incorrecto.
500: error interno → revisar logs y conexión a BD.
-------------------------------------------
Recomendaciones de mantenimiento
-------------------------------------------
Rotación de claves:
1. Desencriptar secretKeys con clave antigua.
2. Re-encriptar con nueva clave/IV.
3. Actualizar registros en BD.
Monitoreo y alertas:
- Integrar Sentry, Papertrail, etc.
- Métricas: firmas diarias, latencia /sign, tasa de errores.
Rate limit:
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
 windowMs: 1000,
 max: 5,
 message: { error: 'Exceso de peticiones, intenta nuevamente más tarde.' }
});
app.use('/sign', limiter);