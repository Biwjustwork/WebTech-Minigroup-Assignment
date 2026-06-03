# Supabase Setup Guide

คู่มือนี้อธิบายวิธีเชื่อมโปรเจกต์ EcoClean เข้ากับ Supabase โดยยังให้ frontend เรียก backend เดิมผ่าน `http://localhost:3001/api` เหมือนเดิม

## แนวทางที่แนะนำ

ให้เชื่อม Supabase เฉพาะฝั่ง backend ไม่ให้ static frontend ต่อ database โดยตรง

เหตุผล:

- Backend มี business rules สำคัญอยู่แล้ว เช่น JWT session, cart validation, stock reservation, checkout recalculation และ guardrail ห้าม client ส่งราคาเอง
- Supabase database คือ Postgres ส่วนโปรเจกต์นี้ปัจจุบันใช้ SQLite ผ่าน `sql.js`
- Frontend ที่เชื่อมไว้แล้วเรียก `backend` ผ่าน `js/apiClient.js` จึงไม่ต้องเปลี่ยน URL ฝั่งหน้าเว็บถ้า backend route ยังเหมือนเดิม

## 1. สร้าง Supabase Project

1. เข้า Supabase Dashboard แล้วสร้าง project ใหม่
2. ไปที่ `Project Settings > API` แล้วจดค่า:
   - `Project URL`
   - `anon public key`
3. ไปที่หน้า `Connect` ของ project แล้ว copy database connection string

สำหรับ Express backend ที่รันยาว ๆ ให้เริ่มจาก connection แบบ `Session pooler` หรือ direct connection ถ้า environment รองรับ IPv6 ได้ดี ส่วน serverless ควรใช้ `Transaction pooler`

## 2. ตั้งค่า Environment

สร้างหรือแก้ `backend/.env`

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=*
JWT_SECRET=replace-with-a-long-random-secret

