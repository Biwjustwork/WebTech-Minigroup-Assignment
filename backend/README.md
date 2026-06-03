# Backend

Express API for The Smart-Niche Marketplace.

## Structure

- `src/server.js` starts the HTTP server.
- `src/app.js` configures Express middleware and routes.
- `src/config` contains environment/config loading.
- `src/routes` maps HTTP paths to controllers.
- `src/controllers` handles request/response concerns.
- `src/services` contains business logic.
- `src/database` contains SQLite connection and migration helpers.
- `database/migrations` contains SQL schema changes.
- `src/middleware` contains shared request middleware.
- `mock-data` keeps the original JSON data until database seeding is added.

## Run

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run db:audit
npm run dev
```

The API starts on `http://localhost:3001` by default.

The default SQLite database file is `backend/data/app.sqlite`.

Seeded demo users use the password `password`. Running `npm run db:seed` resets demo products, users, carts, and orders.

## Product API

List products:

```text
GET /api/products
GET /api/products?keyword=soap&category=Laundry&maxPrice=20&page=1&limit=6
```

Get one product:

```text
GET /api/products/prod_01
```

The list response returns `data` plus pagination `meta`.

## Authentication API

Register:

```text
POST /api/auth/register
Body: { "username": "Alice", "email": "alice@example.com", "password": "password" }
```

Login:

```text
POST /api/auth/login
Body: { "email": "alice@example.com", "password": "password" }
```

Verify a JWT session:

```text
GET /api/auth/verify-session
Authorization: Bearer <token>
```

The login response returns a JWT token plus a safe user object without `password_hash`.

## Cart API

Guest carts use `X-Cart-Session-Id`. If the header is missing, the API creates a new guest cart and returns `cartSessionId`.

```text
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/:productId
DELETE /api/cart/items/:productId
```

Add item body:

```json
{
  "productId": "prod_01",
  "quantity": 2,
  "orderType": "recurring",
  "frequency": "monthly"
}
```

Logged-in carts use `Authorization: Bearer <token>`. Recurring cart preview receives the 20% discount only for logged-in users.

## Checkout API

Checkout from the current cart:

```text
POST /api/checkout
Authorization: Bearer <token>
Body: { "address": "456 Member Road" }
```

Guest checkout:

```text
POST /api/checkout
X-Cart-Session-Id: <cartSessionId>
Body: { "guestName": "Guest", "guestEmail": "guest@example.com", "address": "123 Demo Street" }
```

Direct checkout payloads are also supported:

```json
{
  "guestName": "Guest",
  "guestEmail": "guest@example.com",
  "address": "123 Demo Street",
  "items": [
    { "productId": "prod_01", "quantity": 1, "orderType": "one-time" }
  ]
}
```

Checkout recalculates price, discount, stock, and totals on the backend. Payment is recorded as `bypassed`.

Client-sent calculated fields are rejected. Do not send `price`, `unitPrice`, `subtotal`, `discount`, `lineTotal`, or `total`; the backend calculates them from SQL product data.

## Eco-Refill Subscription Discount

Subscription pricing is centralized in `src/services/subscriptionDiscount.service.js`.

Rule:

```text
Apply 20% line-item discount only when item is recurring AND the user is logged in.
```

Guest recurring carts/orders keep the normal one-time price. Checkout records the final `discount_applied` in `order_items`.

## Gatekeeper Security

The API uses backend-side guardrails:

- `helmet` security headers
- JSON payload limit of `100kb`
- parameterized SQL helpers
- centralized `withTransaction` helper for atomic writes
- `npm run db:audit` to verify required tables and foreign keys
- strict cart/checkout item validation
- server-side price, discount, stock, and total calculation
- rejection of client-calculated fields with `CLIENT_CALCULATION_REJECTED`

## Bonus A: Pre-Checkout Inventory Check

Inventory logic is centralized in `src/services/inventory.service.js`.

Checkout runs stock logic inside the same transaction as order creation:

1. Read product price and `stock_quantity` from SQL.
2. Reject with `409 OUT_OF_STOCK` if stock is insufficient.
3. Reserve stock with an atomic conditional update.
4. Continue inserting `orders`, `order_items`, and bypassed `payments`.
5. Roll back the whole transaction if any step fails.
