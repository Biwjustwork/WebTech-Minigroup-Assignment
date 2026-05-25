// ==========================================
// Cart System (ระบบตะกร้าสินค้า ข้อมูลคงอยู่เมื่อ Refresh)
// ==========================================

// 1. [จุดสำคัญ] ดึงข้อมูลตะกร้าสินค้าจาก Local Storage ทันทีเมื่อโหลดสคริปต์ (รองรับการ Refresh หน้าเว็บ)
// ทำการแปลงจาก String (JSON) กลับมาเป็น JavaScript Object ด้วย JSON.parse
let shoppingCart = JSON.parse(localStorage.getItem('shoppingCart')) || {};

const productListContainer = document.getElementById('product-list');

if (productListContainer) {
    productListContainer.addEventListener('click', function(event) {
        
        const addToCartBtn = event.target.closest('.add-to-cart-btn');
        if (!addToCartBtn) return;
        event.preventDefault();

        const productCard = addToCartBtn.closest('.product-card');
        
        if (productCard) {
            const productId = productCard.getAttribute('data-id');
            
            // เพิ่มสินค้าลงตะกร้าและอัปเดต Local Storage
            addToCart(productId);
            // เล่นอนิเมชันรูปภาพลอย
            flyToCartEffect(productCard);
        }
    });
}

// 2. ฟังก์ชันอัปเดตข้อมูลและบันทึกลง Local Storage ทุกครั้งที่มีการคลิกเพิ่มสินค้า
function addToCart(productId) {
    if (shoppingCart[productId]) {
        shoppingCart[productId].quantity += 1;
    } else {
        shoppingCart[productId] = { quantity: 1 };
    }

    // [จุดสำคัญ] บันทึก Object ตะกร้าสินค้าลง Local Storage (ต้องแปลง Object เป็น String ด้วย JSON.stringify ก่อนเซฟ)
    localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
    
    // อัปเดตตัวเลขแจ้งเตือนบนตะกร้าบนแถบ Navbar ทันที
    updateCartUI();
    console.log(`บันทึกลง Local Storage สำเร็จ! สินค้า ID: ${productId}`, shoppingCart);
}

// 3. ฟังก์ชันคำนวณและแสดงผลตัวเลขจำนวนสินค้าบนตะกร้า 
function updateCartUI() {
    const cartBadge = document.querySelector('.cart-badge'); 
    if (cartBadge) {
        let totalItems = 0;
        // วนลูปหาผลรวมจำนวนสินค้าทั้งหมดจาก Object shoppingCart
        for (const id in shoppingCart) {
            totalItems += shoppingCart[id].quantity;
        }
        // แสดงผลตัวเลขล่าสุดบนหน้าเว็บ
        cartBadge.textContent = totalItems;
    }
}

// 4. [จุดสำคัญ] สั่งให้ฟังก์ชัน updateCartUI ทำงานทันทีเมื่อโหลดหน้าเว็บเสร็จ
// ทำให้ตอนเปลี่ยนหน้า หรือกด Refresh ตัวเลขบนตะกร้าจะถูกดึงจาก Local Storage มาแสดงผลทันที ไม่กลายเป็น 0
document.addEventListener('DOMContentLoaded', updateCartUI);


// ==========================================
// Animation: รูปภาพลอยเข้าตะกร้า (Fly to Cart Effect)
// ==========================================
function flyToCartEffect(productCard) {
    const productImage = productCard.querySelector('img');
    const cartBadge = document.querySelector('.cart-badge'); 
    const cartIconTarget = cartBadge ? cartBadge.parentElement : document.querySelector('.fa-shopping-bag');

    if (!productImage || !cartIconTarget) return;

    const startPos = productImage.getBoundingClientRect();
    const endPos = cartIconTarget.getBoundingClientRect();

    const flyingImg = productImage.cloneNode();
    
    // เคลียร์คลาสเดิมทิ้ง ป้องกัน Bootstrap w-100 ทำรูปแบนยืด
    flyingImg.className = ''; 
    
    // ตั้งค่า CSS เริ่มต้นให้ขนาดและตำแหน่งเท่ากับรูปสินค้าต้นฉบับเป๊ะๆ
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

    // เริ่มอนิเมชันการพุ่งและหดตัวเป็นวงกลมขอบเขียว
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
        
        if (cartIconTarget) {
            cartIconTarget.style.transition = 'transform 0.2s';
            cartIconTarget.style.transform = 'scale(1.2)';
            setTimeout(() => cartIconTarget.style.transform = 'scale(1)', 200);
        }
    }, 800); 
}