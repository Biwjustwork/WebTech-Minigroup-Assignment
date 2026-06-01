const { config } = require('../config/env');

function getHealthStatus() {
  return {
    status: 'ok',
    service: 'smart-niche-marketplace-backend',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  };
}

module.exports = { getHealthStatus };

