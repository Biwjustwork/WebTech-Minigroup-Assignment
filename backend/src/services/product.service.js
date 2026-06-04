const { getSupabaseAdminClient } = require('../config/supabase');
const { createHttpError } = require('../utils/httpError');
const { throwIfSupabaseError } = require('../utils/supabaseError');

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

function applyProductFilters(builder, query) {
  if (query.keyword) {
    const keyword = String(query.keyword).trim();
    builder.or(`name.ilike.%${keyword}%,category.ilike.%${keyword}%,description.ilike.%${keyword}%`);
  }

  if (query.category && query.category !== 'All') {
    builder.eq('category', String(query.category).trim());
  }

  const minPrice = parsePositiveNumber(query.minPrice, 'minPrice');
  const maxPrice = parsePositiveNumber(query.maxPrice, 'maxPrice');

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw createHttpError(400, 'INVALID_QUERY', 'minPrice cannot be greater than maxPrice.');
  }

  if (minPrice !== undefined) {
    builder.gte('price', minPrice);
  }

  if (maxPrice !== undefined) {
    builder.lte('price', maxPrice);
  }

  return builder;
}

async function getProducts(query) {
  const page = parsePositiveInteger(query.page, 'page', defaultPage);
  const requestedLimit = parsePositiveInteger(query.limit, 'limit', defaultLimit);
  const limit = Math.min(requestedLimit, maxLimit);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const supabase = getSupabaseAdminClient();

  let request = supabase
    .from('products')
    .select('product_id,name,category,image,description,price,stock_quantity', { count: 'exact' });

  request = applyProductFilters(request, query)
    .order('product_id', { ascending: true })
    .range(from, to);

  const { data, error, count } = await request;
  throwIfSupabaseError(error);

  const totalItems = Number(count || 0);
  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: (data || []).map(mapProduct),
    meta: {
      page,
      limit,
      totalItems,
      totalPages
    }
  };
}

async function getProduct(productId) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('products')
    .select('product_id,name,category,image,description,price,stock_quantity')
    .eq('product_id', productId)
    .maybeSingle();

  throwIfSupabaseError(error);

  if (!data) {
    throw createHttpError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
  }

  return mapProduct(data);
}

async function getRecommendationsForProduct(productId, query) {
  const limit = Math.min(parsePositiveInteger(query.limit, 'limit', 5), maxLimit);
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.rpc('get_product_recommendations', {
    p_product_id: productId,
    p_limit: limit
  });

  throwIfSupabaseError(error);

  return {
    data: (data || []).map((row) => ({
      ...mapProduct(row),
      recommendationScore: Number(row.co_purchase_count),
      purchasedByUsers: Number(row.user_count)
    })),
    meta: {
      productId,
      limit,
      strategy: 'co_purchase_supabase_rpc'
    }
  };
}

module.exports = {
  getProduct,
  getRecommendationsForProduct,
  getProducts
};

