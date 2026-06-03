# สถานะการเชื่อม Frontend กับ Backend

สรุปสั้น ๆ: frontend กับ backend เชื่อมกันแล้วสำหรับ flow หลักของระบบ ได้แก่ แสดงสินค้า, สมัครสมาชิก, ล็อกอิน, จัดการตะกร้า, และ checkout

Frontend ยังเป็น static HTML/CSS/JavaScript ส่วน backend เป็น Node.js + Express API ที่รันที่ `http://localhost:3001/api` โดย frontend เรียกผ่านไฟล์กลาง `js/apiClient.js`

## ภาพรวมการเชื่อมระบบ

Frontend ไม่ได้อ่าน `backend/mock-data/*.json` เป็น source หลักอีกต่อไปใน flow สำคัญ แต่เรียก backend API แทน

ไฟล์เชื่อม API:

```text
js/apiClient.js
```

หน้าที่ของไฟล์นี้:

- ตั้งค่า API base URL เป็น `http://localhost:3001/api`
- แนบ JWT token ผ่าน `Authorization: Bearer <token>`
- แนบ guest cart session ผ่าน `X-Cart-Session-Id`
- เก็บ `authToken`, `currentUser`, `isLoggedIn`, และ `ecoCartSessionId` ใน `localStorage`
- ทำให้หน้าเว็บอื่นเรียก backend ผ่าน `window.EcoApi`

ถ้าต้องเปลี่ยน backend URL ตอน deploy สามารถตั้งค่าใน browser ได้:

```js
localStorage.setItem('ecoApiBaseUrl', 'https://your-backend.example.com/api');
location.reload();
```

## Flow ที่เชื่อมแล้ว

### 1. Product Flow

เชื่อมแล้ว

Frontend:

```text
shop.html
js/displayProducts.js
```

Backend:

```text
GET /api/products
GET /api/products/:productId
```

การทำงาน:

- หน้า shop โหลดสินค้าจาก backend
- รองรับข้อมูลสินค้าแบบ relational database
- frontend นำข้อมูลจาก `data` ของ response มา render card สินค้า
- search/filter/pagination ฝั่ง UI ยังประมวลผลจากรายการสินค้าที่โหลดมา

### 2. Authentication Flow

เชื่อมแล้ว

Frontend:

```text
login.html
register.html
js/login-register-Logic.js
js/displayAuth.js
```

Backend:

```text
POST /api/auth/register
POST /api/auth/login
GET /api/auth/verify-session
```

การทำงาน:

- สมัครสมาชิกเรียก backend ผ่าน `/api/auth/register`
- ล็อกอินเรียก backend ผ่าน `/api/auth/login`
- backend hash password ด้วย `bcryptjs`
- backend สร้าง JWT token
- frontend เก็บ token ใน `localStorage.authToken`
- profile popup อ่าน `currentUser` จาก session ที่ backend ส่งกลับมา
- logout ล้าง token และข้อมูล session ฝั่ง frontend

### 3. Cart Flow

เชื่อมแล้ว

Frontend:

```text
shop.html
cart.html
js/cartSystem.js
js/displayCart.js
```

Backend:

```text
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/:productId
DELETE /api/cart/items/:productId
```

การทำงาน:

- กด Add to cart แล้วส่งข้อมูลไป backend
- backend สร้าง guest cart session ถ้ายังไม่มี
- frontend เก็บ session ID ใน `localStorage.ecoCartSessionId`
- cart page โหลดรายการจาก backend
- เพิ่ม/ลดจำนวนสินค้าใช้ `PATCH`
- เปลี่ยน `orderType` และ `frequency` ใช้ `PATCH`
- ลบสินค้าใช้ `DELETE`
- cart badge โหลดจำนวนสินค้าจาก backend cart

### 4. Checkout Flow

เชื่อมแล้ว

Frontend:

```text
checkout.html
js/checkout.js
```

Backend:

```text
POST /api/checkout
```

การทำงาน:

- checkout page โหลด cart summary จาก backend
- เมื่อกด Place Order frontend ส่งเฉพาะข้อมูลที่จำเป็น เช่น address, guestName, guestEmail
- frontend ไม่ส่งราคา, subtotal, discount, lineTotal หรือ total
- backend คำนวณราคา ส่วนลด และยอดรวมเองทั้งหมด
- backend ตรวจ stock ก่อนสร้าง order
- backend ใช้ transaction เพื่อสร้าง order, order_items, payment และตัด stock พร้อมกัน
- payment ถูกจำลองเป็น `bypassed` ตามโจทย์

