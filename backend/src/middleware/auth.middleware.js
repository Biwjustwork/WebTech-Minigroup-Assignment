const jwt = require('jsonwebtoken');
const {
  closeDatabase,
  get,
  openDatabase
} = require('../database/connection');
const { config } = require('../config/env');
const { createHttpError } = require('../utils/httpError');
const { sanitizeUser } = require('../services/auth.service');

function readBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

async function resolveUserFromToken(token) {
  let payload;

  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (error) {
    throw createHttpError(401, 'INVALID_TOKEN', 'session token is invalid or expired.');
  }

  const db = await openDatabase();

  try {
    const user = await get(
      db,
      `
        SELECT
          user_id,
          username,
          email,
          is_logged_in,
          token,
          last_login,
          created_at
        FROM users
        WHERE user_id = ?
      `,
      [payload.sub]
    );

    if (!user || user.token !== token || Number(user.is_logged_in) !== 1) {
      throw createHttpError(401, 'SESSION_NOT_FOUND', 'session is no longer active.');
    }

    return sanitizeUser(user);
  } finally {
    await closeDatabase(db);
  }
}

async function authenticateUser(req, res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) {
      throw createHttpError(401, 'MISSING_TOKEN', 'authorization bearer token is required.');
    }

    req.user = await resolveUserFromToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

async function optionalAuthenticateUser(req, res, next) {
  try {
    const token = readBearerToken(req);

    if (token) {
      req.user = await resolveUserFromToken(token);
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticateUser,
  optionalAuthenticateUser,
  readBearerToken,
  resolveUserFromToken
};

