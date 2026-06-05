document.addEventListener('DOMContentLoaded', async () => {
    const homeProductList = document.getElementById('home-product-list');
    const categoryTabs = document.getElementById('category-tabs');

    if (!homeProductList) return;

    let allProducts = [];

    try {
        // Fetch products dynamically from the backend API
        const response = await window.EcoApi.listProducts();
        allProducts = response?.data || [];
        renderProducts(allProducts);
    } catch (error) {
        console.error('Failed to load products for homepage:', error);
        homeProductList.innerHTML = `
            <div class="col-12 text-center text-danger my-5">
                <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                <p>Unable to load products. ${error.message || 'Please try again later.'}</p>
            </div>
        `;
        return;
    }

    let filterTimeout;

    // Shows a premium circular loading spinner
    function showLoadingState() {
        homeProductList.innerHTML = `
            <div class="col-12 text-center py-5 my-5">
                <div class="spinner-border text-success" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted fw-bold">Loading products...</p>
            </div>
        `;
    }

    // Category filtering with dynamic loading skeleton and debouncing
    if (categoryTabs) {
        categoryTabs.addEventListener('click', (event) => {
            const tabLink = event.target.closest('[data-category]');
            if (!tabLink) return;

            event.preventDefault();

            // Toggle active state on tabs
            categoryTabs.querySelectorAll('a').forEach(el => el.classList.remove('active'));
            tabLink.classList.add('active');

            const category = tabLink.getAttribute('data-category');

            // 1. Instantly display loading skeleton
            showLoadingState();

            // 2. Debounce implementation
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(() => {
                if (category === 'all') {
                    renderProducts(allProducts);
                } else {
                    // Filter products matching category name
                    const filtered = allProducts.filter(p => p.category === category);
                    renderProducts(filtered);
                }
            }, 350); // 350ms debounce
        });
    }

    // Renders the list of products dynamically
    function renderProducts(products) {
        if (products.length === 0) {
            homeProductList.innerHTML = `
                <div class="col-12 text-center my-5 py-5 text-muted">
                    <i class="fas fa-folder-open fa-3x mb-3 text-secondary"></i>
                    <p class="fs-5">No products available in this category.</p>
                </div>
            `;
            return;
        }

        homeProductList.innerHTML = products.map(product => {
            // Price calculations:
            // Regular price is product.price. Recurring discount is 20% off regular price.
            const regularPrice = Number(product.price).toFixed(2);
            const recurringPrice = (Number(product.price) * 0.8).toFixed(2);

            return `
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <div class="rounded position-relative fruite-item border border-secondary border-1" data-id="${product.id}">
                        <div class="fruite-img">
                            <img src="${product.image}" class="img-fluid w-100 rounded-top" alt="${product.name}" style="height: 250px; object-fit: cover;">
                        </div>
                        <div class="text-white bg-secondary px-3 py-1 rounded position-absolute" style="top: 10px; left: 10px;">${product.category}</div>
                        <div class="p-4 rounded-bottom" style="background-color: #f8f9fa;">
                            <h4 class="text-dark fs-5 fw-bold mb-2">${product.name}</h4>
                            <p class="text-muted small mb-3 text-truncate-2" style="height: 40px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                                ${product.description || ''}
                            </p>
                            <p class="text-success mb-3 fw-bold small"><i class="fas fa-sync-alt me-1"></i> Recurring: Save 20%</p>
                            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <p class="text-dark fs-5 fw-bold mb-0">
                                    <del class="text-muted fs-6 me-1">$${regularPrice}</del> $${recurringPrice}/mo
                                </p>
                                <button type="button" class="btn add-to-cart-btn border border-secondary rounded-pill px-3 py-1 text-success bg-white btn-sm">
                                    <i class="fa fa-shopping-bag me-1 text-success"></i> Add to cart
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Add to cart event listener with flying cart animation effect
    homeProductList.addEventListener('click', async (event) => {
        const addToCartBtn = event.target.closest('.add-to-cart-btn');
        if (!addToCartBtn) return;

        event.preventDefault();
        const productCard = addToCartBtn.closest('.fruite-item');
        const productId = productCard?.getAttribute('data-id');
        if (!productId) return;

        // Call global addToCart function
        if (typeof addToCart === 'function') {
            addToCartBtn.disabled = true; // Temporary disable to avoid double click
            const success = await addToCart(productId);
            addToCartBtn.disabled = false;

            if (success && typeof flyToCartEffect === 'function') {
                flyToCartEffect(productCard);
            }
        }
    });
});
