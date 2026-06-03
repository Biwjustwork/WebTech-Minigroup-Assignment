const { get, run } = require('../database/connection');
const { createHttpError } = require('../utils/httpError');

async function getProductForCheckout(db, productId) {
  const product = await get(
    db,
    `
      SELECT product_id, name, category, price, stock_quantity
      FROM products
      WHERE product_id = ?
    `,
    [productId]
  );

  if (!product) {
    throw createHttpError(404, 'PRODUCT_NOT_FOUND', `Product ${productId} was not found.`);
  }

  return {
    ...product,
    price: Number(product.price),
    stock_quantity: Number(product.stock_quantity)
  };
}

function assertStockAvailable(product, quantity) {
  if (product.stock_quantity < quantity) {
    throw createHttpError(409, 'OUT_OF_STOCK', `${product.name} is out of stock.`);
  }
}

async function reserveStock(db, { productId, productName, quantity }) {
  const stockUpdate = await run(
    db,
    `
      UPDATE products
      SET stock_quantity = stock_quantity - ?, updated_at = datetime('now')
      WHERE product_id = ? AND stock_quantity >= ?
    `,
    [quantity, productId, quantity]
  );

  if (stockUpdate.changes === 0) {
    throw createHttpError(409, 'OUT_OF_STOCK', `${productName} is out of stock.`);
  }
}

async function verifyAndReserveStock(db, { productId, quantity }) {
  const product = await getProductForCheckout(db, productId);

  // This explicit read proves the pre-check requirement. The reserve step below
  // repeats the stock condition in UPDATE so the transaction remains safe even if
  // another checkout changes stock between read and write in a real DB runtime.
  assertStockAvailable(product, quantity);
  await reserveStock(db, {
    productId: product.product_id,
    productName: product.name,
    quantity
  });

  return product;
}

module.exports = {
  assertStockAvailable,
  getProductForCheckout,
  reserveStock,
  verifyAndReserveStock
};

