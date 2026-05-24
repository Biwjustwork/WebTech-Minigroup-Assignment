/**
 * login/register-Logic.js
 * จัดการระบบ Authentication (Login & Register) สำหรับเว็บ EcoClean
 * รองรับ Robust Error Handling, Dynamic Validations และ Async Loading States ทั้ง 2 หน้าจอ
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // รีสอร์สแชร์ร่วมกัน: Helper สำหรับการเปิดปิดตาดูรหัสผ่าน (ใช้ Class เพื่อรองรับหลายจุดพร้อมกันในหน้า Register)
    const togglePasswordButtons = document.querySelectorAll('.togglePassword');
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function() {
            try {
                const targetId = this.getAttribute('data-target');
                const passwordInput = document.getElementById(targetId);
                const icon = this.querySelector('.toggleIcon');
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                    this.setAttribute('title', 'ซ่อนรหัสผ่าน');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                    this.setAttribute('title', 'ดูรหัสผ่าน');
                }
            } catch (error) {
                console.error("Password visibility toggle error:", error);
            }
        });
    });

    // Helper: ฟังก์ชันสำหรับวาดกล่องข้อความแจ้งเตือน (Alert Display)
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
            if (!passwordValue) {
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

                await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate Network

                if (emailValue === 'admin@ecoclean.com' && passwordValue === 'password123') {
                    showAlert('เข้าสู่ระบบสำเร็จ! กำลังนำคุณไปยังหน้าหลัก...', 'success');
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('userEmail', emailValue);
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
            
            // ล้างสถานะ Error เก่าออกทั้งหมดก่อนตรวจรอบใหม่
            alertContainer.innerHTML = '';
            [usernameInput, emailInput, passwordInput, confirmPasswordInput].forEach(el => el.classList.remove('is-invalid'));

            const usernameValue = usernameInput.value.trim();
            const emailValue = emailInput.value.trim();
            const passwordValue = passwordInput.value;
            const confirmPasswordValue = confirmPasswordInput.value;
            let isValid = true;

            // 1. ตรวจสอบ Username
            if (!usernameValue || usernameValue.length < 3) {
                usernameInput.classList.add('is-invalid');
                isValid = false;
            }

            // 2. ตรวจสอบ Email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailValue || !emailRegex.test(emailValue)) {
                emailInput.classList.add('is-invalid');
                isValid = false;
            }

            // 3. ตรวจสอบ Password ความยาวอย่างน้อย 6 ตัวอักษรตามมาตรฐาน Security
            if (!passwordValue || passwordValue.length < 6) {
                passwordInput.classList.add('is-invalid');
                isValid = false;
            }

            // 4. ตรวจสอบ Confirm Password (ต้องแมตช์กันพอดี)
            if (passwordValue !== confirmPasswordValue) {
                confirmPasswordInput.classList.add('is-invalid');
                isValid = false;
            }

            if (!isValid) {
                showAlert('กรุณาตรวจสอบข้อผิดพลาดและกรอกข้อมูลให้ครบถ้วนถูกต้อง');
                return;
            }

            // ส่งข้อมูลสมัครสมาชิกจำลองไปยัง Backend
            try {
                registerBtn.disabled = true;
                registerSpinner.classList.remove('d-none');

                // หน่วงเวลา Network Latency 1.5 วินาที เพื่อจำลองสถานการณ์จริง
                await new Promise(resolve => setTimeout(resolve, 1500));

                // จำลองการสมัครสำเร็จ (Mock บันทึกค่าลงคลังจำลอง)
                showAlert('สมัครสมาชิกเสร็จสมบูรณ์! ระบบกำลังพาท่านไปหน้าเข้าสู่ระบบ...', 'success');
                
                // เก็บชื่อและเมลไว้ใช้งานเบื้องต้นได้
                localStorage.setItem('registeredUser', usernameValue);
                localStorage.setItem('registeredEmail', emailValue);

                // พาย้ายหน้าไปล็อกอินหลังจากผ่านไป 1.5 วินาทีเพื่อให้เห็น Alert ความสำเร็จก่อน
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);

            } catch (error) {
                console.error("Registration Processing Error:", error);
                showAlert('เกิดความล่าช้าในระบบเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้งภายหลัง');
                registerBtn.disabled = false;
                registerSpinner.classList.add('d-none');
            }
        });
    }
});