const fs = require('fs');
const path = require('path');
const { config } = require('./env');

const backendRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(backendRoot, '..');
const envExamplePath = path.join(backendRoot, '.env.example');
const gitignorePath = path.join(repoRoot, '.gitignore');
const weakJwtSecrets = new Set([
  'dev-only-secret',
  'replace-with-a-long-random-secret',
  'secret',
  'password'
]);

function hasGitignorePattern(content, pattern) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(pattern);
}

function auditEnvironment() {
  const checks = [];
  const envExampleExists = fs.existsSync(envExamplePath);
  const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';

  checks.push({
    name: 'env-example-exists',
    ok: envExampleExists,
    message: '.env.example is present for zero-config setup.'
  });

  checks.push({
    name: 'gitignore-env',
    ok: hasGitignorePattern(gitignoreContent, '.env'),
    message: '.env is excluded from Git.'
  });

  checks.push({
    name: 'gitignore-database',
    ok: hasGitignorePattern(gitignoreContent, 'backend/data/*.sqlite'),
    message: 'local SQLite database files are excluded from Git.'
  });

  checks.push({
    name: 'port-valid',
    ok: Number.isInteger(config.port) && config.port > 0 && config.port < 65536,
    message: 'PORT is a valid TCP port.'
  });

  checks.push({
    name: 'database-url-present',
    ok: Boolean(config.databaseUrl),
    message: 'DATABASE_URL is configured.'
  });

  checks.push({
    name: 'jwt-secret-present',
    ok: Boolean(config.jwtSecret),
    message: 'JWT_SECRET is configured.'
  });

  checks.push({
    name: 'jwt-secret-strength',
    ok: config.nodeEnv !== 'production' || (config.jwtSecret.length >= 32 && !weakJwtSecrets.has(config.jwtSecret)),
    message: 'Production JWT_SECRET must be at least 32 chars and not a placeholder.'
  });

  checks.push({
    name: 'node-env-known',
    ok: ['development', 'test', 'production'].includes(config.nodeEnv),
    message: 'NODE_ENV is one of development, test, or production.'
  });

  return {
    ok: checks.every((check) => check.ok),
    environment: config.nodeEnv,
    checks
  };
}

module.exports = { auditEnvironment };

