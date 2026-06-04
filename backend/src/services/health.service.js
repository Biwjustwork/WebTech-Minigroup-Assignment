const { config } = require('../config/env');
const { isSupabaseAdminConfigured, isSupabaseConfigured } = require('../config/supabase');

function getHealthStatus() {
  return {
    status: 'ok',
    service: 'smart-niche-marketplace-backend',
    environment: config.nodeEnv,
    supabase: {
      configured: isSupabaseConfigured(),
      adminConfigured: isSupabaseAdminConfigured(),
      url: config.supabaseUrl || null
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = { getHealthStatus };


