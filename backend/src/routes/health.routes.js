const { Router } = require('express');
const { getHealth } = require('../controllers/health.controller');

const healthRoutes = Router();

healthRoutes.get('/', getHealth);

module.exports = { healthRoutes };

