const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  closeDatabase,
  get,
  openDatabase,
  run
} = require('../database/connection');
const { config } = require('../config/env');
const { createHttpError } = require('../utils/httpError');

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

async function findUserByEmail(db, email) {
  return get(
    db,
    `
      SELECT
        user_id,
        username,
        email,
        password_hash,
        is_logged_in,
        token,
        last_login,
        created_at
      FROM users
      WHERE email = ?
    `,
    [email]
  );
}

async function findUserByIdentifier(db, identifier) {
  const normalizedIdentifier = normalizeEmail(identifier);

  return get(
    db,
    `
      SELECT
        user_id,
        username,
        email,
        password_hash,
        is_logged_in,
        token,
        last_login,
        created_at
      FROM users
      WHERE email = ? OR username = ?
    `,
    [normalizedIdentifier, identifier]
  );
}

async function registerUser(payload) {
  const { email, password, username } = validateRegistrationPayload(payload);
  const db = await openDatabase();

  try {
    const existingUser = await findUserByEmail(db, email);
    if (existingUser) {
      throw createHttpError(409, 'EMAIL_ALREADY_EXISTS', 'email is already registered.');
    }

    const userId = `user_${randomUUID()}`;
    const passwordHash = await bcrypt.hash(password, 12);
    const createdAt = new Date().toISOString();

    await run(
      db,
      `
        INSERT INTO users (
          user_id,
          username,
          email,
          password_hash,
          is_logged_in,
          token,
          last_login,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, 0, NULL, NULL, ?, datetime('now'))
      `,
      [userId, username, email, passwordHash, createdAt]
    );

    const createdUser = await findUserByEmail(db, email);
    return sanitizeUser(createdUser);
  } finally {
    await closeDatabase(db);
  }
}

async function loginUser(payload) {
  const { identifier, password } = validateLoginPayload(payload);
  const db = await openDatabase();

  try {
    const user = await findUserByIdentifier(db, identifier);
    const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !passwordMatches) {
      throw createHttpError(401, 'INVALID_CREDENTIALS', 'email/username or password is incorrect.');
    }

    const token = signAuthToken(user);
    const lastLogin = new Date().toISOString();

    await run(
      db,
      `
        UPDATE users
        SET
          is_logged_in = 1,
          token = ?,
          last_login = ?,
          updated_at = datetime('now')
        WHERE user_id = ?
      `,
      [token, lastLogin, user.user_id]
    );

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
  } finally {
    await closeDatabase(db);
  }
}

module.exports = {
  findUserByEmail,
  loginUser,
  registerUser,
  sanitizeUser
};

