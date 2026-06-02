const { Router } = require('express');
const { authRoutes } = require('./auth.routes');
const { healthRoutes } = require('./health.routes');
const { productRoutes } = require('./product.routes');

const apiRoutes = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/products', productRoutes);

module.exports = { apiRoutes };
