const { createClient } = require('@supabase/supabase-js');
const { config } = require('./env');

let supabaseClient;
let supabaseAdminClient;

function hasRealValue(value) {
  return Boolean(value && !String(value).startsWith('replace-with-'));
}

function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && hasRealValue(config.supabaseAnonKey));
}

function isSupabaseAdminConfigured() {
  return Boolean(config.supabaseUrl && hasRealValue(config.supabaseServiceRoleKey));
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

function getSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error('Supabase admin is not configured. Set SUPABASE_SERVICE_ROLE_KEY in backend/.env.');
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return supabaseAdminClient;
}

module.exports = {
  getSupabaseAdminClient,
  getSupabaseClient,
  isSupabaseAdminConfigured,
  isSupabaseConfigured
};
