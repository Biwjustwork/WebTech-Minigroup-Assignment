# Architecture Scorecard

This document is the backend presentation guide for the mini project. It maps the implementation to the architecture scoring categories from the assignment slides.

## Project Role

Role: Lead Architect (Backend/DevOps)

Responsibilities covered:

- Service layer
- SQL schema
- Relational persistence
- API security
- Checkout gatekeeper logic
- `.env` and go-live audit
- Bonus backend challenges

## System Summary

The backend turns the original static JSON/localStorage shop into a server-side source of truth.

Frontend still may use `localStorage` for continuity, but backend owns the critical business decisions:

- product price
- stock quantity
- authentication identity
- subscription discount
- dynamic discount
- final checkout total
- order and payment records

## Best Practice Evidence

| Category | Requirement | Backend Evidence |
| --- | --- | --- |
| 1. Version Control | Conventional commits and Git flow | Suggested commit names are documented per step, e.g. `feat(products): add product catalog api`. |
| 2. Data Flow | Separation of content and UI | Products are served from SQL through `GET /api/products`; frontend no longer needs to trust `products.json` as source of truth. |
| 3. Interaction | Event delegation and debouncing | Frontend-owned area. Backend supports this through filterable product API query params. |
| 4. State | Single source of truth and continuity | Cart persistence is stored in SQL tables `carts` and `cart_items`; guest continuity uses `X-Cart-Session-Id`. |
| 5. Security (Auth) | Architecture of Trust | `POST /api/auth/register`, `POST /api/auth/login`, bcrypt password hashing, JWT sessions, safe user response without `password_hash`. |
| 6. Security (API) | Gatekeeper Pattern | Backend rejects client-calculated fields and recalculates price, discounts, stock, and totals. |
| 7. Persistence | Relational Integrity (SQL) | SQL tables: `users`, `products`, `carts`, `cart_items`, `orders`, `order_items`, `payments`. |
| 8. SQL Safety | Parameterized Queries | DB helpers use `?` placeholders with params in `run`, `get`, and `all`. |
| 9. Structure | Controller-Route-Service | Routes, controllers, and services are separated under `src/routes`, `src/controllers`, `src/services`. |
| 10. Deployment | Zero-Config and `.env` Audit | `.env.example`, `.gitignore`, `npm run audit:deploy`, `DEPLOYMENT_AUDIT.md`. |

## Backend Structure

```text
backend/
  database/migrations/
  mock-data/
  scripts/
  src/
    config/
    controllers/
    database/
    middleware/
    routes/
    services/
    utils/
```

Key pattern:

```text
Route -> Controller -> Service -> Database
```

Example:

```text
GET /api/products
product.routes.js -> product.controller.js -> product.service.js -> products table
```

## Database Design

Core tables:

- `users`
- `products`
- `carts`
- `cart_items`
- `orders`
- `order_items`
- `payments`
- `schema_migrations`

Important relational rules:

- `orders.user_id` references `users.user_id`
- `order_items.order_id` references `orders.order_id`
- `order_items.product_id` references `products.product_id`
- `payments.order_id` references `orders.order_id`
- `cart_items.cart_id` references `carts.cart_id`
- `cart_items.product_id` references `products.product_id`

Integrity checks:

- product price must be non-negative
- stock quantity must be non-negative
- item quantity must be greater than zero
- recurring items must have a frequency
- one-time items must not have subscription frequency

Audit command:

```bash
npm run db:audit
```

## Product API

Endpoints:

```text
GET /api/products
GET /api/products/:productId
GET /api/products/:productId/recommendations
```

Supported filters:

- `keyword`
- `category`
- `minPrice`
- `maxPrice`
- `page`
- `limit`

Architecture point:

The product catalog is dynamic because the frontend can request filtered product data from the backend instead of hard-coding product cards.

## Auth API

Endpoints:

```text
POST /api/auth/register
POST /api/auth/login
GET /api/auth/verify-session
```

Security decisions:

- passwords are hashed with bcrypt
- JWT is used as stateless identity
- session verification checks both JWT validity and stored active token
- response never includes `password_hash`

Seeded demo login:

```text
email: alice@example.com
password: password
```

## Cart API

Endpoints:

```text
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/:productId
DELETE /api/cart/items/:productId
```

Guest cart continuity:

```text
X-Cart-Session-Id: <cartSessionId>
```

Logged-in cart:

```text
Authorization: Bearer <token>
```

Architecture point:

