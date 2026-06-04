const { randomUUID } = require('crypto');
const { getSupabaseAdminClient } = require('../config/supabase');
const { calculateSubscriptionLinePricing } = require('./subscriptionDiscount.service');
const { createHttpError } = require('../utils/httpError');
const { throwIfSupabaseError } = require('../utils/supabaseError');
const {
  assertAllowedOrderType,
  assertNoClientCalculatedFields
} = require('../utils/gatekeeper');

function createCartId() {
  return `cart_${randomUUID()}`;
}

function createCartItemId() {
  return `cart_item_${randomUUID()}`;
}

function normalizeFrequency(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const frequency = String(value).replace('-', '_');
  if (!['weekly', 'bi_weekly', 'monthly'].includes(frequency)) {
    throw createHttpError(400, 'INVALID_CART_ITEM', 'frequency must be weekly, bi_weekly, or monthly.');
  }

  return frequency;
}

function normalizeQuantity(value, fallback = 1) {
  const quantity = value === undefined || value === null || value === '' ? fallback : Number(value);

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw createHttpError(400, 'INVALID_CART_ITEM', 'quantity must be a positive integer.');
  }

  return quantity;
}

function normalizeIsRecurring(payload) {
  assertAllowedOrderType(payload.orderType, 'INVALID_CART_ITEM');

  if (payload.isRecurring !== undefined) {
    return Boolean(payload.isRecurring);
  }

  if (payload.is_recurring !== undefined) {
    return Boolean(payload.is_recurring);
  }

  return payload.orderType === 'recurring';
}

function normalizeCartItemPayload(payload, fallbackProductId) {
  assertNoClientCalculatedFields(payload);

  const productId = String(payload.productId || payload.product_id || fallbackProductId || '').trim();

  if (!productId) {
    throw createHttpError(400, 'INVALID_CART_ITEM', 'productId is required.');
  }

  const quantity = normalizeQuantity(payload.quantity);
  const isRecurring = normalizeIsRecurring(payload);
  const frequency = isRecurring ? normalizeFrequency(payload.frequency || 'monthly') : null;

  return {
    productId,
    quantity,
    isRecurring,
    frequency
  };
}

function getCartSessionId(sessionId) {
  return sessionId || `guest_${randomUUID()}`;
}

async function findActiveCart({ user, sessionId }) {
  const supabase = getSupabaseAdminClient();
  let request = supabase
    .from('carts')
    .select('*')
    .eq('status', 'active');

  if (user) {
    request = request.eq('user_id', user.user_id);
  } else if (sessionId) {
    request = request.eq('session_id', sessionId);
  } else {
    return null;
  }

  const { data, error } = await request.maybeSingle();
  throwIfSupabaseError(error);
  return data;
}

async function ensureCart({ user, sessionId, createIfMissing = true }) {
  const resolvedSessionId = user ? null : getCartSessionId(sessionId);
  let cart = await findActiveCart({ user, sessionId: resolvedSessionId });

  if (!cart && createIfMissing) {
    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('carts')
      .insert({
        cart_id: createCartId(),
        user_id: user?.user_id || null,
        session_id: resolvedSessionId,
        status: 'active',
        created_at: now,
        updated_at: now
      })
      .select('*')
      .single();

    throwIfSupabaseError(error);
    cart = data;
  }

  return cart;
}

async function assertProductExists(productId) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('products')
    .select('product_id')
    .eq('product_id', productId)
    .maybeSingle();

  throwIfSupabaseError(error);

  if (!data) {
    throw createHttpError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
  }
}

function mapCartRow(row, isLoggedIn) {
  const product = row.products;
  const quantity = Number(row.quantity);
  const unitPrice = Number(product.price);
  const isRecurring = Boolean(row.is_recurring);
  const pricing = calculateSubscriptionLinePricing({
    isLoggedIn,
    isRecurring,
    quantity,
    unitPrice
  });

  return {
    productId: row.product_id,
    product: {
      id: row.product_id,
      product_id: row.product_id,
      name: product.name,
      category: product.category,
      image: product.image,
      description: product.description,
      price: unitPrice,
      stock_quantity: Number(product.stock_quantity)
    },
    quantity,
    orderType: isRecurring ? 'recurring' : 'one-time',
    isRecurring,
    frequency: row.frequency,
    unitPrice,
    discount: pricing.discount,
    discountRate: pricing.discountRate,
    discountReason: pricing.discountReason,
    lineTotal: pricing.lineTotal
  };
}

