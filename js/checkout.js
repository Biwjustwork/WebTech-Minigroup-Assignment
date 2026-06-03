/**
 * checkout.js
 * ควบคุมการแสดงผลรายการสินค้าในหน้า Checkout, การคำนวณส่วนลด 
 * ระบบ Auto-fill ข้อมูลผู้ใช้, เงื่อนไขฟอร์มชำระเงิน และบันทึก Order (Mock ERD) ลง LocalStorage
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ============================================================================
    // 1. SELECTORS: อ้างอิง Elements ในหน้า checkout.html
    // ============================================================================
    const tableBody = document.querySelector('.table tbody');
    const paymentSelect = document.querySelector('select[name="payment_method"]');
    const placeOrderBtn = document.getElementById('placeOrderBtn'); // ปุ่ม Place Order
    
    // ค้นหาช่อง Input จาก Placeholder และ Type 
    const inputs = document.querySelectorAll('.form-control');
    const nameInput = Array.from(inputs).find(el => el.placeholder.includes('name') || el.placeholder.includes('Name'));
    const emailInput = Array.from(inputs).find(el => el.type === 'email');
    const addressInput = document.querySelector('textarea'); 

    if (!tableBody || !placeOrderBtn) return; 

    // ============================================================================
    // 2. DYNAMIC PAYMENT FIELD: เพิ่มช่องกรอกบัตรเครดิต/เลขบัญชี
    // ============================================================================
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
    }
    const extraPaymentInput = document.getElementById('extra-payment-input');
    const extraPaymentLabel = document.getElementById('extra-payment-label');

    paymentSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'direct-bank-transfer') {
            extraPaymentContainer.classList.remove('d-none');
            extraPaymentLabel.innerHTML = 'Bank Account Number <sup>*</sup>';
            extraPaymentInput.placeholder = 'ระบุเลขที่บัญชีธนาคารของคุณ';
        } else if (val === 'credit-card') {
            extraPaymentContainer.classList.remove('d-none');
            extraPaymentLabel.innerHTML = 'Credit Card Number <sup>*</sup>';
            extraPaymentInput.placeholder = 'ระบุหมายเลขบัตรเครดิต 16 หลัก';
        } else {
            extraPaymentContainer.classList.add('d-none');
            extraPaymentInput.value = ''; 
        }
    });

    // ============================================================================
    // 3. AUTO-FILL USER DATA: ดึงข้อมูลจาก LocalStorage
    // ============================================================================
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

    if (isLoggedIn && currentUser) {
        if (nameInput) nameInput.value = currentUser.username || '';
        if (emailInput) emailInput.value = currentUser.email || '';
    }

    // ============================================================================
    // 4. RENDER TABLE & CALCULATE DISCOUNTS: สร้างตารางและคำนวณราคา
    // ============================================================================
    let shoppingCart = JSON.parse(localStorage.getItem('shoppingCart') || '{}');
    let products = [];
    
    try {
        const response = await fetch('backend/mock-data/products.json');
        if (response.ok) products = await response.json();
    } catch(err) {
        console.error("Failed to load products DB", err);
    }

    tableBody.innerHTML = ''; 
    let subtotal = 0;

    // [แก้บั๊กที่นี่] เปลี่ยนมาใช้ Object.entries เพื่อดึง Key ออกมาเป็น productId
    Object.entries(shoppingCart).forEach(([productId, cartItem]) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        let price = product.price;
        // ตรวจสอบว่าเป็น Recurring หรือไม่จาก orderType
        const isRecurring = cartItem.orderType === 'recurring';
        
        if (isRecurring) { price = price * 0.8; } // ลด 20%
        
        let itemTotal = price * cartItem.quantity;
        subtotal += itemTotal;

        // สร้างข้อความแสดง Order Type และดึง frequency มาใช้
        let orderTypeHtml = isRecurring 
            ? `Recurring<br><small class="text-muted">Every ${cartItem.frequency || '1 week'}</small>` 
            : `One-time`;

        let priceHtml = isRecurring 
            ? `<td class="py-3 text-center text-success">$${price.toFixed(2)}</td>` 
            : `<td class="py-3 text-center">$${price.toFixed(2)}</td>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `

            <td class="py-3 text-center">${product.name}</td>
            <td class="py-3 text-center">${orderTypeHtml}</td>
            ${priceHtml}
            <td class="py-3 text-center">${cartItem.quantity}</td>
            <td class="py-3 text-center">$${itemTotal.toFixed(2)}</td>
        `;
        tableBody.appendChild(tr);
    });

    // Subtotal
    tableBody.insertAdjacentHTML('beforeend', `
        <tr>
            <th scope="row"></th>
            <td class="py-3 text-center"><p class="mb-0 text-dark">Subtotal</p></td>
            <td class="py-3 text-center"></td>
            <td class="py-3 text-center"></td>
            <td class="py-3 text-center">
                    <p class="mb-0 text-dark">$${subtotal.toFixed(2)}</p> 
            </td>
        </tr>
    `);

    let discount = 0;
    if (subtotal > 200) {
        discount = subtotal * 0.10;
        tableBody.insertAdjacentHTML('beforeend', `
            <tr>
                <th scope="row"></th>
                <td class="py-3 text-center"><p class="mb-0 text-danger ">Discount 10%<br><small class="text-muted">(Order over $200)</small></p></td>
                </td><td class="py-3 text-center"></td>
                <td class="py-3 text-center"></td>
                <td class="py-3 text-center">
                        <p class="mb-0 text-danger">-$${discount.toFixed(2)}</p>
                </td>
            </tr>
        `);
    }

    let grandTotal = subtotal - discount;

    // TOTAL
    tableBody.insertAdjacentHTML('beforeend', `
        <tr>
            <th scope="row"></th>
            <td class="py-3 text-center"><p class="mb-0 text-dark text-uppercase py-3">TOTAL</p></td>
            <td class="py-3 text-center"></td><td class="py-3 text-center">
            <td class="py-3 text-center">
                <div>
                    <p class="mb-0 text-dark fw-bold fs-2">$${grandTotal.toFixed(2)}</p>
                </div>
            </td>
        </tr>
    `);

    // ============================================================================
    // 5. VALIDATION & PLACE ORDER LOGIC
    // ============================================================================
    placeOrderBtn.addEventListener('click', (e) => {
        e.preventDefault();

        if (!nameInput.value.trim() || !emailInput.value.trim() || !addressInput.value.trim() || !paymentSelect.value) {
            alert('⚠️ กรุณากรอกข้อมูลที่อยู่และการชำระเงินให้ครบถ้วน');
            return;
        }

        if ((paymentSelect.value === 'direct-bank-transfer' || paymentSelect.value === 'credit-card') && !extraPaymentInput.value.trim()) {
            alert('⚠️ กรุณาระบุหมายเลขบัตรเครดิต หรือ บัญชีธนาคาร');
            return;
        }

        const cartKeys = Object.keys(shoppingCart);
        if (cartKeys.length === 0) {
            alert('🛒 ตะกร้าสินค้าว่างเปล่า กรุณาเลือกสินค้าก่อนทำการสั่งซื้อ');
            window.location.href = 'shop.html';
            return;
        }

        const newOrder = {
            order_id: 'ORD-' + Math.floor(Math.random() * 100000000),
            user_id: currentUser ? currentUser.user_id : 'guest',
            order_date: new Date().toISOString(),
            status: 'Pending',
            shipping_address: addressInput.value.trim(),
            subtotal_amount: subtotal,
            discount_amount: discount,
            total_amount: grandTotal,
            customer_info: {
                name: nameInput.value.trim(),
                email: emailInput.value.trim()
            },
            payment: {
                method: paymentSelect.value,
                transaction_ref: extraPaymentInput.value.trim() || null,
                status: 'Completed' 
            },
            // จัดเรียงข้อมูลสินค้าลงฐานข้อมูล
            order_items: Object.entries(shoppingCart).map(([productId, item]) => {
                const product = products.find(p => p.id === productId);
                let price = product ? product.price : 0;
                let name = product ? product.name : 'Unknown';
                
                // เช็กเงื่อนไขใหม่ให้ตรงกับ Key ของตะกร้า
                const isRecurring = item.orderType === 'recurring'; 
                if (isRecurring) price = price * 0.8; 
                
                return {
                    product_id: productId,
                    name: name,
                    unit_price: price,
                    quantity: item.quantity,
                    is_recurring: isRecurring,
                    frequency: item.frequency || null
                };
            })
        };

        let ordersDB = JSON.parse(localStorage.getItem('ordersDB') || '[]');
        ordersDB.push(newOrder);
        localStorage.setItem('ordersDB', JSON.stringify(ordersDB));

        localStorage.removeItem('shoppingCart');
        alert('🎉 สั่งซื้อสินค้าสำเร็จ! ข้อมูลคำสั่งซื้อถูกบันทึกเข้าระบบเรียบร้อยแล้ว');
        window.location.href = 'index.html'; 
    });
});