หมายเหตุ: ในรายการ requirement ข้อ 7 เขียนว่า `POST /api/orders` แต่ implementation ปัจจุบันใช้ endpoint ชื่อ `POST /api/checkout` ซึ่งทำหน้าที่ checkout/order creation ครบแล้ว

## Backend Features ที่มีแล้ว

### Backend Project Structure

มีโครงสร้างแยก layer แล้ว:

```text
backend/src/routes
backend/src/controllers
backend/src/services
backend/src/database
backend/src/middleware
backend/src/config
backend/src/utils
```

มี `package.json` scripts สำหรับ:

- `npm run dev`
- `npm start`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run db:audit`
- `npm run smoke:test`
- `npm run audit:deploy`

### Database & SQL Schema

มี relational schema แล้ว:

- `users`
- `products`
- `carts`
- `cart_items`
- `orders`
- `order_items`
- `payments`

ไฟล์ migration:

```text
backend/database/migrations/001_initial_schema.sql
backend/database/migrations/002_cart_schema.sql
backend/database/migrations/003_order_discount_audit.sql
```

หมายเหตุเรื่องชื่อ field:

- ระบบใช้ `is_recurring` แทน `order_type` ในตาราง database
- API response แปลงกลับเป็น `orderType` ให้ frontend ใช้งาน
- ระบบใช้ `discount_applied` และ `line_total` ใน `order_items`
- dynamic discount audit ถูกเก็บที่ `orders` ผ่าน `subtotal_amount`, `subscription_discount_amount`, `dynamic_discount_amount`, `dynamic_discount_reason`

### Seed Data & Migration

มี migration และ seed แล้ว:

```bash
cd backend
npm run db:migrate
npm run db:seed
```

seed script เพิ่ม:

- products จาก mock data
- `stock_quantity`
- demo users
- password hash ด้วย `bcryptjs`

demo users ใช้ password:

```text
password
```

### Product API

มีแล้ว:

```text
GET /api/products
GET /api/products/:productId
GET /api/products/:productId/recommendations
```

รองรับ query:

```text
keyword
category
minPrice
maxPrice
page
limit
```

### Auth API

มีแล้ว:

```text
POST /api/auth/register
POST /api/auth/login
GET /api/auth/verify-session
```

มี middleware:

```text
authenticateUser
optionalAuthenticateUser
```

### Cart API

มีแล้ว:

```text
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/:productId
DELETE /api/cart/items/:productId
```

รองรับ:

- guest cart ผ่าน `X-Cart-Session-Id`
- logged-in cart ผ่าน JWT
- `quantity`
- `orderType`
- `frequency`

### Order & Checkout API

มีแล้วผ่าน:

```text
POST /api/checkout
```

backend คำนวณ:

- `subtotal`
- `subscriptionDiscountTotal`
- `dynamicDiscountTotal`
- `total`

### Eco-Refill Subscription Discount

มีแล้วใน:

```text
backend/src/services/subscriptionDiscount.service.js
```

กติกา:

```text
Recurring item ได้ส่วนลด 20% เฉพาะกรณีผู้ใช้ล็อกอินแล้วเท่านั้น
```

guest checkout ต่อให้เลือก recurring ก็ไม่ได้รับส่วนลด member

### Security & Gatekeeper

มีแล้ว:

- `helmet`
- `cors`
- JSON body limit
- JWT middleware
- input validation ใน service layer
- parameterized SQL helpers
- reject client-calculated fields

ไฟล์สำคัญ:

```text
backend/src/utils/gatekeeper.js
backend/src/middleware/auth.middleware.js
backend/src/middleware/errorHandler.js
```

### SQL Safety & Transaction

มีแล้ว:

```text
backend/src/database/connection.js
```

มี helper:

- `run`
- `get`
- `all`
- `withTransaction`

checkout ใช้ transaction เพื่อให้ order, order_items, payment และ stock update สำเร็จพร้อมกัน หรือ rollback เมื่อเกิด error

### Pre-Checkout Inventory Check

มีแล้วใน:

```text
backend/src/services/inventory.service.js
```

ถ้า stock ไม่พอ backend ตอบ error `409 OUT_OF_STOCK`

### Dynamic Discount Service

มีแล้วใน:

```text
backend/src/services/discount.service.js
```

กติกาปัจจุบัน:

- subtotal มากกว่า 200 ได้ส่วนลด 10%
- สินค้าหมวด Fresh มากกว่า 3 รายการ ได้ส่วนลด 15%
- ถ้าเข้าเงื่อนไขหลายอย่าง เลือกส่วนลดที่ดีที่สุด

### Personalized Recommendations

มี backend API แล้ว:

```text
GET /api/products/:productId/recommendations
```

API ใช้ SQL JOIN ระหว่าง `orders` และ `order_items` เพื่อหาสินค้าที่มักถูกซื้อร่วมกัน

หมายเหตุ: backend มี endpoint แล้ว แต่ frontend ยังไม่มีส่วน UI เฉพาะสำหรับแสดง recommendation

### Environment & Deployment

มีแล้ว:

```text
backend/.env.example
.gitignore
backend/package.json
```

ตัวแปรหลัก:

```text
PORT
DATABASE_URL
JWT_SECRET
CORS_ORIGIN
NODE_ENV
```

## สรุปสถานะตาม Requirement

| ข้อ | สถานะ | หมายเหตุ |
| --- | --- | --- |
| 1 Backend Project Structure | เสร็จแล้ว | แยก routes/controllers/services/database/middleware |
| 2 Database & SQL Schema | เสร็จแล้ว | ใช้ relational schema ครบ แต่ชื่อ field บางตัวต่างจาก requirement |
| 3 Seed Data & Migration | เสร็จแล้ว | มี migrate/seed และ bcrypt |
| 4 Product API | เสร็จแล้ว | frontend shop เรียกแล้ว |
| 5 Auth API | เสร็จแล้ว | frontend login/register เรียกแล้ว |
| 6 Cart API | เสร็จแล้ว | frontend cart เรียกแล้ว |
| 7 Order & Checkout API | เสร็จแล้ว | ใช้ `/api/checkout` แทน `/api/orders` |
| 8 Subscription Discount | เสร็จแล้ว | recurring + logged-in เท่านั้น |
| 9 Security & Gatekeeper | เสร็จแล้ว | validate, JWT, reject client totals |
| 10 SQL Safety & Transaction | เสร็จแล้ว | checkout ใช้ transaction |
| 11 Inventory Check | เสร็จแล้ว | stock check และ decrement |
| 12 Dynamic Discount | เสร็จแล้ว | service แยกชัดเจน |
| 13 Recommendations | Backend เสร็จแล้ว | ยังไม่ได้ทำ UI แสดงผลใน frontend |
| 14 Environment & Deployment | เสร็จแล้ว | มี env example และ scripts |
| 15 Documentation | เสร็จแล้วบางส่วน | มี README/notes/audit และไฟล์นี้เพิ่มสถานะ integration |

## คำตอบว่า Frontend กับ Backend เชื่อมกันหมดแล้วหรือยัง

เชื่อมกันแล้วสำหรับระบบหลักที่ผู้ใช้ใช้งานจริง:

- แสดงสินค้า
- สมัครสมาชิก
- ล็อกอิน
- สถานะผู้ใช้บน navbar
- เพิ่มสินค้าเข้าตะกร้า
- แก้ไขตะกร้า
- เลือก one-time/recurring/frequency
- checkout
- backend คำนวณราคาและตัด stock

ส่วนที่ยังไม่ได้เชื่อมเป็น UI ชัดเจน:

- หน้าแสดง personalized recommendations แม้ backend endpoint มีแล้ว
- ระบบ contact/newsletter/payment gateway จริง เพราะไม่ใช่ flow backend หลักของ assignment และ payment ถูกจำลองเป็น `bypassed`

ดังนั้นถ้าพูดสำหรับ scope assignment หลัก ถือว่า frontend กับ backend เชื่อมครบแล้ว แต่ถ้าต้องการความสมบูรณ์เชิง product เพิ่มเติม ควรเพิ่ม UI สำหรับ recommendations และหน้า order history ในอนาคต

## วิธีรันเพื่อตรวจสอบ

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run smoke:test
npm run dev
```

จากนั้นเปิด:

```text
index.html
shop.html
cart.html
checkout.html
login.html
register.html
```

backend ต้องรันที่:

```text
http://localhost:3001
```

API base URL ฝั่ง frontend:

```text
http://localhost:3001/api
```
