// src/middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Middleware para verificar JWT en header Authorization: Bearer <token>.
 * Si el token es válido, inyecta req.userId = payload.userId;
 * Responde 401 si falta header o formato inválido.
 * Responde 403 si el token es inválido o expiró.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado: falta header Authorization.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Formato de token inválido.' });
  }

  const token = parts[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
    req.userId = payload.userId;
    next();
  });
}

module.exports = { verifyToken };
