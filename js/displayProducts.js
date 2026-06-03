// ==========================================
// 1. Global States
// ==========================================
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const itemsPerPage = 6;

let currentCategory = 'All';
let currentKeyword = '';
let currentMaxPrice = Infinity;

// ตัวแปรสำหรับเก็บ Timer ของ Debounce
let debounceTimeout = null; 

async function fetchProducts(path) {
    if (window.EcoApi) {
        const result = await window.EcoApi.listProducts('?limit=50');
        return result.data || [];
    }

    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
}

// ==========================================
// 2. Debouncing & Core Logic
// ==========================================

/**
 * ฟังก์ชันแสดง Loading UI แบบชั่วคราว
 */
function showLoadingUI() {
    const productContainer = document.getElementById('product-list');
    productContainer.innerHTML = `
        <div class="col-12 text-center py-5 my-5">
            <div class="spinner-border text-success" role="status" style="width: 3rem; height: 3rem;"></div>
            <h5 class="mt-3 text-muted">กำลังอัปเดตข้อมูล...</h5>
        </div>
    `;
}

/**
 * ฟังก์ชันประมวลผลหลัก (ตัวนี้ถูกครอบด้วย Debouncing)
 * หน้าที่: คำนวณฟิลเตอร์ -> คำนวณหน้า -> สั่ง Render
 */
function processAndRender() {
    // 1. เคลียร์ Timeout เดิมทิ้ง (ถ้าผู้ใช้ยังสั่งงานต่อเนื่อง)
    if (debounceTimeout) clearTimeout(debounceTimeout);
    
    // 2. แสดง Loading ขึ้นมาทันทีที่เริ่มพิมพ์หรือคลิก
    showLoadingUI();

    // 3. ตั้งเวลาหน่วง (Debounce Time: 400 มิลลิวินาที)
    debounceTimeout = setTimeout(() => {
        // --- ส่วนที่ 1: กรองข้อมูล (Filter) ---
        filteredProducts = allProducts.filter(p => {
            const matchCategory = currentCategory === 'All' || p.category === currentCategory;
            const matchKeyword = p.name.toLowerCase().includes(currentKeyword) || p.category.toLowerCase().includes(currentKeyword);
            const matchPrice = p.price <= currentMaxPrice;
            return matchCategory && matchKeyword && matchPrice;
        });

        // --- ส่วนที่ 2: แบ่งหน้า (Pagination) ---
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const productsToShow = filteredProducts.slice(startIndex, endIndex);

        // --- ส่วนที่ 3: อัปเดต UI ---
        renderUI(productsToShow, filteredProducts.length);
    }, 400); // หากต้องการให้เร็วหรือช้ากว่านี้ ปรับตัวเลข 400 (ms) ได้เลยครับ
}


// ==========================================
// 3. ระบบ Render UI
// ==========================================

