const { randomUUID } = require('crypto');
const {
  all,
  closeDatabase,
  get,
  openDatabase,
  run
} = require('../database/connection');
const {
  ensureCart,
  normalizeCartItemPayload
} = require('./cart.service');
const { calculateSubscriptionLinePricing } = require('./subscriptionDiscount.service');
const { createHttpError } = require('../utils/httpError');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createOrderId() {
  return `order_${randomUUID()}`;
}

function createOrderItemId() {
  return `order_item_${randomUUID()}`;
}

function createPaymentId() {
  return `payment_${randomUUID()}`;
}

function validateCheckoutPayload(payload, user) {
  const address = String(payload.address || '').trim();
  const guestName = String(payload.guestName || payload.guest_name || '').trim();
  const guestEmail = String(payload.guestEmail || payload.guest_email || '').trim().toLowerCase();

  if (!address) {
    throw createHttpError(400, 'INVALID_CHECKOUT', 'address is required.');
  }

  if (!user) {
    if (!guestName) {
      throw createHttpError(400, 'INVALID_CHECKOUT', 'guestName is required for guest checkout.');
    }

    if (!emailPattern.test(guestEmail)) {
      throw createHttpError(400, 'INVALID_CHECKOUT', 'guestEmail must be valid for guest checkout.');
    }
  }

  return { address, guestEmail, guestName };
}

async function loadCartItems(db, { user, sessionId }) {
  const cart = await ensureCart(db, { user, sessionId, createIfMissing: false });
  if (!cart) {
    return { cart: null, items: [] };
  }

  const rows = await all(
    db,
    `
      SELECT product_id, quantity, is_recurring, frequency
      FROM cart_items
      WHERE cart_id = ?
      ORDER BY created_at
    `,
    [cart.cart_id]
  );

  return {
    cart,
    items: rows.map((row) => ({
      productId: row.product_id,
      quantity: Number(row.quantity),
      isRecurring: Number(row.is_recurring) === 1,
      frequency: row.frequency
    }))
  };
}

function getCheckoutItems(payloadItems) {
  if (!Array.isArray(payloadItems)) {
    return null;
  }

  return payloadItems.map((item) => normalizeCartItemPayload(item));
}

function calculateNextDeliveryDate(frequency) {
  const date = new Date();

  if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (frequency === 'bi_weekly') {
    date.setDate(date.getDate() + 14);
  } else {
    date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString();
}

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

  return product;
}

async function processCheckout({ user, payload, sessionId }) {
  const checkoutDetails = validateCheckoutPayload(payload, user);
  const db = await openDatabase();

  try {
    await run(db, 'BEGIN');

    try {
      const payloadItems = getCheckoutItems(payload.items);
      const cartResult = payloadItems ? { cart: null, items: payloadItems } : await loadCartItems(db, { user, sessionId: payload.cartSessionId || sessionId });
      const items = cartResult.items;

      if (items.length === 0) {
        throw createHttpError(400, 'EMPTY_CHECKOUT', 'checkout requires at least one item.');
      }

      const orderId = createOrderId();
      const lineItems = [];
      let subtotal = 0;
      let discountTotal = 0;

      for (const item of items) {
        const product = await getProductForCheckout(db, item.productId);

        if (Number(product.stock_quantity) < item.quantity) {
          throw createHttpError(409, 'OUT_OF_STOCK', `${product.name} is out of stock.`);
        }

        const unitPrice = Number(product.price);
        const pricing = calculateSubscriptionLinePricing({
          isLoggedIn: Boolean(user),
          isRecurring: item.isRecurring,
          quantity: item.quantity,
          unitPrice
        });

        subtotal += pricing.subtotal;
        discountTotal += pricing.discount;

        lineItems.push({
          productId: product.product_id,
          productName: product.name,
          quantity: item.quantity,
          isRecurring: item.isRecurring,
          frequency: item.frequency,
          nextDeliveryDate: item.isRecurring ? calculateNextDeliveryDate(item.frequency) : null,
          unitPrice,
          discount: pricing.discount,
          discountRate: pricing.discountRate,
          discountReason: pricing.discountReason,
          lineTotal: pricing.lineTotal
        });
      }

      const total = subtotal - discountTotal;

      await run(
        db,
        `
          INSERT INTO orders (
            order_id,
            user_id,
            is_guest_checkout,
            guest_name,
            guest_email,
            address,
            total_amount,
            order_status,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'placed', datetime('now'))
        `,
        [
          orderId,
          user?.user_id || null,
          user ? 0 : 1,
          user ? null : checkoutDetails.guestName,
          user ? null : checkoutDetails.guestEmail,
          checkoutDetails.address,
          total
        ]
      );

      for (const item of lineItems) {
        const stockUpdate = await run(
          db,
          `
            UPDATE products
            SET stock_quantity = stock_quantity - ?, updated_at = datetime('now')
            WHERE product_id = ? AND stock_quantity >= ?
          `,
          [item.quantity, item.productId, item.quantity]
        );

        if (stockUpdate.changes === 0) {
          throw createHttpError(409, 'OUT_OF_STOCK', `${item.productName} is out of stock.`);
        }

        await run(
          db,
          `
            INSERT INTO order_items (
              order_item_id,
              order_id,
              product_id,
              quantity,
              is_recurring,
              frequency,
              next_delivery_date,
              unit_price,
              discount_applied,
              line_total
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            createOrderItemId(),
            orderId,
            item.productId,
            item.quantity,
            item.isRecurring ? 1 : 0,
            item.frequency,
            item.nextDeliveryDate,
            item.unitPrice,
            item.discount,
            item.lineTotal
          ]
        );
      }

      await run(
        db,
        `
          INSERT INTO payments (
            payment_id,
            order_id,
            payment_method,
            payment_status
          )
          VALUES (?, ?, 'bypassed', 'bypassed')
        `,
        [createPaymentId(), orderId]
      );

      if (cartResult.cart) {
        await run(db, 'UPDATE carts SET status = ?, updated_at = datetime(\'now\') WHERE cart_id = ?', ['checked_out', cartResult.cart.cart_id]);
      }

      await run(db, 'COMMIT');

      return {
        data: {
          orderId,
          status: 'placed',
          paymentStatus: 'bypassed',
          userId: user?.user_id || null,
          isGuestCheckout: !user,
          items: lineItems,
          summary: {
            subtotal,
            discountTotal,
            total
          }
        }
      };
    } catch (error) {
      await run(db, 'ROLLBACK');
      throw error;
    }
  } finally {
    await closeDatabase(db);
  }
}

module.exports = { processCheckout };
