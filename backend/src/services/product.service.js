const {
  all,
  closeDatabase,
  get,
  openDatabase
} = require('../database/connection');
const { createHttpError } = require('../utils/httpError');

const defaultPage = 1;
const defaultLimit = 12;
const maxLimit = 50;

function parsePositiveNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createHttpError(400, 'INVALID_QUERY', `${fieldName} must be a positive number.`);
  }

  return parsed;
}

function parsePositiveInteger(value, fieldName, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createHttpError(400, 'INVALID_QUERY', `${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function buildProductFilters(query) {
  const filters = [];
  const params = [];

  if (query.keyword) {
    const keyword = `%${String(query.keyword).trim().toLowerCase()}%`;
    filters.push('(LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(description) LIKE ?)');
    params.push(keyword, keyword, keyword);
  }

  if (query.category && query.category !== 'All') {
    filters.push('category = ?');
    params.push(String(query.category).trim());
  }

  const minPrice = parsePositiveNumber(query.minPrice, 'minPrice');
  const maxPrice = parsePositiveNumber(query.maxPrice, 'maxPrice');

  if (minPrice !== undefined) {
    filters.push('price >= ?');
    params.push(minPrice);
  }

  if (maxPrice !== undefined) {
    filters.push('price <= ?');
    params.push(maxPrice);
  }

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw createHttpError(400, 'INVALID_QUERY', 'minPrice cannot be greater than maxPrice.');
  }

  return {
    whereClause: filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '',
    params
  };
}

function mapProduct(row) {
  return {
    id: row.product_id,
    product_id: row.product_id,
    name: row.name,
    category: row.category,
    image: row.image,
    description: row.description,
    price: Number(row.price),
    stock_quantity: Number(row.stock_quantity)
  };
}

async function getProducts(query) {
  const page = parsePositiveInteger(query.page, 'page', defaultPage);
  const requestedLimit = parsePositiveInteger(query.limit, 'limit', defaultLimit);
  const limit = Math.min(requestedLimit, maxLimit);
  const offset = (page - 1) * limit;
  const { whereClause, params } = buildProductFilters(query);
  const db = await openDatabase();

  try {
    const countRow = await get(
      db,
      `SELECT COUNT(*) AS total FROM products ${whereClause}`,
      params
    );

    const rows = await all(
      db,
      `
        SELECT
          product_id,
          name,
          category,
          image,
          description,
          price,
          stock_quantity
        FROM products
        ${whereClause}
        ORDER BY product_id
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const totalItems = Number(countRow?.total || 0);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: rows.map(mapProduct),
      meta: {
        page,
        limit,
        totalItems,
        totalPages
      }
    };
  } finally {
    await closeDatabase(db);
  }
}

async function getProduct(productId) {
  const db = await openDatabase();

  try {
    const row = await get(
      db,
      `
        SELECT
          product_id,
          name,
          category,
          image,
          description,
          price,
          stock_quantity
        FROM products
        WHERE product_id = ?
      `,
      [productId]
    );

    if (!row) {
      throw createHttpError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
    }

    return mapProduct(row);
  } finally {
    await closeDatabase(db);
  }
}

async function getRecommendationsForProduct(productId, query) {
  const limit = Math.min(parsePositiveInteger(query.limit, 'limit', 5), maxLimit);
  const db = await openDatabase();

  try {
    const targetProduct = await get(
      db,
      'SELECT product_id FROM products WHERE product_id = ?',
      [productId]
    );

    if (!targetProduct) {
      throw createHttpError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
    }

    const rows = await all(
      db,
      `
        SELECT
          recommended.product_id,
          recommended.name,
          recommended.category,
          recommended.image,
          recommended.description,
          recommended.price,
          recommended.stock_quantity,
          COUNT(*) AS co_purchase_count,
          COUNT(DISTINCT target_orders.user_id) AS user_count
        FROM order_items target_items
        JOIN orders target_orders
          ON target_orders.order_id = target_items.order_id
        JOIN order_items recommended_items
          ON recommended_items.order_id = target_items.order_id
          AND recommended_items.product_id <> target_items.product_id
        JOIN products recommended
          ON recommended.product_id = recommended_items.product_id
        WHERE target_items.product_id = ?
          AND target_orders.user_id IS NOT NULL
        GROUP BY
          recommended.product_id,
          recommended.name,
          recommended.category,
          recommended.image,
          recommended.description,
          recommended.price,
          recommended.stock_quantity
        ORDER BY co_purchase_count DESC, recommended.product_id
        LIMIT ?
      `,
      [productId, limit]
    );

    return {
      data: rows.map((row) => ({
        ...mapProduct(row),
        recommendationScore: Number(row.co_purchase_count),
        purchasedByUsers: Number(row.user_count)
      })),
      meta: {
        productId,
        limit,
        strategy: 'co_purchase_sql_join'
      }
    };
  } finally {
    await closeDatabase(db);
  }
}

module.exports = {
  getProduct,
  getRecommendationsForProduct,
  getProducts
};
