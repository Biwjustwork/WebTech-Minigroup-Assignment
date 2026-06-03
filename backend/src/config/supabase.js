const { createClient } = require('@supabase/supabase-js');
const { config } = require('./env');

let supabaseClient;

function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  if (!supabaseClient) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return supabaseClient;
}

module.exports = {
  getSupabaseClient,
  isSupabaseConfigured
};
