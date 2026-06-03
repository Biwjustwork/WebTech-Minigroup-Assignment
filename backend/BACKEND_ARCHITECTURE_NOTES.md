# Backend Architecture Notes

เอกสารนี้สรุปสิ่งที่ทำไปในฝั่ง Backend/DevOps สำหรับ mini project และเหตุผลเชิง architecture ที่ใช้ตอบ requirement จากสไลด์ได้

## 1. Backend Project Structure

เราเพิ่ม backend จริงด้วย Express แยกจาก static frontend เดิม

โครงสร้างหลัก:

- `src/server.js` เปิด HTTP server
- `src/app.js` ตั้งค่า Express app, middleware, routes, error boundary
- `src/routes` รวม endpoint paths
- `src/controllers` รับ request/response
- `src/services` ใส่ business logic
- `src/middleware` ใส่ middleware กลาง เช่น 404/error handler
- `src/config` โหลดค่าจาก `.env`
- `src/database` จัดการ SQLite connection, migration, seed
- `database/migrations` เก็บ SQL schema version
- `mock-data` เก็บ JSON เดิมไว้เป็น seed source

เหตุผล:

- ตรงกับ Controller-Route-Service Pattern จาก Session 9
- แยก concern ชัดเจน ทำให้เพิ่ม Product API, Auth API, Checkout API ได้โดยไม่ปนกัน
- `server.js` แยกจาก `app.js` เพื่อให้ test import app ได้โดยไม่ต้องเปิด port จริง

## 2. Environment และ Zero-Config

เพิ่ม:

- `.gitignore`
- `backend/.env.example`
- `backend/package.json`
- `backend/package-lock.json`

ค่าหลักใน `.env.example`:

```text
PORT=3001
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=./data/app.sqlite
```

เหตุผล:

- ตรงกับ Session 10: Go-Live Audit
- secret ไม่ควร hard-code ใน source code
- project ควร clone แล้วรันด้วย `npm install`, `npm run db:seed`, `npm run dev`

## 3. Database & SQL Schema

เพิ่ม migration:

```text
backend/database/migrations/001_initial_schema.sql
```

ตารางที่สร้าง:

- `users`
- `products`
- `orders`
- `order_items`
- `payments`
- `schema_migrations`

Schema อิงจาก ER diagram ใน `daigram-document/ER Diagram/User Order Payment Flow-2026-05-30-080340.mmd`

ความสัมพันธ์หลัก:

- `users` 1 ต่อหลาย `orders`
- `orders` 1 ต่อหลาย `order_items`
- `products` 1 ต่อหลาย `order_items`
- `orders` 1 ต่อหลาย `payments`

Integrity ที่ใส่ไว้:

- primary keys
- foreign keys
- unique email
- check constraints เช่น price >= 0, quantity > 0, stock_quantity >= 0
- order status enum
- recurring item ต้องมี frequency
- one-time item ต้องไม่มี frequency/next_delivery_date

เหตุผล:

- ตรงกับ Session 7: Relational Persistence
- ลด duplicated JSON data
- ป้องกัน order item ที่อ้าง product/order ที่ไม่มีจริง
- เตรียมรองรับ Checkout Transaction และ Stock Check bonus

## 4. SQLite Runtime Choice

ตอนแรกลองใช้ package `sqlite3` แต่ติด native build บน Windows ARM/Node 24 เพราะต้องใช้ Visual Studio C++ build tools

จึงเลือก `sql.js` แทน:

- ติดตั้งง่ายกว่า
- ไม่ต้อง compile native module
- เหมาะกับงานกลุ่มและ demo
- database ถูก persist เป็นไฟล์ `backend/data/app.sqlite`

หมายเหตุ:

- `sql.js` เปิด DB ใน memory แล้ว export กลับไฟล์ตอน close
- สำหรับ production จริง อาจเปลี่ยนเป็น PostgreSQL หรือ SQLite driver แบบ native ได้

## 5. Migration System

เพิ่ม:

- `src/database/migrate.js`
- `scripts/migrate.js`
- npm script `db:migrate`

หลักการ:

- อ่านไฟล์ `.sql` จาก `database/migrations`
- run ตามลำดับชื่อไฟล์ เช่น `001_`, `002_`
- บันทึกไฟล์ที่ run แล้วใน `schema_migrations`
- แต่ละ migration อยู่ใน transaction

เหตุผล:

- รันซ้ำได้โดยไม่ apply ซ้ำ
- ถ้า migration fail จะ rollback
- ทำให้ database schema เป็น versioned history ใน Git

## 6. Seed Data / Data Migration

