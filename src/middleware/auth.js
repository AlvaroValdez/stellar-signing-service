// src/middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { SECRET_JWT } = process.env;

if (!SECRET_JWT) {
  throw new Error('SECRET_JWT no definido');
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, SECRET_JWT);
    // opcional: puedes pasar info del payload al req, e.g. req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = authenticate;