const {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem
} = require('../services/cart.service');

function getCartSessionId(req) {
  return req.get('x-cart-session-id') || req.body?.cartSessionId || req.query?.cartSessionId || null;
}

async function readCart(req, res) {
  const cart = await getCart({
    user: req.user,
    sessionId: getCartSessionId(req),
    createIfMissing: true
  });
  res.status(200).json(cart);
}

async function createCartItem(req, res) {
  const cart = await addCartItem({
    user: req.user,
    sessionId: getCartSessionId(req),
    payload: req.body
  });
  res.status(201).json(cart);
}

async function patchCartItem(req, res) {
  const cart = await updateCartItem({
    user: req.user,
    sessionId: getCartSessionId(req),
    productId: req.params.productId,
    payload: req.body
  });
  res.status(200).json(cart);
}

async function deleteCartItem(req, res) {
  const cart = await removeCartItem({
    user: req.user,
    sessionId: getCartSessionId(req),
    productId: req.params.productId
  });
  res.status(200).json(cart);
}

module.exports = {
  createCartItem,
  deleteCartItem,
  patchCartItem,
  readCart
};

