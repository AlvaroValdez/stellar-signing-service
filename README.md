## Endpoint `/sign`

- **URL**: `POST /sign`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT válido>`
- **Body**:

  {
    "xdr": "<XDR_BASE64_SIN_FIRMAR>"
  }
Respuesta exitosa (200):
{
  "signedXdr": "<XDR_BASE64_FIRMADO>"
}
Códigos de error:

400 Bad Request: Falta el campo xdr en el body.
401 Unauthorized: Falta header Authorization o formato de token inválido.
403 Forbidden: El JWT es inválido o expiró.
404 Not Found: El userId (del JWT) no corresponde a ningún usuario en la base de datos.
422 Unprocessable Entity: El XDR no es válido para la red configurada, o la clave secreta desencriptada no es válida.
500 Internal Server Error: Error inesperado en el servidor.