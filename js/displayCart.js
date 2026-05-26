// ==========================================
// displayCart.js (ระบบแสดงผลและจัดการตะกร้าสินค้า)
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.querySelector('table tbody');
    const summaryContainer = document.querySelector('.row.justify-content-end .col-sm-8'); // เลือกกล่อง Cart Total
    
    // ดึงข้อมูลตะกร้าจาก Local Storage
    let shoppingCart = JSON.parse(localStorage.getItem('shoppingCart')) || {};
    let products = [];

    // 1. Fetch ข้อมูลสินค้าทั้งหมดจาก Mock Data
    try {
        const response = await fetch('backend/mock-data/products.json');
        products = await response.json();
        renderCart(); // เรียกใช้งานฟังก์ชันเพื่อวาดตาราง
    } catch (error) {
        console.error('Error fetching products:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">ไม่สามารถโหลดข้อมูลสินค้าได้</td></tr>';
        return;
    }

    // 2. ฟังก์ชันบันทึกตะกร้าและอัปเดต UI แถบ Navbar (ใช้ updateCartUI จาก cartSystem.js)
    function saveCart() {
        localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
        if (typeof updateCartUI === 'function') updateCartUI();
    }

    // 3. ฟังก์ชันสำหรับวาด UI ตารางและสรุปยอดรวม
    function renderCart() {
        // หากไม่มีสินค้าในตะกร้า
        if (Object.keys(shoppingCart).length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5"><h4>ไม่มีสินค้าในตะกร้าของคุณ</h4><a href="shop.html" class="btn btn-success mt-3">ไปช้อปปิ้งเลย</a></td></tr>';
            if(summaryContainer) summaryContainer.innerHTML = ''; // ซ่อนกล่องรวมยอด
            return;
        }

        let tbodyHTML = '';
        let subtotal = 0;
        let totalDiscount = 0;

        // วนลูปตาม ID สินค้าที่มีใน Local Storage
        for (const [id, item] of Object.entries(shoppingCart)) {
            const product = products.find(p => p.id === id);
            if (!product) continue;

            // กำหนดค่าตั้งต้น หากเพิ่งหยิบใส่ตะกร้าครั้งแรก
            if (!item.orderType) {
                item.orderType = 'one-time';
            }
            
            // เช็คว่าถ้าเป็น one-time ให้ frequency เป็น null
            if (item.orderType === 'one-time') {
                item.frequency = null;
            } else if (!item.frequency) {
                item.frequency = 'monthly'; // ค่าเริ่มต้นของ recurring
            }

            const qty = item.quantity;
            const price = product.price;
            const itemSubtotal = price * qty;
            
            // คำนวณระบบ Discount 20% เฉพาะ Recurring
            let discount = 0;
            let displayFrequency = 'none'; // ซ่อน Dropdown ถี่ยกเว้นเลือก Recurring

            if (item.orderType === 'recurring') {
                discount = itemSubtotal * 0.20;
                displayFrequency = 'block'; // แสดง Dropdown ความถี่
            }
            
            const itemTotal = itemSubtotal - discount;

            subtotal += itemSubtotal;
            totalDiscount += discount;

            // สร้าง HTML แถวตาราง (UI เหมือนใน cart.html ที่ปรับปรุงแล้ว)
            tbodyHTML += `
                <tr data-id="${id}">
                    <th scope="row">
                        <div class="d-flex align-items-center">
                            <img src="${product.image}" class="img-fluid me-3 rounded-circle border p-1 bg-success" style="width: 100px; height: 100px;" alt="${product.name}">
                        </div>
                    </th>
                    <td>
                        <p class="mb-0 mt-4">${product.name}</p>
                    </td>
                    <td>
                        <select class="form-select mt-3 order-type-select" style="width: 140px;">
                            <option value="one-time" ${item.orderType === 'one-time' ? 'selected' : ''}>One-time</option>
                            <option value="recurring" ${item.orderType === 'recurring' ? 'selected' : ''}>Recurring</option>
                        </select>
                        <select class="form-select mt-2 frequency-select" style="width: 140px; display: ${displayFrequency};">
                            <option value="weekly" ${item.frequency === 'weekly' ? 'selected' : ''}>Every 1 Week</option>
                            <option value="bi-weekly" ${item.frequency === 'bi-weekly' ? 'selected' : ''}>Every 2 Weeks</option>
                            <option value="monthly" ${item.frequency === 'monthly' ? 'selected' : ''}>Every 1 Month</option>
                        </select>
                    </td>
                    <td>
                        <p class="mb-0 mt-4">${price.toFixed(2)} $</p>
                    </td>
                    <td>
                        <div class="input-group quantity mt-4" style="width: 100px;">
                            <div class="input-group-btn">
                                <button class="btn btn-sm btn-minus rounded-circle bg-white border">
                                    <i class="fa fa-minus"></i>
                                </button>
                            </div>
                            <input type="text" class="form-control form-control-sm text-center border-0 bg-transparent" value="${qty}" readonly>
                            <div class="input-group-btn">
                                <button class="btn btn-sm btn-plus rounded-circle bg-white border">
                                    <i class="fa fa-plus"></i>
                                </button>
                            </div>
                        </div>
                    </td>
                    <td>
                        <p class="mb-0 mt-4 text-success">-${discount.toFixed(2)} $</p>
                    </td>
                    <td>
                        <p class="mb-0 mt-4 fw-bold">${itemTotal.toFixed(2)} $</p>
                    </td>
                    <td>
                        <button class="btn btn-md rounded-circle bg-white border mt-4 btn-remove">
                            <i class="fa fa-times text-danger"></i>
                        </button>
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = tbodyHTML;
        renderSummary(subtotal, totalDiscount);
    }

    // 4. ฟังก์ชันแสดงกล่องสรุปยอดรวม (Cart Total)
    function renderSummary(subtotal, totalDiscount) {
        if (!summaryContainer) return;
        const finalTotal = subtotal - totalDiscount;

        summaryContainer.innerHTML = `
            <div class="p-4">
                <div class="d-flex justify-content-between mb-4">
                    <h5 class="mb-0 me-4">Subtotal:</h5>
                    <p class="mb-0">$${subtotal.toFixed(2)}</p>
                </div>
                <div class="d-flex justify-content-between mb-4">
                    <h5 class="mb-0 me-4 text-success">Discount (20%):</h5>
                    <p class="mb-0 text-success">-$${totalDiscount.toFixed(2)}</p>
                </div>
                <div class="py-4 mb-4 border-top border-bottom d-flex justify-content-between">
                    <h5 class="mb-0 ps-4 me-4">Total</h5>
                    <h5 class="mb-0 pe-4 text-success fw-bold">$${finalTotal.toFixed(2)}</h5>
                </div>
                <button class="btn btn-success rounded-pill px-4 py-3 text-uppercase w-100" type="button" onclick="window.location.href='checkout.html'">Proceed Checkout</button>
            </div>
        `;
    }

    // 5. จัดการ Event (เพิ่ม/ลด จำนวน, ลบสินค้า, เปลี่ยนประเภทออเดอร์) ด้วย Event Delegation
    tbody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;
        const id = tr.getAttribute('data-id');

        // กรณีคลิกปุ่ม + (เพิ่มจำนวน)
        if (e.target.closest('.btn-plus')) {
            shoppingCart[id].quantity += 1;
            saveCart();
            renderCart();
        }

        // กรณีคลิกปุ่ม - (ลดจำนวน)
        if (e.target.closest('.btn-minus')) {
            if (shoppingCart[id].quantity > 1) {
                shoppingCart[id].quantity -= 1;
            } else {
                shoppingCart[id].quantity = 1; // ลบออกถ้าจำนวนเหลือน้อยกว่า 1
            }
            saveCart();
            renderCart();
        }

        // กรณีคลิกปุ่ม x (ลบสินค้า)
        if (e.target.closest('.btn-remove')) {
            delete shoppingCart[id];
            saveCart();
            renderCart();
        }
    });

    // ตรวจจับการเปลี่ยน Dropdown
    tbody.addEventListener('change', (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;
        const id = tr.getAttribute('data-id');

        // หากเปลี่ยน Order Type (One-time / Recurring)
        if (e.target.classList.contains('order-type-select')) {
            const selectedType = e.target.value;
            shoppingCart[id].orderType = selectedType;
            
            // เพิ่ม Logic เช็คค่า One-time
            if (selectedType === 'one-time') {
                shoppingCart[id].frequency = null; // หรือจะใช้ "null" (เป็น String) ก็ได้
            } else if (selectedType === 'recurring' && !shoppingCart[id].frequency) {
                // ถ้าเปลี่ยนเป็น recurring แล้วยังไม่มีค่า frequency ให้ตั้งค่าเริ่มต้นเป็น monthly
                shoppingCart[id].frequency = 'monthly'; 
            }

            saveCart();
            renderCart(); // โหลด UI ใหม่เพื่อแสดง/ซ่อน ส่วนลด และ Dropdown Refill
        }

        // หากเปลี่ยน ความถี่ในการจัดส่ง (Refill Frequency)
        if (e.target.classList.contains('frequency-select')) {
            shoppingCart[id].frequency = e.target.value;
            saveCart();
        }
    });
});