const {
  getProduct,
  getRecommendationsForProduct,
  getProducts
} = require('../services/product.service');

async function listProducts(req, res) {
  const result = await getProducts(req.query);
  res.status(200).json(result);
}

async function getProductById(req, res) {
  const product = await getProduct(req.params.productId);
  res.status(200).json({ data: product });
}

async function getProductRecommendations(req, res) {
  const result = await getRecommendationsForProduct(req.params.productId, req.query);
  res.status(200).json(result);
}

module.exports = {
  getProductById,
  getProductRecommendations,
  listProducts
};
