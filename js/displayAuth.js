/**
 * displayAuth.js
 * จัดการแสดงผล UI ผู้ใช้งาน (Guest / Member) และระบบ Logout
 * อัปเดต: แสดงผลเป็น Dropdown Card ด้านล่าง Icon รูปคน และเพิ่มปุ่ม Register สำหรับ Guest
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. ค้นหาปุ่ม Icon รูปคนบน Navbar เพื่อใช้เป็นจุดอ้างอิงตำแหน่ง
    const userIconLink = document.querySelector('.navbar-nav ~ .d-flex .fa-user')?.closest('a');

    if (!userIconLink) return;

    // ตั้งค่าให้ element หลักมี position: relative เพื่อให้กล่อง Dropdown เกาะติดใต้ไอคอนเสมอ
    userIconLink.style.position = 'relative';

    // 2. ออกแบบโครงสร้าง HTML ของ Dropdown Popup (ใช้ขอบหนา 3px และเงาละมุนตามสไตล์ EcoClean)
    const authPopupHTML = `
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
    `;

    // ฝังกล่อง Dropdown ลงไปใต้ตัวลิ้งค์ไอคอนโดยตรง
    userIconLink.insertAdjacentHTML('beforeend', authPopupHTML);
    const authPopup = document.getElementById('authProfilePopup');

    // 3. เปิด-ปิดเมนูเมื่อผู้ใช้ทำการคลิกที่ไอคอนรูปคน
    userIconLink.addEventListener('click', (e) => {
        // ถ้าเป็นการคลิกปุ่มหรือลิ้งค์ภายในตัวกล่อง Dropdown เอง ไม่ต้องสั่งปิดกล่อง
        if (e.target.closest('#authProfilePopup')) return;
        
        e.preventDefault(); // ป้องกันการเด้งหน้าของเครื่องหมาย #
        updateAuthPopupUI(); // อัปเดตสถานะล่าสุดจากความเปลี่ยนแปลงของ LocalStorage
        authPopup.classList.toggle('d-none'); // สลับ d-none เพื่อแสดง/ซ่อน
    });

    // 4. ระบบ Click Outside ปิดกล่องข้อมูลอัตโนมัติเมื่อผู้ใช้คลิกพื้นที่อื่นๆ ด้านนอก
    document.addEventListener('click', (e) => {
        if (!userIconLink.contains(e.target)) {
            authPopup.classList.add('d-none');
        }
    });

    // 5. ฟังก์ชันการอัปเดตหน้าตาและชุดปุ่มตามสถานะการ Authentication ตัวจริง
    function updateAuthPopupUI() {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

        const idEl = document.getElementById('displayAuthId');
        const nameEl = document.getElementById('displayAuthName');
        const emailEl = document.getElementById('displayAuthEmail');
        const actionContainer = document.getElementById('authActionContainer');

        if (isLoggedIn && currentUser) {
            // =================================================================
            // CASE: เป็น Member (ล็อกอินผ่านแล้ว)
            // =================================================================
            idEl.textContent = (currentUser.user_id || '-').toLowerCase(); // แปลงเป็นตัวพิมพ์เล็กตามโจทย์
            nameEl.textContent = currentUser.username || 'Member';
            emailEl.textContent = currentUser.email || '-';

            // แสดงเฉพาะปุ่มออกจากระบบ (Logout)
            actionContainer.innerHTML = `
                <button id="btnLogout" class="btn btn-outline-danger btn-sm border-2 w-100 rounded-pill fw-bold py-2 shadow-sm">
                    <i class="fas fa-sign-out-alt me-1"></i>ออกจากระบบ
                </button>
            `;

            // เพิ่มฟังก์ชันการล้างค่า Session เมื่อกด Logout
            document.getElementById('btnLogout').addEventListener('click', () => {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('currentUser');
                authPopup.classList.add('d-none');
                window.location.href = ''; // ล้างค่าเสร็จส่งกลับหน้าหลักทันที
            });

        } else {
            // =================================================================
            // CASE: เป็น Guest (ผู้เยี่ยมชมทั่วไป)
            // =================================================================
            idEl.textContent = '-';
            nameEl.textContent = 'Guest';
            emailEl.textContent = '-';

            // จัดเรียงแบบ d-grid บังคับปุ่ม Login และ Register ซ้อนกันสวยงาม
            actionContainer.innerHTML = `
                <div class="d-grid gap-2">
                    <a href="login.html" class="btn btn-success btn-sm border-success border-2 w-100 rounded-pill fw-bold py-2 text-white shadow-sm">
                        <i class="fas fa-sign-in-alt me-1"></i>เข้าสู่ระบบ
                    </a>
                    <a href="register.html" class="btn btn-outline-success btn-sm border-success border-2 w-100 rounded-pill fw-bold py-2 shadow-sm">
                        <i class="fas fa-user-plus me-1"></i>สมัครสมาชิก
                    </a>
                </div>
            `;
        }
    }
});