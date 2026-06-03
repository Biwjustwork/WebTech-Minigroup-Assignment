(function (window) {
    const defaultBaseUrl = 'http://localhost:3001/api';
    const apiBaseUrl = (localStorage.getItem('ecoApiBaseUrl') || defaultBaseUrl).replace(/\/$/, '');

    function getToken() {
        return localStorage.getItem('authToken') || '';
    }

    function getCartSessionId() {
        return localStorage.getItem('ecoCartSessionId') || '';
    }

    function saveCartSessionId(body) {
        const sessionId = body?.data?.cartSessionId || body?.cartSessionId;
        if (sessionId) {
            localStorage.setItem('ecoCartSessionId', sessionId);
        }
    }

    function saveAuthSession(result) {
        if (result?.token) {
            localStorage.setItem('authToken', result.token);
        }

        if (result?.user) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('currentUser', JSON.stringify(result.user));
        }
    }

    function clearAuthSession() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('currentUser');
    }

    async function request(path, options = {}) {
        const headers = {
            Accept: 'application/json',
            ...(options.headers || {})
        };

        const token = getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const cartSessionId = getCartSessionId();
        if (cartSessionId) {
            headers['X-Cart-Session-Id'] = cartSessionId;
        }

        let body = options.body;
        if (body && typeof body !== 'string') {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(body);
        }

        const response = await fetch(`${apiBaseUrl}${path}`, {
            ...options,
            headers,
            body
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        saveCartSessionId(data);

        if (!response.ok) {
            const error = new Error(data?.message || data?.error?.message || `Request failed with ${response.status}`);
            error.status = response.status;
            error.payload = data;
            throw error;
        }

        return data;
    }

    function normalizeCartForLocalStorage(cartResponse) {
        const items = cartResponse?.data?.items || [];
        return items.reduce((cart, item) => {
            cart[item.productId] = {
                quantity: item.quantity,
                orderType: item.orderType,
                frequency: item.frequency ? item.frequency.replace('_', '-') : null
            };
            return cart;
        }, {});
    }

    async function syncLocalCartToBackend() {
        const localCart = JSON.parse(localStorage.getItem('shoppingCart') || '{}');
        const entries = Object.entries(localCart);
        if (entries.length === 0) return;

        for (const [productId, item] of entries) {
            await request('/cart/items', {
                method: 'POST',
                body: {
                    productId,
                    quantity: item.quantity || 1,
                    orderType: item.orderType || 'one-time',
                    frequency: item.frequency || undefined
                }
            });
        }

        localStorage.removeItem('shoppingCart');
    }

    window.EcoApi = {
        apiBaseUrl,
        clearAuthSession,
        getCart: () => request('/cart'),
        addCartItem: (item) => request('/cart/items', { method: 'POST', body: item }),
        updateCartItem: (productId, item) => request(`/cart/items/${encodeURIComponent(productId)}`, { method: 'PATCH', body: item }),
        removeCartItem: (productId) => request(`/cart/items/${encodeURIComponent(productId)}`, { method: 'DELETE' }),
        checkout: (payload) => request('/checkout', { method: 'POST', body: payload }),
        listProducts: (query = '') => request(`/products${query}`),
        login: async (payload) => {
            const result = await request('/auth/login', { method: 'POST', body: payload });
            saveAuthSession(result);
            await syncLocalCartToBackend();
            return result;
        },
        register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
        request,
        normalizeCartForLocalStorage
    };
})(window);
