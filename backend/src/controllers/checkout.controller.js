const { processCheckout } = require('../services/checkout.service');

async function checkout(req, res) {
  const order = await processCheckout({
    user: req.user,
    payload: req.body,
    sessionId: req.get('x-cart-session-id') || req.body?.cartSessionId || null
  });

  res.status(201).json(order);
}

module.exports = { checkout };

