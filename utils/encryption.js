// utils/encryption.js
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const key = crypto.createHash('sha256')
  .update(String(process.env.MASTER_SECRET_KEY))
  .digest('base64')
  .substr(0, 32);

function decrypt(data) {
  const [ivHex, encHex] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { decrypt };