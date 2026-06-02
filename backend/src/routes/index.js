const { Router } = require('express');
const { healthRoutes } = require('./health.routes');
const { productRoutes } = require('./product.routes');

const apiRoutes = Router();

apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/products', productRoutes);

module.exports = { apiRoutes };