The cart is persisted in SQL and recalculated by the backend for display. The frontend may hydrate from localStorage, but backend remains the trusted source.

## Checkout Gatekeeper

Endpoint:

```text
POST /api/checkout
```

The client may send intent:

- product id
- quantity
- order type
- frequency
- address
- guest identity when guest checkout

The client must not send calculated money fields:

- `price`
- `unitPrice`
- `subtotal`
- `discount`
- `lineTotal`
- `total`

If those fields are sent, backend responds:

```text
400 CLIENT_CALCULATION_REJECTED
```

Backend recalculates:

- unit price from SQL
- stock availability
- subscription discount
- dynamic discount
- final total
- order item totals

## Eco-Refill Subscription Logic

Service:

```text
src/services/subscriptionDiscount.service.js
```

Rule:

```text
Apply 20% line-item discount only when:
item is recurring AND user is logged in
```

Examples:

- guest recurring item: no discount
- logged-in recurring item: 20% line discount

Audit fields:

- `order_items.discount_applied`
- `order_items.line_total`

## Bonus A: Stock Check

Service:

```text
src/services/inventory.service.js
```

Rule:

Checkout checks stock inside the transaction before order placement.

The inventory service uses:

```sql
UPDATE products
SET stock_quantity = stock_quantity - ?
WHERE product_id = ? AND stock_quantity >= ?
```

If stock is insufficient:

```text
409 OUT_OF_STOCK
```

Architecture point:

Stock decrement, order insert, order item insert, payment insert, and cart status update are in one transaction. If one fails, everything rolls back.

## Bonus B: Dynamic Discount

Service:

```text
src/services/discount.service.js
```

Rules:

- 10% off when recalculated cart total is greater than `$200`
- 15% off when more than 3 items are from `Fresh`
- if both match, backend applies the best discount

Audit columns:

- `orders.subtotal_amount`
- `orders.subscription_discount_amount`
- `orders.dynamic_discount_amount`
- `orders.dynamic_discount_reason`

Response proof:

```text
recalculatedBy: "backend"
```

## Bonus C: Recommendations

Endpoint:

```text
GET /api/products/:productId/recommendations
```

SQL strategy:

```text
orders -> target order_items -> recommended order_items -> products
```

Architecture point:

Recommendations are not hard-coded. They are computed with SQL joins over historical order data.

## Transaction Safety

Helper:

```text
withTransaction(db, async () => { ... })
```

Used by:

- migrations
- seed
- checkout

Checkout atomic flow:

```text
BEGIN
  validate checkout
  reserve stock
  insert order
  insert order items
  insert bypassed payment
  mark cart checked_out
COMMIT
```

If any step fails:

```text
ROLLBACK
```

## SQL Safety

Database helper shape:

```js
run(db, sql, params)
get(db, sql, params)
all(db, sql, params)
```

Safe pattern:

```sql
WHERE product_id = ?
```

Unsafe pattern avoided:

```js
`WHERE product_id = '${productId}'`
```

## Deployment Audit

Commands:

```bash
npm run audit:env
npm run db:audit
npm run smoke:test
npm run audit:deploy
```

`audit:deploy` verifies:

- environment file template exists
- `.env` is ignored
- local SQLite DB files are ignored
- config values are valid
- foreign keys and required tables exist
- backend starts and health check passes

Production note:

`NODE_ENV=production` hides stack traces from API error responses.

## Demo Commands

Run from `backend/`:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run audit:deploy
npm run dev
```

Useful demo requests:

```text
GET /api/health
GET /api/products?keyword=soap&limit=3
POST /api/auth/login
POST /api/cart/items
POST /api/checkout
GET /api/products/prod_01/recommendations
```

## Presentation Script

Short explanation:

```text
My backend implements the Lead Architect responsibilities. The system uses Express with Controller-Route-Service separation, SQL migrations, seeded relational data, JWT authentication, backend-side checkout recalculation, transaction-safe order placement, stock checks, dynamic discounts, and deployment audit scripts.
```

Gatekeeper explanation:

```text
The frontend is allowed to send intent, but it is not allowed to send trusted money values. The backend rejects client-calculated totals and recalculates price, discount, stock, and final total from SQL data inside a transaction.
```

Persistence explanation:

```text
localStorage can preserve browser continuity, but SQL is the backend source of truth for users, products, carts, orders, order items, payments, stock, and discounts.
```

## Recommended Commit Name

```text
docs(architecture): add backend scoring evidence
```

