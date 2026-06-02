const { Router } = require('express');
const { checkout } = require('../controllers/checkout.controller');
const { optionalAuthenticateUser } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/asyncHandler');

const checkoutRoutes = Router();

checkoutRoutes.post('/', optionalAuthenticateUser, asyncHandler(checkout));

module.exports = { checkoutRoutes };

