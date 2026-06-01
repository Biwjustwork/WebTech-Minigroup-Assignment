document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('checkout-items-body');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const totalEl = document.getElementById('checkout-total');
    const placeOrderBtn = document.getElementById('checkout-place-order');
    const shippingInputs = document.querySelectorAll('input[name="shipping_method"]');

    if (!tbody || !subtotalEl || !totalEl || !placeOrderBtn) return;

    const shoppingCart = JSON.parse(localStorage.getItem('shoppingCart')) || {};
    let products = [];
    let currentSubtotal = 0;

    try {
        const response = await fetch('backend/mock-data/products.json');
        if (!response.ok) throw new Error('Failed to fetch product data');
        products = await response.json();
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-danger">
                    ไม่สามารถโหลดสินค้าได้ในขณะนี้
                </td>
            </tr>
        `;
        placeOrderBtn.disabled = true;
        console.error('Checkout load error:', error);
        return;
    }

    function formatCurrency(value) {
        return `$${value.toFixed(2)}`;
    }

    function getShippingCost() {
        const selected = document.querySelector('input[name="shipping_method"]:checked');
        return selected ? parseFloat(selected.value) : 0;
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
        const cartKeys = Object.keys(shoppingCart);
        if (cartKeys.length === 0) {
            renderEmptyCart();
            return;
        }

        let html = '';
        currentSubtotal = 0;

        cartKeys.forEach((id) => {
            const item = shoppingCart[id];
            const product = products.find(p => String(p.id) === String(id));
            if (!product) return;

            const quantity = Number(item.quantity) || 1;
            const lineTotal = product.price * quantity;
            currentSubtotal += lineTotal;

            html += `
                <tr data-id="${id}">
                    <th scope="row">
                        <div class="d-flex align-items-center">
                            <img src="${product.image}" class="img-fluid rounded-circle" style="width: 90px; height: 90px; object-fit: cover;" alt="${product.name}">
                        </div>
                    </th>
                    <td class="py-4 align-middle">${product.name}</td>
                    <td class="py-4 align-middle">${formatCurrency(product.price)}</td>
                    <td class="py-4 align-middle">${quantity}</td>
                    <td class="py-4 align-middle">${formatCurrency(lineTotal)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        placeOrderBtn.disabled = false;
        renderTotals();
    }

    shippingInputs.forEach(input => {
        input.addEventListener('change', renderTotals);
    });

    placeOrderBtn.addEventListener('click', () => {
        if (Object.keys(shoppingCart).length === 0) return;
        alert('Order placed successfully! This is a front-end demo and no payment is processed.');
    });

    renderCheckoutItems();
});