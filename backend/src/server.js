const { app } = require('./app');
const { config } = require('./config/env');

// server.js is intentionally tiny. Keeping HTTP startup separate from app.js lets
// tests import the Express app without opening a real port.
app.listen(config.port, () => {
  console.log(`Backend API listening on http://localhost:${config.port}`);
});
