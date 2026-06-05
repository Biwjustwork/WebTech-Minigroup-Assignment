const { randomUUID } = require('crypto');
const { getSupabaseAdminClient } = require('../config/supabase');
const {
  ensureCart,
  normalizeCartItemPayload
} = require('./cart.service');
const { calculateSubscriptionLinePricing } = require('./subscriptionDiscount.service');
const { calculateDynamicDiscount } = require('./discount.service');
const { createHttpError } = require('../utils/httpError');
const { assertNoClientCalculatedFields } = require('../utils/gatekeeper');
const { mapSupabaseRpcError, throwIfSupabaseError } = require('../utils/supabaseError');

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
  const paymentMethod = String(payload.paymentMethod || 'bypassed').trim();
  const transactionRef = payload.transactionRef ? String(payload.transactionRef).trim() : null;

  if (!address) {
    throw createHttpError(400, 'INVALID_CHECKOUT', 'address is required.');
  }

  const validPaymentMethods = ['bypassed', 'bank_transfer', 'credit_card', 'cod'];
  if (!validPaymentMethods.includes(paymentMethod)) {
    throw createHttpError(400, 'INVALID_CHECKOUT', `paymentMethod must be one of: ${validPaymentMethods.join(', ')}`);
  }

  if (!user) {
    if (!guestName) {
      throw createHttpError(400, 'INVALID_CHECKOUT', 'guestName is required for guest checkout.');
    }

    if (!emailPattern.test(guestEmail)) {
      throw createHttpError(400, 'INVALID_CHECKOUT', 'guestEmail must be valid for guest checkout.');
    }
  }

  // Determine paymentStatus based on paymentMethod
  let paymentStatus = 'bypassed';
  if (paymentMethod === 'cod') {
    paymentStatus = 'pending';
  } else if (paymentMethod === 'bank_transfer' || paymentMethod === 'credit_card') {
    paymentStatus = 'completed';
  }

  return { address, guestEmail, guestName, paymentMethod, paymentStatus, transactionRef };
}

async function loadCartItems({ user, sessionId }) {
  const cart = await ensureCart({ user, sessionId, createIfMissing: false });
  if (!cart) {
    return { cart: null, items: [] };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cart_items')
    .select('product_id,quantity,is_recurring,frequency,created_at')
    .eq('cart_id', cart.cart_id)
    .order('created_at', { ascending: true });

  throwIfSupabaseError(error);

  return {
    cart,
    items: (data || []).map((row) => ({
      productId: row.product_id,
      quantity: Number(row.quantity),
      isRecurring: Boolean(row.is_recurring),
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

async function loadCheckoutProducts(items) {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('products')
    .select('product_id,name,category,price,stock_quantity')
    .in('product_id', productIds);

  throwIfSupabaseError(error);

  const productsById = new Map((data || []).map((product) => [product.product_id, product]));

  for (const item of items) {
    const product = productsById.get(item.productId);
    if (!product) {
      throw createHttpError(404, 'PRODUCT_NOT_FOUND', `Product ${item.productId} was not found.`);
    }

    if (Number(product.stock_quantity) < item.quantity) {
      throw createHttpError(409, 'OUT_OF_STOCK', `${product.name} is out of stock.`);
    }
  }

  return productsById;
}

async function processCheckout({ user, payload, sessionId }) {
  assertNoClientCalculatedFields(payload);

  const checkoutDetails = validateCheckoutPayload(payload, user);
  const payloadItems = getCheckoutItems(payload.items);
  const cartResult = payloadItems
    ? { cart: null, items: payloadItems }
    : await loadCartItems({ user, sessionId: payload.cartSessionId || sessionId });
  const items = cartResult.items;

  if (items.length === 0) {
    throw createHttpError(400, 'EMPTY_CHECKOUT', 'checkout requires at least one item.');
  }

  const productsById = await loadCheckoutProducts(items);
  const orderId = createOrderId();
  const lineItems = [];
  let subtotal = 0;
  let discountTotal = 0;

  for (const item of items) {
    const product = productsById.get(item.productId);
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
      orderItemId: createOrderItemId(),
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
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc('commit_checkout_order', {
    p_order: {
      order_id: orderId,
      user_id: user?.user_id || null,
      is_guest_checkout: !user,
      guest_name: user ? null : checkoutDetails.guestName,
      guest_email: user ? null : checkoutDetails.guestEmail,
      address: checkoutDetails.address,
      subtotal_amount: subtotal,
      subscription_discount_amount: discountTotal,
      dynamic_discount_amount: dynamicPricing.dynamicDiscount,
      dynamic_discount_reason: dynamicPricing.dynamicDiscountReason,
      total_amount: total,
      payment_method: checkoutDetails.paymentMethod,
      payment_status: checkoutDetails.paymentStatus,
      transaction_ref: checkoutDetails.transactionRef
    },
    p_items: lineItems.map((item) => ({
      order_item_id: item.orderItemId,
      product_id: item.productId,
      quantity: item.quantity,
      is_recurring: item.isRecurring,
      frequency: item.frequency,
      next_delivery_date: item.nextDeliveryDate,
      unit_price: item.unitPrice,
      discount_applied: item.discount,
      line_total: item.lineTotal
    })),
    p_payment_id: createPaymentId(),
    p_cart_id: cartResult.cart?.cart_id || null
  });

  if (error) {
    throw mapSupabaseRpcError(error);
  }

  return {
    data: {
      orderId,
      status: 'placed',
      paymentStatus: checkoutDetails.paymentStatus,
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
}

module.exports = { processCheckout };