async function buildCartResponse(cart, user) {
  const supabase = getSupabaseAdminClient();
  const rows = cart
    ? await supabase
      .from('cart_items')
      .select(`
        product_id,
        quantity,
        is_recurring,
        frequency,
        created_at,
        products (
          name,
          category,
          image,
          description,
          price,
          stock_quantity
        )
      `)
      .eq('cart_id', cart.cart_id)
      .order('created_at', { ascending: true })
    : { data: [], error: null };

  throwIfSupabaseError(rows.error);

  const items = (rows.data || []).map((row) => mapCartRow(row, Boolean(user)));
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountTotal = items.reduce((sum, item) => sum + item.discount, 0);

  return {
    data: {
      cartId: cart?.cart_id || null,
      cartSessionId: cart?.session_id || null,
      userId: cart?.user_id || null,
      items,
      summary: {
        subtotal,
        discountTotal,
        total: subtotal - discountTotal
      }
    }
  };
}

async function getCart({ user, sessionId, createIfMissing = true }) {
  const cart = await ensureCart({ user, sessionId, createIfMissing });
  return buildCartResponse(cart, user);
}

async function addCartItem({ user, sessionId, payload }) {
  const item = normalizeCartItemPayload(payload);
  await assertProductExists(item.productId);

  const cart = await ensureCart({ user, sessionId });
  const supabase = getSupabaseAdminClient();
  const { data: existingItem, error: existingError } = await supabase
    .from('cart_items')
    .select('cart_item_id,quantity')
    .eq('cart_id', cart.cart_id)
    .eq('product_id', item.productId)
    .maybeSingle();

  throwIfSupabaseError(existingError);

  const now = new Date().toISOString();
  const upsertPayload = {
    cart_item_id: existingItem?.cart_item_id || createCartItemId(),
    cart_id: cart.cart_id,
    product_id: item.productId,
    quantity: Number(existingItem?.quantity || 0) + item.quantity,
    is_recurring: item.isRecurring,
    frequency: item.frequency,
    updated_at: now,
    created_at: existingItem ? undefined : now
  };

  const { error: upsertError } = await supabase
    .from('cart_items')
    .upsert(upsertPayload, { onConflict: 'cart_id,product_id' });

  throwIfSupabaseError(upsertError);

  const { error: cartError } = await supabase
    .from('carts')
    .update({ updated_at: now })
    .eq('cart_id', cart.cart_id);

  throwIfSupabaseError(cartError);
  return buildCartResponse(cart, user);
}

async function updateCartItem({ user, sessionId, productId, payload }) {
  const item = normalizeCartItemPayload({ ...payload, productId }, productId);
  const cart = await ensureCart({ user, sessionId, createIfMissing: false });

  if (!cart) {
    throw createHttpError(404, 'CART_NOT_FOUND', 'Cart was not found.');
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('cart_items')
    .update({
      quantity: item.quantity,
      is_recurring: item.isRecurring,
      frequency: item.frequency,
      updated_at: now
    })
    .eq('cart_id', cart.cart_id)
    .eq('product_id', item.productId)
    .select('cart_item_id');

  throwIfSupabaseError(error);

  if (!data || data.length === 0) {
    throw createHttpError(404, 'CART_ITEM_NOT_FOUND', 'Cart item was not found.');
  }

  const { error: cartError } = await supabase
    .from('carts')
    .update({ updated_at: now })
    .eq('cart_id', cart.cart_id);

  throwIfSupabaseError(cartError);
  return buildCartResponse(cart, user);
}

async function removeCartItem({ user, sessionId, productId }) {
  const cart = await ensureCart({ user, sessionId, createIfMissing: false });

  if (!cart) {
    throw createHttpError(404, 'CART_NOT_FOUND', 'Cart was not found.');
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('cart_id', cart.cart_id)
    .eq('product_id', productId);

  throwIfSupabaseError(error);

  const { error: cartError } = await supabase
    .from('carts')
    .update({ updated_at: new Date().toISOString() })
    .eq('cart_id', cart.cart_id);

  throwIfSupabaseError(cartError);
  return buildCartResponse(cart, user);
}

module.exports = {
  buildCartResponse,
  ensureCart,
  getCart,
  addCartItem,
  normalizeCartItemPayload,
  removeCartItem,
  updateCartItem
};

