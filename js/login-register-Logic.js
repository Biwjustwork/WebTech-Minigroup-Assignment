document.addEventListener('DOMContentLoaded', () => {
    const alertContainer = document.getElementById('alertContainer');

    function showAlert(message, type = 'danger') {
        if (!alertContainer) return;
        alertContainer.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show border-2 fw-semibold" role="alert">
                <i class="fas ${type === 'danger' ? 'fa-exclamation-circle' : 'fa-check-circle'} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }

    document.querySelectorAll('.togglePassword, #togglePassword').forEach((button) => {
        button.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target') || 'password';
            const passwordInput = document.getElementById(targetId);
            const icon = this.querySelector('.toggleIcon') || document.getElementById('toggleIcon');
            if (!passwordInput || !icon) return;

            const showPassword = passwordInput.type === 'password';
            passwordInput.type = showPassword ? 'text' : 'password';
            icon.classList.toggle('fa-eye', !showPassword);
            icon.classList.toggle('fa-eye-slash', showPassword);
        });
    });

    function setLoading(button, spinner, isLoading) {
        if (button) button.disabled = isLoading;
        if (spinner) spinner.classList.toggle('d-none', !isLoading);
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');
        const loginSpinner = document.getElementById('loginSpinner');

        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            alertContainer.innerHTML = '';

            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

            emailInput.classList.toggle('is-invalid', !emailValid);
            passwordInput.classList.toggle('is-invalid', !password);

            if (!emailValid || !password) {
                showAlert('Please enter a valid email and password.');
                return;
            }

            try {
                setLoading(loginBtn, loginSpinner, true);
                const api = window.EcoApi;
                if (!api) throw new Error('API client is not loaded.');

                await api.login({ email, password });
                showAlert('Login successful. Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 700);
            } catch (error) {
                console.error('Login failed:', error);
                showAlert(error.message || 'Login failed.');
                setLoading(loginBtn, loginSpinner, false);
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const registerBtn = document.getElementById('registerBtn');
        const registerSpinner = document.getElementById('registerSpinner');

        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            alertContainer.innerHTML = '';

            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

            usernameInput.classList.toggle('is-invalid', username.length < 3);
            emailInput.classList.toggle('is-invalid', !emailValid);
            passwordInput.classList.toggle('is-invalid', password.length < 6);
            confirmPasswordInput.classList.toggle('is-invalid', password !== confirmPassword);

            if (username.length < 3 || !emailValid || password.length < 6 || password !== confirmPassword) {
                showAlert('Please check the form and try again.');
                return;
            }

            try {
                setLoading(registerBtn, registerSpinner, true);
                const api = window.EcoApi;
                if (!api) throw new Error('API client is not loaded.');

                await api.register({ username, email, password });
                showAlert('Registration successful. Please log in.', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 900);
            } catch (error) {
                console.error('Registration failed:', error);
                showAlert(error.message || 'Registration failed.');
                setLoading(registerBtn, registerSpinner, false);
            }
        });
    }
});
