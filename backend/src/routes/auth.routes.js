const { Router } = require('express');
const {
  login,
  register,
  verifySession
} = require('../controllers/auth.controller');
const { authenticateUser } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/asyncHandler');

const authRoutes = Router();

authRoutes.post('/register', asyncHandler(register));
authRoutes.post('/login', asyncHandler(login));
authRoutes.get('/verify-session', authenticateUser, asyncHandler(verifySession));

module.exports = { authRoutes };

