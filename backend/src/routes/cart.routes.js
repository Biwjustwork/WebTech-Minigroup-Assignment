const { Router } = require('express');
const {
  createCartItem,
  deleteCartItem,
  patchCartItem,
  readCart
} = require('../controllers/cart.controller');
const { optionalAuthenticateUser } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../middleware/asyncHandler');

const cartRoutes = Router();

cartRoutes.use(optionalAuthenticateUser);
cartRoutes.get('/', asyncHandler(readCart));
cartRoutes.post('/items', asyncHandler(createCartItem));
cartRoutes.patch('/items/:productId', asyncHandler(patchCartItem));
cartRoutes.delete('/items/:productId', asyncHandler(deleteCartItem));

module.exports = { cartRoutes };

