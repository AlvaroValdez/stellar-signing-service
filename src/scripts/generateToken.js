// src/scripts/generateToken.js
require('dotenv').config();   // <-- Carga las variables de .env
const jwt = require('jsonwebtoken');

// Asegúrate de que JWT_SECRET esté definido en tu .env
// Por ejemplo: JWT_SECRET=secretodeejemplo

const token = jwt.sign(
  { userId: 1 }, 
  process.env.JWT_SECRET, 
  { expiresIn: '1h' }
);
console.log(token);
