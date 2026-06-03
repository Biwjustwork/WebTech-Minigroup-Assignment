const { config } = require('../config/env');
const { isSupabaseConfigured } = require('../config/supabase');

function getHealthStatus() {
  return {
    status: 'ok',
    service: 'smart-niche-marketplace-backend',
    environment: config.nodeEnv,
    supabase: {
      configured: isSupabaseConfigured(),
      url: config.supabaseUrl || null
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = { getHealthStatus };