เพิ่ม:

- `src/database/seed.js`
- `scripts/seed.js`
- npm script `db:seed`

Seed source:

- `backend/mock-data/products.json`
- `backend/mock-data/users.json`

สิ่งที่ seed ทำ:

- migrate schema ก่อนเสมอ
- insert/update products 20 รายการ
- เพิ่ม `stock_quantity` ให้ product เพราะ mock เดิมยังไม่มี inventory
- insert/update users 3 รายการ
- เปลี่ยน password hash ของ demo users เป็น bcrypt

Demo login password สำหรับ seeded users:

```text
password
```

เหตุผล:

- ตรงกับ Session 5-6: Auth Logic ที่ต้องใช้ salted hashing
- ตรงกับ Session 7: ย้ายจาก JSON ไป relational schema
- Seed รันซ้ำได้เพราะใช้ upsert ไม่ duplicate
- Stock quantity เตรียมไว้สำหรับ Pre-Checkout Inventory Check bonus

## 7. SQL Safety

Database helper ใน `src/database/connection.js` มี helper:

- `run(db, sql, params)`
- `get(db, sql, params)`
- `all(db, sql, params)`
- `exec(db, sql)`

จุดสำคัญ:

- query ที่รับข้อมูลเปลี่ยนแปลงใช้ `?` placeholders
- แยก SQL text ออกจาก params

เหตุผล:

- ตรงกับ requirement: Parameterized Queries
- ลด risk SQL Injection

## 8. Current API State

ตอนนี้ API ที่มีจริง:

```text
GET /api/health
```

ใช้สำหรับตรวจว่า backend boot ได้

ตัวอย่าง response:

```json
{
  "status": "ok",
  "service": "smart-niche-marketplace-backend",
  "environment": "development",
  "timestamp": "..."
}
```