# Supabase Postgres connection string
DATABASE_URL=postgres://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
```

อย่าใส่ `service_role` key ใน frontend เด็ดขาด ถ้าต้องใช้ service role ให้เก็บไว้เฉพาะ backend env เท่านั้น

## 3. ติดตั้ง Postgres Driver

ในโฟลเดอร์ `backend`

```bash
npm install pg
```

แล้วค่อยลบ `sql.js` หลัง migrate เสร็จและทดสอบผ่านแล้ว

## 4. แปลง Schema จาก SQLite เป็น Postgres

ไฟล์ migration ปัจจุบันอยู่ที่:

- `backend/database/migrations/001_initial_schema.sql`
- `backend/database/migrations/002_cart_schema.sql`
- `backend/database/migrations/003_order_discount_audit.sql`

ต้องแปลง syntax สำคัญ:

| SQLite เดิม | Postgres/Supabase |
| --- | --- |
| `INTEGER ... CHECK (x IN (0, 1))` | `boolean NOT NULL DEFAULT false` |
| `datetime('now')` | `now()` |
| `NUMERIC` | `numeric` |
| `TEXT` | `text` |
| `ALTER TABLE ... ADD COLUMN ... CHECK` | ใช้ได้ แต่ควรรันหลังสร้าง table แล้ว |

ตัวอย่าง users table แบบ Postgres:

```sql
create table if not exists users (
  user_id text primary key,
  username text not null,
  email text not null unique,
  password_hash text not null,
  is_logged_in boolean not null default false,
  token text,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

ตัวอย่าง partial unique index ใช้ได้ใน Postgres:

```sql
create unique index if not exists idx_active_carts_user_id
  on carts(user_id)
  where user_id is not null and status = 'active';
```

วิธีรัน schema ที่ง่ายที่สุด:

1. เปิด Supabase Dashboard
2. ไปที่ `SQL Editor`
3. สร้าง query ใหม่
4. วาง SQL ที่แปลงแล้ว
5. กด Run

ถ้าต้องทำงานเป็นทีม ให้ใช้ Supabase CLI migrations แทน SQL Editor เพื่อเก็บ migration history ใน git

## 5. เปลี่ยน Database Adapter ใน Backend

ไฟล์ที่ต้องเปลี่ยนหลักคือ `backend/src/database/connection.js`

ตัวอย่าง adapter ด้วย `pg`:

```js
const { Pool } = require('pg');
const { config } = require('../config/env');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function openDatabase() {
  return pool.connect();
}

async function closeDatabase(client) {
  client.release();
}

async function run(client, sql, params = []) {
  const result = await client.query(sql, params);
  return { changes: result.rowCount };
}

async function get(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0];
}

async function all(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

async function exec(client, sql) {
  await client.query(sql);
}

async function withTransaction(client, work) {
  await client.query('BEGIN');
  try {
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

module.exports = {
  all,
  closeDatabase,
  exec,
  get,
  openDatabase,
  run,
  withTransaction
};
```

## 6. แปลง SQL Placeholder

โค้ด service ตอนนี้ใช้ placeholder แบบ SQLite:

```sql
where product_id = ?
```

แต่ `pg` ต้องใช้:

```sql
where product_id = $1
```

ถ้ามีหลายค่า:

```sql
where email = $1 or username = $2
```

ดังนั้นต้องแก้ query ในไฟล์:

- `backend/src/services/auth.service.js`
- `backend/src/services/product.service.js`
- `backend/src/services/cart.service.js`
- `backend/src/services/checkout.service.js`
- `backend/src/services/inventory.service.js`
- `backend/src/database/audit.js`
- `backend/src/database/migrate.js`
- `backend/src/database/seed.js`

จุดที่ต้องระวังเป็นพิเศษ:

- `ON CONFLICT(cart_id, product_id) DO UPDATE` ใช้ได้ใน Postgres
- `datetime('now')` ใน query runtime ต้องเปลี่ยนเป็น `now()`
- boolean จาก Postgres จะกลับมาเป็น `true/false` ไม่ใช่ `0/1` ดังนั้น mapping ที่ใช้ `Number(row.is_recurring) === 1` ควรเปลี่ยนเป็น `Boolean(row.is_recurring)`

## 7. Seed ข้อมูล

หลังแปลง seed script แล้วรัน:

```bash
cd backend
npm run db:seed
```

ตรวจใน Supabase Table Editor ว่ามีข้อมูล:

- `products`
- `users`
- `carts`
- `orders`
- `order_items`
- `payments`

## 8. ทดสอบ Backend

```bash
cd backend
npm run smoke:test
npm run dev
```

ตรวจ health:

```bash
curl http://localhost:3001/api/health
```

ทดสอบ product:

```bash
curl http://localhost:3001/api/products
```

ทดสอบ login ด้วย seeded user:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"<seed-user-email>\",\"password\":\"password\"}"
```

## 9. Frontend ไม่ต้องต่อ Supabase โดยตรง

Frontend ตอนนี้ใช้ `js/apiClient.js` และเรียก backend ที่:

```js
http://localhost:3001/api
```

ถ้า backend deploy แล้ว ให้ตั้ง base URL ใหม่ใน browser console:

```js
localStorage.setItem('ecoApiBaseUrl', 'https://your-backend.example.com/api');
location.reload();
```

## 10. Production Checklist

- ตั้ง `JWT_SECRET` เป็น secret ยาวและสุ่มจริง
- ตั้ง `CORS_ORIGIN` เป็น frontend origin จริง ไม่ใช้ `*`
- เปิด RLS เฉพาะกรณี frontend/Supabase client ต้องเข้าตารางโดยตรง
- ถ้า backend เป็นคนเดียวที่ query DB ผ่าน connection string, ใช้ backend authorization เป็นหลักและอย่า expose DB password
- เก็บ `.env` นอก git
- ทดสอบ checkout ว่า stock ถูกลดและ cart เปลี่ยนเป็น `checked_out`

## อ้างอิง

- Supabase connection strings: https://supabase.com/docs/reference/postgres/connection-strings
- Supabase JavaScript client initialization: https://supabase.com/docs/reference/javascript/initializing
- Supabase Postgres.js guide: https://supabase.com/docs/guides/database/postgres-js
- Supabase database migrations: https://supabase.com/docs/guides/deployment/database-migrations
