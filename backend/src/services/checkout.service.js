const { randomUUID } = require('crypto');
const {
  all,
  closeDatabase,
  openDatabase,
  run,
  withTransaction
} = require('../database/connection');
const {
  ensureCart,
  normalizeCartItemPayload
} = require('./cart.service');
const { calculateSubscriptionLinePricing } = require('./subscriptionDiscount.service');
const { calculateDynamicDiscount } = require('./discount.service');
const { verifyAndReserveStock } = require('./inventory.service');
const { createHttpError } = require('../utils/httpError');
const { assertNoClientCalculatedFields } = require('../utils/gatekeeper');

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

async function processCheckout({ user, payload, sessionId }) {
  assertNoClientCalculatedFields(payload);

  const checkoutDetails = validateCheckoutPayload(payload, user);
  const db = await openDatabase();

  try {
    return await withTransaction(db, async () => {
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
        const product = await verifyAndReserveStock(db, {
          productId: item.productId,
          quantity: item.quantity
        });

        const unitPrice = product.price;
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
          category: product.category,
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

      const dynamicPricing = calculateDynamicDiscount(lineItems);
      const total = dynamicPricing.total;

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
            subtotal_amount,
            subscription_discount_amount,
            dynamic_discount_amount,
            dynamic_discount_reason,
            total_amount,
            order_status,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'placed', datetime('now'))
        `,
        [
          orderId,
          user?.user_id || null,
          user ? 0 : 1,
          user ? null : checkoutDetails.guestName,
          user ? null : checkoutDetails.guestEmail,
          checkoutDetails.address,
          subtotal,
          discountTotal,
          dynamicPricing.dynamicDiscount,
          dynamicPricing.dynamicDiscountReason,
          total
        ]
      );

      for (const item of lineItems) {
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
            subscriptionDiscountTotal: discountTotal,
            dynamicDiscountTotal: dynamicPricing.dynamicDiscount,
            dynamicDiscountRate: dynamicPricing.dynamicDiscountRate,
            dynamicDiscountReason: dynamicPricing.dynamicDiscountReason,
            recalculatedBy: 'backend',
            total
          }
        }
      };
    });
  } finally {
    await closeDatabase(db);
  }
}

module.exports = { processCheckout };
