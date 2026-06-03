const { randomUUID } = require('crypto');
const {
  all,
  closeDatabase,
  get,
  openDatabase,
  run
} = require('../database/connection');
const { calculateSubscriptionLinePricing } = require('./subscriptionDiscount.service');
const { createHttpError } = require('../utils/httpError');
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

async function findActiveCart(db, { user, sessionId }) {
  if (user) {
    return get(db, 'SELECT * FROM carts WHERE user_id = ? AND status = ?', [user.user_id, 'active']);
  }

  if (!sessionId) {
    return null;
  }

  return get(db, 'SELECT * FROM carts WHERE session_id = ? AND status = ?', [sessionId, 'active']);
}

async function ensureCart(db, { user, sessionId, createIfMissing = true }) {
  const resolvedSessionId = user ? null : getCartSessionId(sessionId);
  let cart = await findActiveCart(db, { user, sessionId: resolvedSessionId });

  if (!cart && createIfMissing) {
    cart = {
      cart_id: createCartId(),
      user_id: user?.user_id || null,
      session_id: resolvedSessionId,
      status: 'active'
    };

    await run(
      db,
      `
        INSERT INTO carts (cart_id, user_id, session_id, status)
        VALUES (?, ?, ?, 'active')
      `,
      [cart.cart_id, cart.user_id, cart.session_id]
    );
  }

  return cart;
}

async function assertProductExists(db, productId) {
  const product = await get(
    db,
    'SELECT product_id FROM products WHERE product_id = ?',
    [productId]
  );

  if (!product) {
    throw createHttpError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
  }
}

function mapCartRow(row, isLoggedIn) {
  const quantity = Number(row.quantity);
  const unitPrice = Number(row.price);
  const isRecurring = Number(row.is_recurring) === 1;
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
      name: row.name,
      category: row.category,
      image: row.image,
      description: row.description,
      price: unitPrice,
      stock_quantity: Number(row.stock_quantity)
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

async function buildCartResponse(db, cart, user) {
  const rows = cart
    ? await all(
      db,
      `
        SELECT
          ci.product_id,
          ci.quantity,
          ci.is_recurring,
          ci.frequency,
          p.name,
          p.category,
          p.image,
          p.description,
          p.price,
          p.stock_quantity
        FROM cart_items ci
        JOIN products p ON p.product_id = ci.product_id
        WHERE ci.cart_id = ?
        ORDER BY ci.created_at
      `,
      [cart.cart_id]
    )
    : [];

  const items = rows.map((row) => mapCartRow(row, Boolean(user)));
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
  const db = await openDatabase();

  try {
    const cart = await ensureCart(db, { user, sessionId, createIfMissing });
    return buildCartResponse(db, cart, user);
  } finally {
    await closeDatabase(db);
  }
}

async function addCartItem({ user, sessionId, payload }) {
  const item = normalizeCartItemPayload(payload);
  const db = await openDatabase();

  try {
    await assertProductExists(db, item.productId);
    const cart = await ensureCart(db, { user, sessionId });

    await run(
      db,
      `
        INSERT INTO cart_items (
          cart_item_id,
          cart_id,
          product_id,
          quantity,
          is_recurring,
          frequency,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(cart_id, product_id) DO UPDATE SET
          quantity = cart_items.quantity + excluded.quantity,
          is_recurring = excluded.is_recurring,
          frequency = excluded.frequency,
          updated_at = datetime('now')
      `,
      [
        createCartItemId(),
        cart.cart_id,
        item.productId,
        item.quantity,
        item.isRecurring ? 1 : 0,
        item.frequency
      ]
    );

    await run(db, 'UPDATE carts SET updated_at = datetime(\'now\') WHERE cart_id = ?', [cart.cart_id]);
    return buildCartResponse(db, cart, user);
  } finally {
    await closeDatabase(db);
  }
}

async function updateCartItem({ user, sessionId, productId, payload }) {
  const item = normalizeCartItemPayload({ ...payload, productId }, productId);
  const db = await openDatabase();

  try {
    const cart = await ensureCart(db, { user, sessionId, createIfMissing: false });
    if (!cart) {
      throw createHttpError(404, 'CART_NOT_FOUND', 'Cart was not found.');
    }

    const result = await run(
      db,
      `
        UPDATE cart_items
        SET
          quantity = ?,
          is_recurring = ?,
          frequency = ?,
          updated_at = datetime('now')
        WHERE cart_id = ? AND product_id = ?
      `,
      [item.quantity, item.isRecurring ? 1 : 0, item.frequency, cart.cart_id, item.productId]
    );

    if (result.changes === 0) {
      throw createHttpError(404, 'CART_ITEM_NOT_FOUND', 'Cart item was not found.');
    }

    await run(db, 'UPDATE carts SET updated_at = datetime(\'now\') WHERE cart_id = ?', [cart.cart_id]);
    return buildCartResponse(db, cart, user);
  } finally {
    await closeDatabase(db);
  }
}

async function removeCartItem({ user, sessionId, productId }) {
  const db = await openDatabase();

  try {
    const cart = await ensureCart(db, { user, sessionId, createIfMissing: false });
    if (!cart) {
      throw createHttpError(404, 'CART_NOT_FOUND', 'Cart was not found.');
    }

    await run(
      db,
      'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cart.cart_id, productId]
    );
    await run(db, 'UPDATE carts SET updated_at = datetime(\'now\') WHERE cart_id = ?', [cart.cart_id]);

    return buildCartResponse(db, cart, user);
  } finally {
    await closeDatabase(db);
  }
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