function renderUI(products, totalItems) {
    const productContainer = document.getElementById('product-list');

    if (!products || products.length === 0) {
        productContainer.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-box-open fa-3x text-muted mb-3"></i>
                <h4 class="text-secondary">ไม่พบสินค้าในเงื่อนไขที่คุณเลือก</h4>
                <p class="text-muted">ลองขยายช่วงราคา ค้นหาด้วยคำอื่น หรือเลือกดูสินค้าทั้งหมด</p>
                <button class="btn btn-outline-success mt-2" onclick="resetFilters()">ล้างตัวกรองทั้งหมด</button>
            </div>`;
        return;
    }

    let html = products.map(product => {
        return `
            <div class="col-md-6 col-lg-6 col-xl-4 d-flex">
                <div class="rounded position-relative fruite-item product-card d-flex flex-column w-100" data-id="${product.id}">
                    <div class="fruite-img">
                        <img src="${product.image}" class="img-fluid w-100 rounded-top" alt="${product.name}" style="aspect-ratio: 1/1; object-fit: cover;" onerror="this.src='img/placeholder.jpg'">
                    </div>
                    <div class="text-white bg-success px-3 py-1 rounded position-absolute" style="top: 10px; left: 10px;">${product.category}</div>
                    
                    <div class="p-4 border border-success border-3 border-top-0 rounded-bottom bg-white d-flex flex-column flex-grow-1">
                        <h4 class="text-truncate" title="${product.name}">${product.name}</h4>
                        
                        <p title="${product.description}">${product.description}</p>
                        
                        <div class="mt-auto">
                            <div class="mb-4 text-start">
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="text-dark">One-time:</span>
                                    <span class="text-dark fw-bold">$${product.price.toFixed(2)}</span>
                                </div>
                                <div class="d-flex justify-content-between">
                                    <span class="text-success">Recurring (for members):</span>
                                    <span class="text-success fw-bold">$${(product.price * 0.8).toFixed(2)}</span>
                                </div>
                            </div>

                            <div class="d-flex justify-content-between flex-lg-wrap">
                                <button class="btn border border-success border-3 rounded-pill px-3 text-success add-to-cart-btn w-100">
                                    <i class="fa fa-shopping-bag me-2"></i> Add to cart
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages > 1) {
        html += `<div class="col-12"><div class="pagination d-flex justify-content-center mt-5">`;
        
        const firstDisabled = currentPage === 1 ? 'pointer-events: none; opacity: 0.5;' : '';
        html += `<a href="#" class="rounded" style="${firstDisabled}" onclick="changePage(1, event)" title="หน้าแรก">&laquo;</a>`;

        const prevDisabled = currentPage === 1 ? 'pointer-events: none; opacity: 0.5;' : '';
        html += `<a href="#" class="rounded" style="${prevDisabled}" onclick="changePage(${currentPage - 1}, event)" title="หน้าก่อนหน้า">&lsaquo;</a>`;
        
        for (let i = 1; i <= totalPages; i++) {
            const activeClass = currentPage === i ? 'active' : '';
            html += `<a href="#" class="rounded ${activeClass}" onclick="changePage(${i}, event)">${i}</a>`;
        }
        
        const nextDisabled = currentPage === totalPages ? 'pointer-events: none; opacity: 0.5;' : '';
        html += `<a href="#" class="rounded" style="${nextDisabled}" onclick="changePage(${currentPage + 1}, event)" title="หน้าถัดไป">&rsaquo;</a>`;

        const lastDisabled = currentPage === totalPages ? 'pointer-events: none; opacity: 0.5;' : '';
        html += `<a href="#" class="rounded" style="${lastDisabled}" onclick="changePage(${totalPages}, event)" title="หน้าสุดท้าย">&raquo;</a>`;
        
        html += `</div></div>`;
    }

    productContainer.innerHTML = html;
}

// ==========================================
// 4. Action Handlers (เชื่อมเข้ากับ Debounce)
// ==========================================

function changePage(page, event) {
    if (event) event.preventDefault();
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (page < 1 || page > totalPages) return; 

    currentPage = page; 
    processAndRender(); // ใช้ processAndRender แทน render ตรงๆ เพื่อให้แสดง Loading
    
    // เลื่อนหน้าจอขึ้นทันที เพื่อให้เห็น Spinner
    document.getElementById('product-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applyFilters() {
    currentPage = 1; 
    processAndRender(); // ใช้ processAndRender เพื่อทริกเกอร์ Debounce + Loading
}

function setupPriceFilter() {
    const rangeInput = document.getElementById('rangeInput');
    const amountOutput = document.getElementById('amount');
    if (!rangeInput || !amountOutput) return;

    const maxProductPrice = Math.max(...allProducts.map(p => p.price));
    const maxLimit = Math.ceil(maxProductPrice / 5) * 5;

    rangeInput.min = 0;
    rangeInput.max = maxLimit;
    rangeInput.step = 5; 
    rangeInput.value = maxLimit; 
    amountOutput.innerHTML = maxLimit;
    currentMaxPrice = maxLimit; 

    rangeInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        amountOutput.innerHTML = val; // เปลี่ยนตัวเลขทันทีไม่ต้องรอ Debounce
        currentMaxPrice = val;        
        applyFilters(); // ส่งต่อให้ Debounce จัดการ
    });
}

