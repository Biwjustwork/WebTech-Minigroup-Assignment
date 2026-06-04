const subscriptionDiscountRate = 0.2;

function calculateSubscriptionLinePricing({
  isLoggedIn,
  isRecurring,
  quantity,
  unitPrice
}) {
  const subtotal = unitPrice * quantity;
  const shouldApplyDiscount = Boolean(isLoggedIn && isRecurring);
  const discountRate = shouldApplyDiscount ? subscriptionDiscountRate : 0;
  const discount = subtotal * discountRate;

  return {
    subtotal,
    discount,
    discountRate,
    discountReason: shouldApplyDiscount ? 'recurring_logged_in_20_percent' : null,
    lineTotal: subtotal - discount
  };
}

module.exports = {
  calculateSubscriptionLinePricing,
  subscriptionDiscountRate
};


