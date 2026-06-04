const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSupabaseAdminClient } = require('../config/supabase');
const { config } = require('../config/env');
const { createHttpError } = require('../utils/httpError');
const { throwIfSupabaseError } = require('../utils/supabaseError');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenExpiry = '2h';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeUser(row) {
  return {
    id: row.user_id,
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    is_logged_in: Boolean(row.is_logged_in),
    last_login: row.last_login,
    created_at: row.created_at
  };
}

function validateRegistrationPayload(payload) {
  const username = String(payload.username || '').trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');

  if (username.length < 3) {
    throw createHttpError(400, 'INVALID_REGISTRATION', 'username must be at least 3 characters.');
  }

  if (!emailPattern.test(email)) {
    throw createHttpError(400, 'INVALID_REGISTRATION', 'email must be valid.');
  }

  if (password.length < 6) {
    throw createHttpError(400, 'INVALID_REGISTRATION', 'password must be at least 6 characters.');
  }

  return { email, password, username };
}

function validateLoginPayload(payload) {
  const identifier = String(payload.email || payload.username || payload.identifier || '').trim();
  const password = String(payload.password || '');

  if (!identifier || !password) {
    throw createHttpError(400, 'INVALID_LOGIN', 'email/username and password are required.');
  }

  return { identifier, password };
}

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.user_id,
      username: user.username,
      email: user.email
    },
    config.jwtSecret,
    { expiresIn: tokenExpiry }
  );
}

async function findUserByEmail(email) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('user_id,username,email,password_hash,is_logged_in,token,last_login,created_at')
    .eq('email', email)
    .maybeSingle();

  throwIfSupabaseError(error);
  return data || undefined;
}

async function findUserByIdentifier(identifier) {
  const normalizedIdentifier = normalizeEmail(identifier);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('user_id,username,email,password_hash,is_logged_in,token,last_login,created_at')
    .or(`email.eq.${normalizedIdentifier},username.eq.${identifier}`)
    .maybeSingle();

  throwIfSupabaseError(error);
  return data || undefined;
}

async function registerUser(payload) {
  const { email, password, username } = validateRegistrationPayload(payload);
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw createHttpError(409, 'EMAIL_ALREADY_EXISTS', 'email is already registered.');
  }

  const userId = `user_${randomUUID()}`;
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .insert({
      user_id: userId,
      username,
      email,
      password_hash: passwordHash,
      is_logged_in: false,
      token: null,
      last_login: null,
      created_at: now,
      updated_at: now
    })
    .select('user_id,username,email,is_logged_in,last_login,created_at')
    .single();

  if (error?.code === '23505') {
    throw createHttpError(409, 'EMAIL_ALREADY_EXISTS', 'email is already registered.');
  }

  throwIfSupabaseError(error);
  return sanitizeUser(data);
}

async function loginUser(payload) {
  const { identifier, password } = validateLoginPayload(payload);
  const user = await findUserByIdentifier(identifier);
  const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !passwordMatches) {
    throw createHttpError(401, 'INVALID_CREDENTIALS', 'email/username or password is incorrect.');
  }

  const token = signAuthToken(user);
  const lastLogin = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('users')
    .update({
      is_logged_in: true,
      token,
      last_login: lastLogin,
      updated_at: lastLogin
    })
    .eq('user_id', user.user_id);

  throwIfSupabaseError(error);

  return {
    token,
    token_type: 'Bearer',
    expires_in: tokenExpiry,
    user: {
      ...sanitizeUser(user),
      is_logged_in: true,
      last_login: lastLogin
    }
  };
}

module.exports = {
  findUserByEmail,
  findUserByIdentifier,
  loginUser,
  registerUser,
  sanitizeUser
};

