const cartTotalThreshold = 200;
const cartTotalDiscountRate = 0.1;
const zeroWasteCategoryQuantityThreshold = 3;
const zeroWasteCategoryDiscountRate = 0.15;

function calculateDynamicDiscount(lineItems) {
  const grossTotal = lineItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const baseTotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  
  // 🌟 แก้บั๊ก: เปลี่ยนจาก item.category เป็น item.product.category
  const zeroWasteQuantity = lineItems
    .filter((item) => item.product && item.product.category === 'Zero Waste')
    .reduce((sum, item) => sum + item.quantity, 0);

  const candidates = [];

  // 1. ลด 10% เมื่อยอดรวม >= 200
  if (grossTotal >= cartTotalThreshold) {
    candidates.push({
      discount: baseTotal * cartTotalDiscountRate,
      discountRate: cartTotalDiscountRate,
      discountReason: 'cart_total_over_200_10_percent'
    });
  }

  // 2. ลด 15% เมื่อยอด >= 200 และมีสินค้า Zero Waste
  // 🌟 แก้บั๊ก: เปลี่ยนจาก item.category เป็น item.product.category
  const hasZeroWaste = lineItems.some((item) => item.product && item.product.category === 'Zero Waste');
  if (grossTotal >= cartTotalThreshold && hasZeroWaste) {
    candidates.push({
      discount: baseTotal * 0.15,
      discountRate: 0.15,
      discountReason: 'cart_over_200_and_zero_waste_15_percent'
    });
  }

  // 3. ลด 15% เมื่อหมวด Zero Waste มากกว่า 3 ชิ้น (ตั้งแต่ 4 ชิ้นขึ้นไป)
  if (zeroWasteQuantity > zeroWasteCategoryQuantityThreshold) {
    candidates.push({
      discount: baseTotal * zeroWasteCategoryDiscountRate,
      discountRate: zeroWasteCategoryDiscountRate,
      discountReason: 'zero_waste_more_than_3_items_15_percent' 
    });
  }

  // หาโปรโมชั่นที่ให้ส่วนลดเยอะที่สุดแก่ลูกค้า
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
      zeroWasteCategoryQuantityThreshold,
      zeroWasteQuantity
    }
  };
}

module.exports = {
  calculateDynamicDiscount
};