API feature ถัดไปที่ควรทำ:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/checkout`

## 11. Product API

เพิ่ม Product API ตาม Dynamic Product Display sequence diagram:

```text
GET /api/products
GET /api/products/:productId
```

รองรับ query:

- `keyword`
- `category`
- `minPrice`
- `maxPrice`
- `page`
- `limit`

Flow:

```text
Route -> Product Controller -> Product Service -> SQL Database
```

จุดสำคัญ:

- ไม่อ่าน `products.json` โดยตรงแล้ว แต่อ่านจาก SQL table `products`
- ใช้ parameterized queries ทุก filter
- pagination ถูกคำนวณฝั่ง backend
- response มี `data` และ `meta` เพื่อให้ frontend render catalog ได้แบบ dynamic
- `GET /api/products/:productId` คืน `404 PRODUCT_NOT_FOUND` ถ้าไม่มี product

## 9. Commands

ติดตั้ง dependencies:

```bash
cd backend
npm install
```

สร้าง/อัปเดต schema:

```bash
npm run db:migrate
```

seed demo data:

```bash
npm run db:seed
```

รัน backend:

```bash
npm run dev
```

## 10. Commit Names ที่แนะนำ

สำหรับงานที่ทำไป:

```text
feat(backend): scaffold express api structure
feat(database): add initial sql schema and migration
feat(database): seed mock data into sqlite
feat(products): add product catalog api
feat(auth): add registration login and jwt verification
feat(cart): add persistent cart api
feat(checkout): add transactional order placement
feat(discounts): centralize eco-refill subscription pricing
feat(security): enforce api gatekeeper validation
feat(database): add transaction helper and integrity audit
feat(inventory): add pre-checkout stock reservation
feat(discounts): add dynamic checkout discount engine
feat(recommendations): add co-purchase product recommendations
chore(deploy): add environment and deployment audit
docs(backend): document backend architecture decisions
```

## 22. Environment & Deployment Audit

เพิ่มไฟล์:

```text
backend/DEPLOYMENT_AUDIT.md
src/config/auditEnv.js
scripts/audit-env.js
scripts/smoke-test.js
```

เพิ่ม scripts:

```text
npm run audit:env
npm run smoke:test
npm run audit:deploy
```

สิ่งที่ audit:

- `.env.example` มีอยู่
- `.env` ถูก ignore
- local SQLite files ถูก ignore
- `PORT` valid
- `DATABASE_URL` configured
- `JWT_SECRET` configured
- production JWT secret ไม่ใช่ placeholder และยาวพอ
- `NODE_ENV` เป็น `development`, `test`, หรือ `production`
- database foreign keys/table integrity ผ่าน `db:audit`
- backend boot ได้จริงผ่าน health smoke test

นี่ตอบ Session 10: Zero-Config & `.env` Audit เพราะ project มี checklist และ command ตรวจ readiness ก่อน demo/deploy

## 21. Bonus C: Personalized Recommendations

เพิ่ม endpoint:

```text
GET /api/products/:productId/recommendations
```

แนวคิด:

- ใช้ `orders` และ `order_items` เป็นประวัติการซื้อ
- หา order ที่มีสินค้าที่ user กำลังดู
- join กลับไปหา product อื่นใน order เดียวกัน
- group/count เพื่อหา product ที่ถูกซื้อร่วมกันบ่อยที่สุด

SQL strategy:

```text
orders -> target order_items -> recommended order_items -> products
```

Seed เพิ่ม demo order history เล็กน้อยใน `npm run db:seed` เพื่อให้ endpoint มีข้อมูลแสดงผลทันที

จุดสำคัญ:

- เป็น Complex SQL Joins ตาม Bonus C
- ไม่ใช้ hard-coded recommendation list
- recommendation score มาจากจำนวน co-purchase จริงใน relational tables

## 20. Bonus B: Dynamic Discount Service

เพิ่ม service:

```text
src/services/discount.service.js
```

Rules:

- cart total หลัง line-item discounts > `$200` ได้ส่วนลด 10%
- ซื้อสินค้าหมวด `Fresh` มากกว่า 3 ชิ้น ได้ส่วนลด 15%
- ถ้าเข้าได้หลาย rule backend เลือกส่วนลดที่มากที่สุด

เพิ่ม migration:

```text
database/migrations/003_order_discount_audit.sql
```

เพิ่ม audit columns ใน `orders`:

- `subtotal_amount`
- `subscription_discount_amount`
- `dynamic_discount_amount`
- `dynamic_discount_reason`

Checkout flow:

```text
line item pricing -> subscription discount -> dynamic discount -> final total
```

จุดสำคัญ:

- frontend ห้ามส่ง total/discount มาเอง เพราะ Gatekeeper reject อยู่แล้ว
- DiscountService คำนวณจาก lineItems ที่ backend สร้างจาก SQL product data
- response มี `recalculatedBy: "backend"` เพื่อพิสูจน์ว่า calculation เกิดที่ backend

## 19. Bonus A: Pre-Checkout Inventory Check

เพิ่ม service:

```text
src/services/inventory.service.js
```

หน้าที่:

- query product จาก SQL ก่อน checkout
- ตรวจ `stock_quantity` กับจำนวนที่ user ต้องการซื้อ
- ถ้า stock ไม่พอ ตอบ `409 OUT_OF_STOCK`
- reserve stock ด้วย conditional update:

```text
UPDATE products
SET stock_quantity = stock_quantity - ?
WHERE product_id = ? AND stock_quantity >= ?
```

จุดสำคัญ:

- logic นี้ถูกเรียกใน `withTransaction` ของ checkout
- ถ้า order insert, order_items insert, หรือ payment insert fail ระบบ rollback stock กลับ
- ใช้ทั้ง pre-check read และ atomic update guard เพื่ออธิบาย concurrency logic ได้ชัด

นี่ตรงกับ Bonus A: The "Stock-Check" Store เพราะ OrderService ตรวจ Product table ภายใน transaction ก่อนยอมให้ checkout สำเร็จ

## 12. Authentication API

เพิ่ม Auth API ตาม Session 5-6 และ Auth Logic sequence diagram:

```text
POST /api/auth/register
POST /api/auth/login
GET /api/auth/verify-session
```

Flow:

```text
Route -> Auth Controller -> Auth Service -> SQL Database
```

จุดสำคัญ:

- register validate `username`, `email`, `password` ฝั่ง server
- password ถูก hash ด้วย bcrypt ก่อนเก็บลง `users.password_hash`
- login ใช้ bcrypt compare ไม่เทียบ plain text
- login สำเร็จจะ sign JWT และ update `users.token`, `users.is_logged_in`, `users.last_login`
- verify-session ใช้ Bearer token และ middleware `authenticateUser`
- response ไม่ส่ง `password_hash` กลับไป frontend
- มี `optionalAuthenticateUser` เตรียมไว้สำหรับ checkout แบบ guest ที่ยังต้องรู้ว่า user login หรือไม่

## 13. Cart API

เพิ่ม Cart API:

```text
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/:productId
DELETE /api/cart/items/:productId
```

เพิ่ม migration `002_cart_schema.sql`:

- `carts`
- `cart_items`

แนวคิด:

- guest cart ใช้ `X-Cart-Session-Id`
- logged-in cart ใช้ JWT user identity
- cart item เก็บ `quantity`, `is_recurring`, `frequency`
- backend preview subtotal/discount/total จาก product table
- recurring discount 20% แสดงเฉพาะเมื่อมี logged-in user

## 14. Checkout / Order API

เพิ่ม Checkout API:

```text
POST /api/checkout
```

สิ่งที่ backend ทำใน transaction:

- validate address และ guest info
- โหลด items จาก cart หรือจาก direct checkout payload
- query product price จาก SQL table `products`
- ตรวจ `stock_quantity` ก่อนสั่งซื้อ
- คำนวณ subtotal, discount, total ฝั่ง server
- apply 20% discount เฉพาะ recurring + logged-in user
- insert `orders`
- decrement stock
- insert `order_items`
- insert `payments` เป็น `bypassed`
- mark cart เป็น `checked_out`
- rollback ทั้งหมดถ้ามี error เช่น stock ไม่พอ

นี่คือ Gatekeeper Pattern: frontend ส่งแค่ intent แต่ backend เป็นคนตัดสินราคาจริง ส่วนลดจริง และ stock จริง

## 15. Eco-Refill Subscription Discount Logic

เพิ่ม service:

```text
src/services/subscriptionDiscount.service.js
```

Rule:

```text
if item is recurring AND user is logged in:
  apply 20% line-item discount
