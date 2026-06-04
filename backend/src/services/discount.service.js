const cartTotalThreshold = 200;
const cartTotalDiscountRate = 0.1;
const freshCategoryQuantityThreshold = 3;
const freshCategoryDiscountRate = 0.15;

function calculateDynamicDiscount(lineItems) {
  const baseTotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const freshQuantity = lineItems
    .filter((item) => item.category === 'Fresh')
    .reduce((sum, item) => sum + item.quantity, 0);

  const candidates = [];

  if (baseTotal > cartTotalThreshold) {
    candidates.push({
      discount: baseTotal * cartTotalDiscountRate,
      discountRate: cartTotalDiscountRate,
      discountReason: 'cart_total_over_200_10_percent'
    });
  }

  if (freshQuantity > freshCategoryQuantityThreshold) {
    candidates.push({
      discount: baseTotal * freshCategoryDiscountRate,
      discountRate: freshCategoryDiscountRate,
      discountReason: 'fresh_category_more_than_3_items_15_percent'
    });
  }

  const bestDiscount = candidates.sort((a, b) => b.discount - a.discount)[0] || {
    discount: 0,
    discountRate: 0,
    discountReason: null
  };

  return {
    baseTotal,
    dynamicDiscount: bestDiscount.discount,
    dynamicDiscountRate: bestDiscount.discountRate,
    dynamicDiscountReason: bestDiscount.discountReason,
    total: baseTotal - bestDiscount.discount,
    rulesEvaluated: {
      cartTotalThreshold,
      freshCategoryQuantityThreshold,
      freshQuantity
    }
  };
}

module.exports = {
  calculateDynamicDiscount
};