function renderCategories(products) {
    const categoryContainer = document.querySelector('.product-categorie'); 
    if (!categoryContainer) return;

    const categoryCount = products.reduce((acc, product) => {
        acc[product.category] = (acc[product.category] || 0) + 1;
        return acc;
    }, {});

    let categoryHTML = `
        <li>
            <div class="d-flex justify-content-between product-name">
                <a href="#" onclick="filterByCategory('All', event)" class="${currentCategory === 'All' ? 'fw-bold text-success' : ''}">
                    <i class="fas fa-list me-2 text-success"></i>All Products
                </a>
                <span class="badge bg-secondary rounded-pill align-self-center">${products.length}</span>
            </div>
        </li>
    `;

    for (const [category, count] of Object.entries(categoryCount)) {
        categoryHTML += `
            <li>
                <div class="d-flex justify-content-between product-name">
                    <a href="#" onclick="filterByCategory('${category}', event)" class="${currentCategory === category ? 'fw-bold text-success' : ''}">
                        <i class="fas fa-tag me-2 text-success"></i>${category}
                    </a>
                    <span class="badge bg-light text-dark rounded-pill border align-self-center">${count}</span>
                </div>
            </li>
        `;
    }
    categoryContainer.innerHTML = categoryHTML;
}

function filterByCategory(category, event) {
    event.preventDefault();
    currentCategory = category;
    renderCategories(allProducts); 
    applyFilters();
}

function setupSearchEvents() {
    const searchInputs = document.querySelectorAll('input[type="search"]');
    
    searchInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            currentKeyword = e.target.value.toLowerCase().trim();
            applyFilters();
        });
    });
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || '';
}

function applySearchQueryFromURL() {
    const urlKeyword = getQueryParam('q').trim();
    if (!urlKeyword) return;

    currentKeyword = urlKeyword.toLowerCase();
    document.querySelectorAll('input[type="search"]').forEach(input => input.value = urlKeyword);
}

function resetFilters() {
    currentCategory = 'All';
    currentKeyword = '';
    
    document.querySelectorAll('input[type="search"]').forEach(input => input.value = '');
    
    const rangeInput = document.getElementById('rangeInput');
    const amountOutput = document.getElementById('amount');
    const maxProductPrice = Math.max(...allProducts.map(p => p.price));
    const maxLimit = Math.ceil(maxProductPrice / 5) * 5;
    
    if (rangeInput && amountOutput) {
        rangeInput.value = maxLimit;
        amountOutput.innerHTML = maxLimit;
        currentMaxPrice = maxLimit;
    }

    renderCategories(allProducts);
    applyFilters();
}

// ==========================================
// 5. Main Initialization
// ==========================================

async function requestProducts() {
    try {
        showLoadingUI();

        allProducts = await fetchProducts('backend/mock-data/products.json');
        
        setupPriceFilter();
        renderCategories(allProducts);
        setupSearchEvents();
        applySearchQueryFromURL();
        
        // ข้ามไปเรียก processAndRender ทันทีเพื่อแสดงหน้าแรก
        processAndRender(); 

    } catch (error) {
        console.error("Fetch Error:", error);
        document.getElementById('product-list').innerHTML = `
            <div class="col-12 text-center py-5 text-danger">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i>
                <h4 class="text-dark">ขออภัย ไม่สามารถโหลดข้อมูลสินค้าได้</h4>
                <p class="text-muted">ระบบเกิดข้อผิดพลาด (${error.message})</p>
                <button class="btn btn-outline-success mt-3" onclick="requestProducts()">
                    <i class="fas fa-redo me-2"></i> ลองใหม่อีกครั้ง
                </button>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', requestProducts);
