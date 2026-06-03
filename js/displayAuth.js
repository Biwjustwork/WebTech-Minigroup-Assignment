document.addEventListener('DOMContentLoaded', () => {
    const userIconLink = document.querySelector('.navbar-nav ~ .d-flex .fa-user')?.closest('a');
    if (!userIconLink) return;

    userIconLink.style.position = 'relative';
    userIconLink.insertAdjacentHTML('beforeend', `
        <div id="authProfilePopup" class="card border border-success border-3 rounded shadow d-none position-absolute"
             style="width: 260px; right: 0; top: calc(100% + 15px); z-index: 1100; transition: all 0.2s ease-in-out;">
            <div class="card-body text-center py-4 px-3">
                <div class="mb-2">
                    <i class="fas fa-user-circle text-success" style="font-size: 3.5rem;"></i>
                </div>
                <p class="text-muted fw-bold mb-1" style="font-size: 0.7rem; letter-spacing: 0.5px;">USER ID: <span id="displayAuthId" class="text-dark">-</span></p>
                <h5 class="fw-bold text-dark mb-1" id="displayAuthName">Guest</h5>
                <p class="text-secondary mb-3 small" id="displayAuthEmail">-</p>
                <div id="authActionContainer"></div>
            </div>
        </div>
    `);

    const authPopup = document.getElementById('authProfilePopup');

    function updateAuthPopupUI() {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        const idEl = document.getElementById('displayAuthId');
        const nameEl = document.getElementById('displayAuthName');
        const emailEl = document.getElementById('displayAuthEmail');
        const actionContainer = document.getElementById('authActionContainer');

        if (isLoggedIn && currentUser) {
            idEl.textContent = (currentUser.user_id || currentUser.id || '-').toLowerCase();
            nameEl.textContent = currentUser.username || 'Member';
            emailEl.textContent = currentUser.email || '-';
            actionContainer.innerHTML = `
                <button id="btnLogout" class="btn btn-outline-danger btn-sm border-2 w-100 rounded-pill fw-bold py-2 shadow-sm">
                    <i class="fas fa-sign-out-alt me-1"></i>Logout
                </button>
            `;

            document.getElementById('btnLogout').addEventListener('click', () => {
                if (window.EcoApi) {
                    window.EcoApi.clearAuthSession();
                } else {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('currentUser');
                }
                authPopup.classList.add('d-none');
                window.location.href = 'index.html';
            });
            return;
        }

        idEl.textContent = '-';
        nameEl.textContent = 'Guest';
        emailEl.textContent = '-';
        actionContainer.innerHTML = `
            <div class="d-grid gap-2">
                <a href="login.html" class="btn btn-success btn-sm border-success border-2 w-100 rounded-pill fw-bold py-2 text-white shadow-sm">
                    <i class="fas fa-sign-in-alt me-1"></i>Login
                </a>
                <a href="register.html" class="btn btn-outline-success btn-sm border-success border-2 w-100 rounded-pill fw-bold py-2 shadow-sm">
                    <i class="fas fa-user-plus me-1"></i>Register
                </a>
            </div>
        `;
    }

    userIconLink.addEventListener('click', (event) => {
        if (event.target.closest('#authProfilePopup')) return;
        event.preventDefault();
        updateAuthPopupUI();
        authPopup.classList.toggle('d-none');
    });

    document.addEventListener('click', (event) => {
        if (!userIconLink.contains(event.target)) {
            authPopup.classList.add('d-none');
        }
    });
});
