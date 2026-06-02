const {
  loginUser,
  registerUser
} = require('../services/auth.service');

async function register(req, res) {
  const user = await registerUser(req.body);
  res.status(201).json({ data: user });
}

async function login(req, res) {
  const result = await loginUser(req.body);
  res.status(200).json(result);
}

async function verifySession(req, res) {
  res.status(200).json({
    data: {
      user: req.user
    }
  });
}

module.exports = {
  login,
  register,
  verifySession
};

