const { Router } = require('express');
const {
  getProductById,
  getProductRecommendations,
  listProducts
} = require('../controllers/product.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const productRoutes = Router();

productRoutes.get('/', asyncHandler(listProducts));
productRoutes.get('/:productId/recommendations', asyncHandler(getProductRecommendations));
productRoutes.get('/:productId', asyncHandler(getProductById));

module.exports = { productRoutes };
