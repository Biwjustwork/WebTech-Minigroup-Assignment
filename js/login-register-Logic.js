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

    // ใช้ Event Delegation โดยผูก Listener ไว้ที่ระดับ Parent (ในที่นี้คือ document)
    document.addEventListener('click', function (event) {
        // เช็คว่าสิ่งที่ถูกคลิก (หรือ parent ของมัน) คือปุ่ม toggle รหัสผ่านหรือไม่
        const toggleButton = event.target.closest('.togglePassword, #togglePassword');
        
        // ถ้าไม่ได้คลิกที่ปุ่ม toggle ให้หยุดการทำงาน (ข้ามไปเลย)
        if (!toggleButton) return;

        const targetId = toggleButton.getAttribute('data-target') || 'password';
        const passwordInput = document.getElementById(targetId);
        const icon = toggleButton.querySelector('.toggleIcon') || document.getElementById('toggleIcon');
        
        if (!passwordInput || !icon) return;

        const showPassword = passwordInput.type === 'password';
        passwordInput.type = showPassword ? 'text' : 'password';
        icon.classList.toggle('fa-eye', !showPassword);
        icon.classList.toggle('fa-eye-slash', showPassword);
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
            
            // เช็ค Email Pattern
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            
            // เพิ่ม Regex สำหรับเช็ครหัสผ่าน: พิมพ์ใหญ่, พิมพ์เล็ก, ตัวเลข, สัญลักษณ์ และยาวอย่างน้อย 8 ตัวอักษร
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
            const passwordValid = passwordRegex.test(password);

            usernameInput.classList.toggle('is-invalid', username.length < 3);
            emailInput.classList.toggle('is-invalid', !emailValid);
            
            // เปลี่ยนจากเช็คแค่ความยาว มาใช้ Regex แทน
            passwordInput.classList.toggle('is-invalid', !passwordValid);
            confirmPasswordInput.classList.toggle('is-invalid', password !== confirmPassword || !password);

            // แจ้งเตือนเมื่อข้อมูลไม่ตรงตามเงื่อนไข
            if (username.length < 3 || !emailValid || !passwordValid || password !== confirmPassword) {
                // อัปเดตข้อความแจ้งเตือนเพื่อให้ User ทราบเงื่อนไขรหัสผ่าน
                if (!passwordValid) {
                    showAlert('รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และสัญลักษณ์พิเศษ');
                } else if (password !== confirmPassword) {
                    showAlert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
                } else {
                    showAlert('กรุณาตรวจสอบข้อมูลฟอร์มให้ถูกต้องและลองอีกครั้ง');
                }
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
