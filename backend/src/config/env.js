const path = require('path');
const dotenv = require('dotenv');

// Load backend/.env explicitly. This supports the "Zero-Config" requirement:
// copy .env.example to .env, then npm install/start should be enough.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Centralizing environment variables prevents hard-coded secrets from spreading
// through the codebase. Later modules should import config instead of reading
// process.env directly.
const config = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  databaseUrl: process.env.DATABASE_URL || './data/app.sqlite',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

module.exports = { config };
