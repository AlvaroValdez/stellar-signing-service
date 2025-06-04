// start.js
const app = require('./src/index');
const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`🚀 servidor corriendo en http://localhost:${PORT}`);
});
