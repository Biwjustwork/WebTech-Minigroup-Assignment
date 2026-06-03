const { createHttpError } = require('./httpError');

const clientCalculatedFields = [
  'price',
  'unitPrice',
  'unit_price',
  'subtotal',
  'total',
  'totalAmount',
  'total_amount',
  'discount',
  'discountTotal',
  'discount_total',
  'discountRate',
  'discount_rate',
  'lineTotal',
  'line_total',
  'finalTotal',
  'final_total'
];

function assertNoClientCalculatedFields(payload, path = 'body') {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  if (Array.isArray(payload)) {
    payload.forEach((item, index) => assertNoClientCalculatedFields(item, `${path}[${index}]`));
    return;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (clientCalculatedFields.includes(key)) {
      throw createHttpError(
        400,
        'CLIENT_CALCULATION_REJECTED',
        `${path}.${key} is calculated by the backend and must not be sent by the client.`
      );
    }

    if (value && typeof value === 'object') {
      assertNoClientCalculatedFields(value, `${path}.${key}`);
    }
  }
}

function assertAllowedOrderType(orderType, code = 'INVALID_ORDER_TYPE') {
  if (orderType === undefined || orderType === null || orderType === '') {
    return;
  }

  if (!['one-time', 'recurring'].includes(orderType)) {
    throw createHttpError(400, code, 'orderType must be one-time or recurring.');
  }
}

module.exports = {
  assertAllowedOrderType,
  assertNoClientCalculatedFields,
  clientCalculatedFields
};

