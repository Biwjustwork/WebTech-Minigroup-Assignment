document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('checkout-items-body');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const totalEl = document.getElementById('checkout-total');
    const placeOrderBtn = document.getElementById('checkout-place-order');
    const shippingInputs = document.querySelectorAll('input[name="shipping_method"]');

    const nameInput = document.getElementById('checkout-name');
    const emailInput = document.getElementById('checkout-email');
    const addressInput = document.getElementById('checkout-address');
    const refillSelect = document.getElementById('checkout-refill-frequency');
    const paymentMethod = document.getElementById('checkout-payment-method');
    const paymentExtra = document.getElementById('payment-extra-fields');

    if (!tbody || !subtotalEl || !totalEl || !placeOrderBtn) return;

    let shoppingCart = JSON.parse(localStorage.getItem('shoppingCart')) || {};
    let products = [];
    let currentSubtotal = 0;

    try {
        // try local backend/mock-data first (project may store mock JSON here)
        const response = await fetch('backend/mock-data/products.json');
        if (!response.ok) throw new Error('Failed to fetch product data');
        products = await response.json();
    } catch (error) {
        // fallback: try project-level json folder
        try {
            const resp2 = await fetch('json/Products.json');
            if (!resp2.ok) throw new Error('Fallback failed');
            const data = await resp2.json();
            products = data;
        } catch (err) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-5 text-danger">
                        ไม่สามารถโหลดสินค้าได้ในขณะนี้
                    </td>
                </tr>
            `;
            placeOrderBtn.disabled = true;
            console.error('Checkout load error:', error, err);
            return;
        }
    }

    function formatCurrency(value) {
        return `$${value.toFixed(2)}`;
    }

    function getShippingCost() {
        const selected = document.querySelector('input[name="shipping_method"]:checked');
        return selected ? parseFloat(selected.value) : 0;
    }

    function isRecurringOrder() {
        return refillSelect && refillSelect.value && refillSelect.value !== 'one-time';
    }

    function renderTotals() {
        const shippingCost = getShippingCost();
        const total = currentSubtotal + shippingCost;
        subtotalEl.textContent = formatCurrency(currentSubtotal);
        totalEl.textContent = formatCurrency(total);
    }

    function renderEmptyCart() {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5">
                    <h4 class="text-secondary">ไม่มีสินค้าในตะกร้า</h4>
                    <p class="text-muted">เพิ่มสินค้าลงในตะกร้าของคุณก่อนจะไปยังหน้าชำระเงิน</p>
                    <a href="shop.html" class="btn btn-success mt-3">ไปช้อปปิ้งต่อ</a>
                </td>
            </tr>
        `;
        subtotalEl.textContent = '$0.00';
        totalEl.textContent = '$0.00';
        placeOrderBtn.disabled = true;
    }

    function renderCheckoutItems() {
        shoppingCart = JSON.parse(localStorage.getItem('shoppingCart')) || {};
        const cartKeys = Object.keys(shoppingCart);
        if (cartKeys.length === 0) {
            renderEmptyCart();
            return;
        }

        let html = '';
        currentSubtotal = 0;

        const recurring = isRecurringOrder();

        cartKeys.forEach((id) => {
            const item = shoppingCart[id];
            const product = products.find(p => String(p.id) === String(id) || String(p.id) === String(item.id));
            if (!product) return;

            const quantity = Number(item.quantity) || 1;
            const originalUnit = Number(product.price) || 0;
            const discountedUnit = recurring ? originalUnit * 0.8 : originalUnit; // 20% off for recurring
            const lineTotal = discountedUnit * quantity;
            currentSubtotal += lineTotal;

            html += `
                <tr data-id="${id}">
                    <th scope="row">
                        <div class="d-flex align-items-center">
                            <img src="${product.image}" class="img-fluid rounded-circle" style="width: 90px; height: 90px; object-fit: cover;" alt="${product.name}">
                        </div>
                    </th>
                    <td class="py-4 align-middle">${product.name}</td>
                    <td class="py-4 align-middle">
                        <div>${formatCurrency(originalUnit)}</div>
                        ${recurring ? `<div class="small text-success">Recurring: ${formatCurrency(discountedUnit)}</div>` : ''}
                    </td>
                    <td class="py-4 align-middle">${quantity}</td>
                    <td class="py-4 align-middle">${formatCurrency(lineTotal)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        placeOrderBtn.disabled = false;
        renderTotals();
    }

    // Update dynamic payment extra fields
    function updatePaymentExtraFields() {
        if (!paymentExtra || !paymentMethod) return;
        const val = paymentMethod.value;
        if (val === 'direct-bank-transfer') {
            paymentExtra.innerHTML = `
                <label class="form-label">Bank Account Number <sup>*</sup></label>
                <input id="bank-account-number" type="text" class="form-control" placeholder="Enter bank account number">
            `;
        } else if (val === 'credit-card') {
            paymentExtra.innerHTML = `
                <label class="form-label">Credit Card Number <sup>*</sup></label>
                <input id="credit-card-number" type="text" class="form-control" placeholder="Enter credit card number">
            `;
        } else {
            paymentExtra.innerHTML = '';
        }
        validateForm();
    }

    // Form validation to meet Requirement 1
    function validateForm() {
        const cartNotEmpty = Object.keys(JSON.parse(localStorage.getItem('shoppingCart')) || {}).length > 0;
        const nameOK = nameInput && nameInput.value.trim() !== '';
        const emailOK = emailInput && emailInput.value.trim() !== '';
        const addressOK = addressInput && addressInput.value.trim() !== '';
        const refillOK = refillSelect && refillSelect.value;
        const paymentOK = paymentMethod && paymentMethod.value;

        let extrasOK = true;
        if (paymentMethod && paymentMethod.value === 'direct-bank-transfer') {
            const bankEl = document.getElementById('bank-account-number');
            extrasOK = bankEl && bankEl.value.trim() !== '';
        }
        if (paymentMethod && paymentMethod.value === 'credit-card') {
            const cardEl = document.getElementById('credit-card-number');
            extrasOK = cardEl && cardEl.value.trim() !== '';
        }

        const ok = cartNotEmpty && nameOK && emailOK && addressOK && refillOK && paymentOK && extrasOK;
        placeOrderBtn.disabled = !ok;
        return ok;
    }

    // Autofill for logged-in users per Requirement 2
    (function autofillLoggedIn() {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (isLoggedIn && currentUser) {
            if (nameInput && (nameInput.value.trim() === '' || nameInput.value === null)) nameInput.value = currentUser.username || '';
            if (emailInput && (emailInput.value.trim() === '' || emailInput.value === null)) emailInput.value = currentUser.email || '';
        }
    })();

    // Event listeners
    shippingInputs.forEach(input => {
        input.addEventListener('change', renderTotals);
    });

    if (refillSelect) {
        refillSelect.addEventListener('change', () => {
            renderCheckoutItems();
        });
    }

    if (paymentMethod) {
        paymentMethod.addEventListener('change', updatePaymentExtraFields);
    }

    // Re-validate when user edits key fields
    [nameInput, emailInput, addressInput].forEach(el => {
        if (el) el.addEventListener('input', validateForm);
    });

    // also listen to dynamic extra inputs (delegate via container)
    if (paymentExtra) {
        paymentExtra.addEventListener('input', validateForm);
    }

    placeOrderBtn.addEventListener('click', () => {
        if (!validateForm()) {
            alert('Please complete all required fields before placing your order.');
            return;
        }

        // Everything validated — proceed with demo order placement
        alert('Order placed successfully! This is a front-end demo and no payment is processed.');
        // Optionally clear cart and update UI
        localStorage.removeItem('shoppingCart');
        renderCheckoutItems();
        // reset totals
        renderTotals();
    });

    // initial render
    updatePaymentExtraFields();
    renderCheckoutItems();
    validateForm();
});