document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.querySelector('.table tbody');
    const paymentSelect = document.querySelector('select[name="payment_method"]');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const inputs = document.querySelectorAll('.form-control');
    const nameInput = Array.from(inputs).find((el) => el.placeholder.includes('name') || el.placeholder.includes('Name'));
    const emailInput = Array.from(inputs).find((el) => el.type === 'email');
    const addressInput = document.querySelector('textarea');

    if (!tableBody || !placeOrderBtn) return;

    const extraPaymentContainer = document.createElement('div');
    extraPaymentContainer.className = 'col-md-12 mt-3 d-none';
    extraPaymentContainer.innerHTML = `
        <div class="form-item w-100">
            <label class="form-label my-3" id="extra-payment-label">Account Number <sup>*</sup></label>
            <input type="text" class="form-control border-success border-2" id="extra-payment-input" placeholder="Enter details">
        </div>
    `;

    if (paymentSelect) {
        paymentSelect.closest('.col-md-12').appendChild(extraPaymentContainer);
        paymentSelect.addEventListener('change', (event) => {
            const val = event.target.value;
            const input = document.getElementById('extra-payment-input');
            const label = document.getElementById('extra-payment-label');

            if (val === 'direct-bank-transfer') {
                extraPaymentContainer.classList.remove('d-none');
                label.innerHTML = 'Bank Account Number <sup>*</sup>';
                input.placeholder = 'Enter bank account number';
            } else if (val === 'credit-card') {
                extraPaymentContainer.classList.remove('d-none');
                label.innerHTML = 'Credit Card Number <sup>*</sup>';
                input.placeholder = 'Enter 16 digit card number';
            } else {
                extraPaymentContainer.classList.add('d-none');
                input.value = '';
            }
        });
    }

    // 🌟 เปลี่ยนมาใช้ฟังก์ชันแกะข้อมูลผู้ใช้จาก JWT Token ของ window.EcoApi
    const currentUser = window.EcoApi.getCurrentUser();

    if (currentUser) {
        // ใช้คำสั่งเพื่อป้องกันกรณีหลังบ้านบันทึกเป็นคีย์ชื่อ username หรือ name
        if (nameInput) nameInput.value = currentUser.username || currentUser.name || '';
        if (emailInput) emailInput.value = currentUser.email || '';

        // 🔥 แนะนำเพิ่มเติม (Best Practice ด้าน UX/Security):
        // เมื่อยูสเซอร์ล็อกอินแล้ว ไม่ควรปล่อยให้เขาแก้ไขชื่อและอีเมลในหน้า Checkout 
        // เพื่อป้องกันข้อมูลผู้ซื้อขัดแย้งกับสิทธิ์ของ Token บนเซิร์ฟเวอร์
        if (nameInput) nameInput.readOnly = true;
        if (emailInput) emailInput.readOnly = true;
    }

    function renderCheckout(cart) {
        const items = cart?.data?.items || [];
        const summary = cart?.data?.summary || { subtotal: 0, discountTotal: 0, total: 0 };

        tableBody.innerHTML = items.map((item) => {
            const frequency = item.frequency ? item.frequency.replace('_', '-') : '';
            const orderTypeHtml = item.orderType === 'recurring'
                ? `Recurring<br><small class="text-muted">Every ${frequency || 'monthly'}</small>`
                : 'One-time';

            return `
                <tr>
                    <td class="py-3 text-center">${item.product.name}</td>
                    <td class="py-3 text-center">${orderTypeHtml}</td>
                    <td class="py-3 text-center">$${item.unitPrice.toFixed(2)}</td>
                    <td class="py-3 text-center">${item.quantity}</td>
                    <td class="py-3 text-center">$${item.lineTotal.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        tableBody.insertAdjacentHTML('beforeend', `
            <tr>
                <th scope="row"></th>
                <td class="py-3 text-center"><p class="mb-0 text-dark">Subtotal</p></td>
                <td class="py-3 text-center"></td>
                <td class="py-3 text-center"></td>
                <td class="py-3 text-center"><p class="mb-0 text-dark">$${summary.subtotal.toFixed(2)}</p></td>
            </tr>
            <tr>
                <th scope="row"></th>
                <td class="py-3 text-center"><p class="mb-0 text-success">Recurring Discount</p></td>
                <td class="py-3 text-center"></td>
                <td class="py-3 text-center"></td>
                <td class="py-3 text-center"><p class="mb-0 text-success">-$${summary.discountTotal.toFixed(2)}</p></td>
            </tr>
            <tr>
                <th scope="row"></th>
                <td class="py-3 text-center"><p class="mb-0 text-dark text-uppercase py-3">TOTAL</p></td>
                <td class="py-3 text-center"></td>
                <td class="py-3 text-center"></td>
                <td class="py-3 text-center"><p class="mb-0 text-dark fw-bold fs-2">$${summary.total.toFixed(2)}</p></td>
            </tr>
        `);
    }

    let cartResponse;
    try {
        cartResponse = await window.EcoApi.getCart();
        renderCheckout(cartResponse);
    } catch (error) {
        console.error('Unable to load checkout cart:', error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-danger">${error.message || 'Unable to load cart'}</td></tr>`;
        return;
    }

    placeOrderBtn.addEventListener('click', async (event) => {
        event.preventDefault();

        const items = cartResponse?.data?.items || [];
        const extraPaymentInput = document.getElementById('extra-payment-input');
        const needsExtraPayment = paymentSelect && ['direct-bank-transfer', 'credit-card'].includes(paymentSelect.value);

        if (!nameInput.value.trim() || !emailInput.value.trim() || !addressInput.value.trim() || !paymentSelect.value) {
            alert('Please complete your address and payment details.');
            return;
        }

        if (needsExtraPayment && !extraPaymentInput.value.trim()) {
            alert('Please enter payment details.');
            return;
        }

        if (items.length === 0) {
            alert('Your cart is empty.');
            window.location.href = 'shop.html';
            return;
        }

        try {
            // 🌟 เปลี่ยนมาใช้ฟังก์ชันเช็คสถานะจาก JWT ที่เราสร้างไว้ใน apiClient
            const isLoggedIn = window.EcoApi.isAuthenticated(); 
            const payload = {
                address: addressInput.value.trim()
            };

            if (!isLoggedIn) {
                payload.guestName = nameInput.value.trim();
                payload.guestEmail = emailInput.value.trim();
            }

            const order = await window.EcoApi.checkout(payload);
            localStorage.removeItem('shoppingCart');
            if (typeof updateCartUI === 'function') updateCartUI({ data: { items: [] } });
            alert(`Order placed successfully: ${order.data.orderId}`);
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Checkout failed:', error);
            alert(error.message || 'Checkout failed.');
            placeOrderBtn.disabled = false;
        }
    });
});