else:
  no subscription discount
```

จุดที่ใช้ service นี้:

- Cart preview
- Checkout/order placement

เหตุผล:

- logic อยู่ฝั่ง backend service layer
- frontend เปลี่ยนราคาเองไม่ได้
- checkout จะคำนวณใหม่จาก product price ใน SQL
- `order_items.discount_applied` เก็บส่วนลดจริงที่ backend ใช้ ณ เวลาสั่งซื้อ
- response มี `discountRate` และ `discountReason` เพื่ออธิบายว่า backend ใช้ rule ใด

## 16. Security API / Gatekeeper Pattern

เพิ่ม utility:

```text
src/utils/gatekeeper.js
```

เพิ่ม dependency:

```text
helmet
```

สิ่งที่ enforce:

- security headers ผ่าน `helmet`
- จำกัด JSON payload เป็น `100kb`
- reject client-calculated fields เช่น `price`, `unitPrice`, `subtotal`, `discount`, `lineTotal`, `total`
- validate `orderType` ให้เป็น `one-time` หรือ `recurring`
- checkout ยัง query product price/stock จาก SQL เสมอ
- ส่วนลดและยอดรวมคำนวณใน backend เท่านั้น

ถ้า frontend ส่งราคา/ยอดรวมมาเอง backend จะตอบ:

```text
400 CLIENT_CALCULATION_REJECTED
```

เหตุผล:

- ตรงกับ Gatekeeper Pattern
- frontend ส่งได้แค่ intent เช่น productId, quantity, orderType
- backend เป็นผู้ตัดสินข้อมูลที่มีผลต่อเงินและ stock

## 17. SQL Safety

SQL access ใช้ helper กลางใน:

```text
src/database/connection.js
```

หลักการ:

- `run(db, sql, params)`
- `get(db, sql, params)`
- `all(db, sql, params)`

ทุก query ที่รับค่าจาก request ใช้ `?` placeholders และส่งค่าแยกใน `params`

ตัวอย่างแนวคิด:

```text
WHERE product_id = ?
params: [productId]
```

ไม่ใช้ string interpolation กับ user input เช่น:

```text
WHERE product_id = '${productId}'
```

ผลลัพธ์:

- ลดความเสี่ยง SQL Injection
- service layer อ่านง่ายขึ้น
- audit ได้ว่าข้อมูลจาก client ไม่ถูกเอาไปต่อ SQL string ตรง ๆ

## 18. Transaction / Relational Integrity

เพิ่ม helper:

```text
withTransaction(db, async () => { ... })
```

ใช้ใน:

- migration
- seed
- checkout

หลักการ:

- เริ่มด้วย `BEGIN`
- ถ้าทุกอย่างสำเร็จ `COMMIT`
- ถ้ามี error `ROLLBACK`

Checkout จึงเป็น atomic flow:

- insert order
- decrement stock
- insert order_items
- insert payment bypass
- mark cart checked_out

ถ้าขั้นใดขั้นหนึ่ง fail เช่น stock ไม่พอ ระบบ rollback ทั้งหมด

เพิ่ม audit script:

```text
npm run db:audit
```

ตรวจ:

- foreign key เปิดใช้งาน
- table สำคัญครบ
- foreign key constraints มีจริงในตาราง relationship
- `PRAGMA foreign_key_check` ไม่มีปัญหา
