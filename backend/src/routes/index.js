const { Router } = require('express');
const { authRoutes } = require('./auth.routes');
const { cartRoutes } = require('./cart.routes');
const { checkoutRoutes } = require('./checkout.routes');
const { healthRoutes } = require('./health.routes');
const { productRoutes } = require('./product.routes');

const apiRoutes = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/cart', cartRoutes);
apiRoutes.use('/checkout', checkoutRoutes);
apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/products', productRoutes);

module.exports = { apiRoutes };
