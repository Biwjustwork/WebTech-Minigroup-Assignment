const {
  getProduct,
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

module.exports = {
  getProductById,
  listProducts
};

