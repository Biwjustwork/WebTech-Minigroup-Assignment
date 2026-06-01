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

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/checkout`

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
docs(backend): document backend architecture decisions
```

