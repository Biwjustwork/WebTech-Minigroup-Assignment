const { Router } = require('express');
const { healthRoutes } = require('./health.routes');

const apiRoutes = Router();

apiRoutes.use('/health', healthRoutes);

module.exports = { apiRoutes };

