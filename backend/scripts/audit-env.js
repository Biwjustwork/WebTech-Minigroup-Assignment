const { auditEnvironment } = require('../src/config/auditEnv');

const result = auditEnvironment();

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exit(1);
}

