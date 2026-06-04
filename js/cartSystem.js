let shoppingCart = JSON.parse(localStorage.getItem('shoppingCart') || '{}');

function persistCart(cartResponse) {
    if (window.EcoApi && cartResponse) {
        shoppingCart = window.EcoApi.normalizeCartForLocalStorage(cartResponse);
    }
    localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
}

async function addToCart(productId) {
    try {
        if (window.EcoApi) {
            // 1. ดึงข้อมูลสินค้าล่าสุดจากหลังบ้านเพื่อเช็ก stock_quantity
            const productRes = await window.EcoApi.request(`/products/${encodeURIComponent(productId)}`);
            const product = productRes?.data;
            if (!product) {
                throw new Error('Product not found.');
            }

            // 2. ดึงข้อมูลจำนวนสินค้าชิ้นนี้ที่มีอยู่แล้วในตะกร้าปัจจุบัน
            const cartResponse = await window.EcoApi.getCart();
            const currentItem = cartResponse?.data?.items?.find(item => item.productId === productId);
            const currentQuantity = currentItem ? currentItem.quantity : 0;

            // 3. ตรวจสอบว่าจำนวนใหม่จะเกินสต็อกสินค้าหรือไม่
            if (currentQuantity + 1 > product.stock_quantity) {
                alert(`Cannot add more items. Only ${product.stock_quantity} left in stock (you already have ${currentQuantity} in your cart).`);
                return false;
            }

            const cart = await window.EcoApi.addCartItem({
                productId,
                quantity: 1,
                orderType: 'one-time'
            });
            persistCart(cart);
            updateCartUI(cart);
            return true;
        }

        shoppingCart[productId] = {
            quantity: (shoppingCart[productId]?.quantity || 0) + 1
        };
        persistCart();
        updateCartUI();
        return true;
    } catch (error) {
        console.error('Add to cart failed:', error);
        alert(error.message || 'Unable to add item to cart');
        return false;
    }
}

async function updateCartUI(cartResponse) {
    const cartBadge = document.querySelector('.cart-badge');
    if (!cartBadge) return;

    if (window.EcoApi && !cartResponse) {
        try {
            cartResponse = await window.EcoApi.getCart();
            persistCart(cartResponse);
        } catch (error) {
            console.warn('Unable to load backend cart, using local cart.', error);
        }
    }

    if (cartResponse?.data?.items) {
        cartBadge.textContent = cartResponse.data.items.reduce((sum, item) => sum + item.quantity, 0);
        return;
    }

    cartBadge.textContent = Object.values(shoppingCart).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

function flyToCartEffect(productCard) {
    const productImage = productCard.querySelector('img');
    const cartBadge = document.querySelector('.cart-badge');
    const cartIconTarget = cartBadge ? cartBadge.parentElement : document.querySelector('.fa-shopping-bag');

    if (!productImage || !cartIconTarget) return;

    const startPos = productImage.getBoundingClientRect();
    const endPos = cartIconTarget.getBoundingClientRect();
    const flyingImg = productImage.cloneNode();

    flyingImg.className = '';
    flyingImg.style.position = 'fixed';
    flyingImg.style.top = `${startPos.top}px`;
    flyingImg.style.left = `${startPos.left}px`;
    flyingImg.style.width = `${startPos.width}px`;
    flyingImg.style.height = `${startPos.height}px`;
    flyingImg.style.objectFit = 'cover';
    flyingImg.style.zIndex = '9999';
    flyingImg.style.margin = '0';
    flyingImg.style.borderRadius = '5px';
    flyingImg.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)';

    document.body.appendChild(flyingImg);

    setTimeout(() => {
        flyingImg.style.top = `${endPos.top}px`;
        flyingImg.style.left = `${endPos.left + (endPos.width / 2)}px`;
        flyingImg.style.width = '25px';
        flyingImg.style.height = '25px';
        flyingImg.style.borderRadius = '50%';
        flyingImg.style.border = '3px solid #198754';
        flyingImg.style.opacity = '0.3';
    }, 50);

    setTimeout(() => {
        flyingImg.remove();
        cartIconTarget.style.transition = 'transform 0.2s';
        cartIconTarget.style.transform = 'scale(1.2)';
        setTimeout(() => cartIconTarget.style.transform = 'scale(1)', 200);
    }, 800);
}

const productListContainer = document.getElementById('product-list');
if (productListContainer) {
    productListContainer.addEventListener('click', async (event) => {
        const addToCartBtn = event.target.closest('.add-to-cart-btn');
        if (!addToCartBtn) return;

        event.preventDefault();
        const productCard = addToCartBtn.closest('.product-card');
        const productId = productCard?.getAttribute('data-id');
        if (!productId) return;

        const success = await addToCart(productId);
        if (success) {
            flyToCartEffect(productCard);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
});
