/**
 * login-register-Logic.js
 * จัดการระบบ Authentication (Login & Register) สำหรับเว็บ EcoClean
 * อัปเกรด: ใช้ระบบ Mock Database ผ่าน LocalStorage โดย Seed ข้อมูลเริ่มต้นจาก users.json
 */

document.addEventListener('DOMContentLoaded', async () => {
    
    // =========================================================================
    // MOCK DATABASE INITIALIZATION
    // =========================================================================
    // ฟังก์ชันนี้จะทำหน้าที่เป็นเสมือน Backend ให้เราชั่วคราว
    async function initMockDatabase() {
        if (!localStorage.getItem('usersDB')) {
            try {
                // ดึงข้อมูลตั้งต้นจาก mock-data
                const response = await fetch('backend/mock-data/users.json');
                if (response.ok) {
                    const users = await response.json();
                    localStorage.setItem('usersDB', JSON.stringify(users));
                    console.log("Mock Database initialized successfully from users.json");
                } else {
                    throw new Error('ไม่สามารถโหลดไฟล์ users.json ได้');
                }
            } catch (error) {
                console.warn("ระบบทำงานในรูปแบบ Offline หรือหาไฟล์ไม่เจอ จะเริ่มต้นด้วย DB ว่างเปล่า", error);
                localStorage.setItem('usersDB', JSON.stringify([]));
            }
        }
    }

    // รอให้จำลอง DB เสร็จสมบูรณ์ก่อนทำงานส่วนอื่น
    await initMockDatabase();

    // Helper: ฟังก์ชันจำลองการเข้ารหัส Password
    // ใน users.json เดิม password_hash คือ "5f4dcc3b5aa765d61d8327deb882cf99" (MD5 ของคำว่า 'password')
    function mockHash(password) {
        if (password === 'password') return '5f4dcc3b5aa765d61d8327deb882cf99';
        // จำลองการเข้ารหัสอย่างง่ายสำหรับรหัสผ่านใหม่ (ใช้ Base64 ในที่นี้เพื่อการจำลอง)
        return btoa(password); 
    }

    // =========================================================================
    // UI HELPERS
    // =========================================================================
    const togglePasswordButtons = document.querySelectorAll('.togglePassword');
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function() {
            try {
                const targetId = this.getAttribute('data-target');
                const passwordInput = document.getElementById(targetId);
                const icon = this.querySelector('.toggleIcon');
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.replace('fa-eye', 'fa-eye-slash');
                    this.setAttribute('title', 'ซ่อนรหัสผ่าน');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.replace('fa-eye-slash', 'fa-eye');
                    this.setAttribute('title', 'ดูรหัสผ่าน');
                }
            } catch (error) {
                console.error("Password visibility toggle error:", error);
            }
        });
    });

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

    // =========================================================================
    // SECTION 1: LOGIC สำหรับหน้า LOGIN (login.html)
    // =========================================================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');
        const loginSpinner = document.getElementById('loginSpinner');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            alertContainer.innerHTML = '';
            emailInput.classList.remove('is-invalid');
            passwordInput.classList.remove('is-invalid');

            const emailValue = emailInput.value.trim();
            const passwordValue = passwordInput.value;
            let isValid = true;

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailValue || !emailRegex.test(emailValue)) {
                emailInput.classList.add('is-invalid');
                isValid = false;
            }
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
            if (!passwordValue || !passwordRegex.test(passwordValue)) {
                passwordInput.classList.add('is-invalid');
                isValid = false;
            }

            if (!isValid) {
                showAlert('กรุณากรอกข้อมูลในช่องที่กำหนดให้ถูกต้องสมบูรณ์');
                return;
            }

            try {
                loginBtn.disabled = true;
                loginSpinner.classList.remove('d-none');

                await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate Network Latency

                // ดึงข้อมูล User ทั้งหมดจาก Mock Database
                const usersDB = JSON.parse(localStorage.getItem('usersDB') || '[]');
                const hashedPassword = mockHash(passwordValue);

                // ตรวจสอบว่ามีผู้ใช้และรหัสผ่านตรงกันหรือไม่
                const matchedUser = usersDB.find(u => u.email === emailValue && u.password_hash === hashedPassword);

                if (matchedUser) {
                    showAlert('เข้าสู่ระบบสำเร็จ! กำลังนำคุณไปยังหน้าหลัก...', 'success');
                    
                    // อัปเดตสถานะการ Login กลับเข้าไปใน Mock Database
                    matchedUser.auth_status.is_logged_in = true;
                    matchedUser.auth_status.last_login = new Date().toISOString();
                    localStorage.setItem('usersDB', JSON.stringify(usersDB));

                    // เก็บ Session ไว้สำหรับหน้าอื่นๆ (เช่น หน้า index, cart)
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('currentUser', JSON.stringify(matchedUser));
                    
                    setTimeout(() => window.location.href = 'index.html', 1000);
                } else {
                    throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
                }
            } catch (error) {
                console.error("Login Authentication Error:", error);
                showAlert(error.message);
                loginBtn.disabled = false;
                loginSpinner.classList.add('d-none');
            }
        });
    }

    // =========================================================================
    // SECTION 2: LOGIC สำหรับหน้า REGISTER (register.html)
    // =========================================================================
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const registerBtn = document.getElementById('registerBtn');
        const registerSpinner = document.getElementById('registerSpinner');

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            alertContainer.innerHTML = '';
            [usernameInput, emailInput, passwordInput, confirmPasswordInput].forEach(el => el.classList.remove('is-invalid'));

            const usernameValue = usernameInput.value.trim();
            const emailValue = emailInput.value.trim();
            const passwordValue = passwordInput.value;
            const confirmPasswordValue = confirmPasswordInput.value;
            let isValid = true;

            if (!usernameValue || usernameValue.length < 3) {
                usernameInput.classList.add('is-invalid');
                isValid = false;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailValue || !emailRegex.test(emailValue)) {
                emailInput.classList.add('is-invalid');
                isValid = false;
            }
            
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
            if (!passwordValue || !passwordRegex.test(passwordValue)) {
                passwordInput.classList.add('is-invalid');
                isValid = false;
            }

            if (passwordValue !== confirmPasswordValue) {
                confirmPasswordInput.classList.add('is-invalid');
                isValid = false;
            }

            if (!isValid) {
                showAlert('กรุณาตรวจสอบข้อผิดพลาดและกรอกข้อมูลให้ครบถ้วนถูกต้อง');
                return;
            }

            try {
                registerBtn.disabled = true;
                registerSpinner.classList.remove('d-none');

                await new Promise(resolve => setTimeout(resolve, 1500));

                // จำลองกระบวนการเพิ่มผู้ใช้ใหม่ลง Database
                const usersDB = JSON.parse(localStorage.getItem('usersDB') || '[]');
                
                // เช็ค Email ซ้ำ
                const emailExists = usersDB.some(u => u.email === emailValue);
                if (emailExists) {
                    throw new Error('อีเมลนี้ถูกใช้งานไปแล้ว กรุณาใช้อีเมลอื่น');
                }

                // สร้าง Object ผู้ใช้ใหม่ ตาม Schema ใน users.json
                const newUser = {
                    user_id: Date.now().toString(), // สร้าง ID แบบง่ายๆ จาก Timestamp
                    username: usernameValue,
                    email: emailValue,
                    password_hash: mockHash(passwordValue),
                    registration_date: new Date().toISOString(),
                    auth_status: {
                        is_logged_in: false,
                        token: null,
                        last_login: null
                    }
                };

                // เพิ่มเข้า DB จำลองและ Save กลับไปที่ LocalStorage
                usersDB.push(newUser);
                localStorage.setItem('usersDB', JSON.stringify(usersDB));

                showAlert('สมัครสมาชิกเสร็จสมบูรณ์! ระบบกำลังพาท่านไปหน้าเข้าสู่ระบบ...', 'success');
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);

            } catch (error) {
                console.error("Registration Processing Error:", error);
                showAlert(error.message || 'เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง');
                registerBtn.disabled = false;
                registerSpinner.classList.add('d-none');
            }
        });
    }
});