document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.querySelector('table tbody');
    const summaryContainer = document.querySelector('.row.justify-content-end .col-sm-8');
    if (!tbody) return;

    let cartResponse = null;

    function renderEmpty(message = 'Your cart is empty') {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-5">
                    <h4>${message}</h4>
                    <a href="shop.html" class="btn btn-success mt-3">Go shopping</a>
                </td>
            </tr>
        `;
        if (summaryContainer) summaryContainer.innerHTML = '';
    }

    function renderSummary(summary) {
        if (!summaryContainer) return;
        summaryContainer.innerHTML = `
            <div class="p-4">
                <div class="d-flex justify-content-between mb-4">
                    <h5 class="mb-0 me-4">Subtotal:</h5>
                    <p class="mb-0">$${summary.subtotal.toFixed(2)}</p>
                </div>
                <div class="d-flex justify-content-between mb-4">
                    <h5 class="mb-0 me-4 text-success">Recurring Discount:</h5>
                    <p class="mb-0 text-success">-$${summary.discountTotal.toFixed(2)}</p>
                </div>
                <div class="py-4 mb-4 border-top border-bottom d-flex justify-content-between">
                    <h5 class="mb-0 ps-4 me-4">Total</h5>
                    <h5 class="mb-0 pe-4 text-success fw-bold">$${summary.total.toFixed(2)}</h5>
                </div>
                <button class="btn btn-success rounded-pill px-4 py-3 text-uppercase w-100" type="button" onclick="window.location.href='checkout.html'">Proceed Checkout</button>
            </div>
        `;
    }

    function renderCart(cart) {
        const items = cart?.data?.items || [];
        if (items.length === 0) {
            renderEmpty();
            return;
        }

        tbody.innerHTML = items.map((item) => {
            const product = item.product;
            const frequency = item.frequency ? item.frequency.replace('_', '-') : 'monthly';
            const displayFrequency = item.orderType === 'recurring' ? 'block' : 'none';

            return `
                <tr data-id="${item.productId}">
                    <th scope="row">
                        <div class="d-flex align-items-center">
                            <img src="${product.image}" class="img-fluid me-3 rounded-circle border p-1 bg-success" style="width: 100px; height: 100px;" alt="${product.name}">
                        </div>
                    </th>
                    <td><p class="mb-0 mt-4">${product.name}</p></td>
                    <td>
                        <select class="form-select mt-3 order-type-select" style="width: 140px;">
                            <option value="one-time" ${item.orderType === 'one-time' ? 'selected' : ''}>One-time</option>
                            <option value="recurring" ${item.orderType === 'recurring' ? 'selected' : ''}>Recurring</option>
                        </select>
                        <select class="form-select mt-2 frequency-select" style="width: 140px; display: ${displayFrequency};">
                            <option value="weekly" ${frequency === 'weekly' ? 'selected' : ''}>Every 1 Week</option>
                            <option value="bi-weekly" ${frequency === 'bi-weekly' ? 'selected' : ''}>Every 2 Weeks</option>
                            <option value="monthly" ${frequency === 'monthly' ? 'selected' : ''}>Every 1 Month</option>
                        </select>
                    </td>
                    <td><p class="mb-0 mt-4">${item.unitPrice.toFixed(2)} $</p></td>
                    <td>
                        <div class="input-group quantity mt-4" style="width: 100px;">
                            <div class="input-group-btn">
                                <button class="btn btn-sm btn-minus rounded-circle bg-white border"><i class="fa fa-minus"></i></button>
                            </div>
                            <input type="text" class="form-control form-control-sm text-center border-0 bg-transparent" value="${item.quantity}" readonly>
                            <div class="input-group-btn">
                                <button class="btn btn-sm btn-plus rounded-circle bg-white border"><i class="fa fa-plus"></i></button>
                            </div>
                        </div>
                    </td>
                    <td><p class="mb-0 mt-4 text-success">-${item.discount.toFixed(2)} $</p></td>
                    <td><p class="mb-0 mt-4 fw-bold">${item.lineTotal.toFixed(2)} $</p></td>
                    <td>
                        <button class="btn btn-md rounded-circle bg-white border mt-4 btn-remove">
                            <i class="fa fa-times text-danger"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        renderSummary(cart.data.summary);
    }

    async function loadCart() {
        try {
            cartResponse = await window.EcoApi.getCart();
            localStorage.setItem('shoppingCart', JSON.stringify(window.EcoApi.normalizeCartForLocalStorage(cartResponse)));
            if (typeof updateCartUI === 'function') updateCartUI(cartResponse);
            renderCart(cartResponse);
        } catch (error) {
            console.error('Unable to load cart:', error);
            renderEmpty(error.message || 'Unable to load cart');
        }
    }

    async function updateItem(productId, changes) {
        const currentItem = cartResponse.data.items.find((item) => item.productId === productId);
        if (!currentItem) return;

        const nextItem = {
            productId,
            quantity: currentItem.quantity,
            orderType: currentItem.orderType,
            frequency: currentItem.frequency ? currentItem.frequency.replace('_', '-') : undefined,
            ...changes
        };

        cartResponse = await window.EcoApi.updateCartItem(productId, nextItem);
        localStorage.setItem('shoppingCart', JSON.stringify(window.EcoApi.normalizeCartForLocalStorage(cartResponse)));
        if (typeof updateCartUI === 'function') updateCartUI(cartResponse);
        renderCart(cartResponse);
    }

    tbody.addEventListener('click', async (event) => {
        const tr = event.target.closest('tr[data-id]');
        if (!tr) return;

        const productId = tr.getAttribute('data-id');
        const currentItem = cartResponse?.data?.items.find((item) => item.productId === productId);
        if (!currentItem) return;

        try {
            if (event.target.closest('.btn-plus')) {
                await updateItem(productId, { quantity: currentItem.quantity + 1 });
            } else if (event.target.closest('.btn-minus')) {
                await updateItem(productId, { quantity: Math.max(1, currentItem.quantity - 1) });
            } else if (event.target.closest('.btn-remove')) {
                cartResponse = await window.EcoApi.removeCartItem(productId);
                localStorage.setItem('shoppingCart', JSON.stringify(window.EcoApi.normalizeCartForLocalStorage(cartResponse)));
                if (typeof updateCartUI === 'function') updateCartUI(cartResponse);
                renderCart(cartResponse);
            }
        } catch (error) {
            console.error('Cart update failed:', error);
            alert(error.message || 'Unable to update cart');
        }
    });

    tbody.addEventListener('change', async (event) => {
        const tr = event.target.closest('tr[data-id]');
        if (!tr) return;

        const productId = tr.getAttribute('data-id');
        try {
            if (event.target.classList.contains('order-type-select')) {
                const orderType = event.target.value;
                await updateItem(productId, {
                    orderType,
                    frequency: orderType === 'recurring' ? 'monthly' : undefined
                });
            } else if (event.target.classList.contains('frequency-select')) {
                await updateItem(productId, { frequency: event.target.value });
            }
        } catch (error) {
            console.error('Cart option update failed:', error);
            alert(error.message || 'Unable to update cart');
        }
    });

    await loadCart();
});
