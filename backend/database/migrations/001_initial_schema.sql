-- Initial relational schema for the Eco-Refill marketplace.
-- This file implements Session 7's Relational Persistence requirement:
-- normalized tables, primary keys, foreign keys, and integrity checks.

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_logged_in INTEGER NOT NULL DEFAULT 0 CHECK (is_logged_in IN (0, 1)),
  token TEXT,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Products are the source of truth for price and inventory. Checkout must read
-- price from this table instead of trusting client-side cart totals.
CREATE TABLE IF NOT EXISTS products (
  product_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT,
  description TEXT,
  price NUMERIC NOT NULL CHECK (price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Orders keep user/guest delivery and final server-calculated totals.
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  user_id TEXT,
  is_guest_checkout INTEGER NOT NULL DEFAULT 1 CHECK (is_guest_checkout IN (0, 1)),
  guest_name TEXT,
  guest_email TEXT,
  address TEXT NOT NULL,
  total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
  order_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (order_status IN ('pending', 'placed', 'completed', 'cancelled', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CHECK (
    (is_guest_checkout = 0 AND user_id IS NOT NULL)
    OR
    (is_guest_checkout = 1 AND guest_name IS NOT NULL AND guest_email IS NOT NULL)
  )
);

-- Order items snapshot the product price and discount at purchase time. This is
-- important because product prices may change later, but old receipts must stay
-- historically accurate.
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  is_recurring INTEGER NOT NULL DEFAULT 0 CHECK (is_recurring IN (0, 1)),
  frequency TEXT CHECK (frequency IN ('weekly', 'bi_weekly', 'monthly')),
  next_delivery_date TEXT,
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  discount_applied NUMERIC NOT NULL DEFAULT 0 CHECK (discount_applied >= 0),
  line_total NUMERIC NOT NULL CHECK (line_total >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
  CHECK (
    (is_recurring = 0 AND frequency IS NULL AND next_delivery_date IS NULL)
    OR
    (is_recurring = 1 AND frequency IS NOT NULL)
  )
);

-- Payment is intentionally allowed to be "bypassed" for the assignment, while
-- still keeping the relationship ready for real payment attempts/retries.
CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bypassed'
    CHECK (payment_method IN ('bypassed', 'bank_transfer', 'credit_card', 'cod')),
  payment_status TEXT NOT NULL DEFAULT 'bypassed'
    CHECK (payment_status IN ('bypassed', 'pending', 'completed', 'failed')),
  transaction_ref TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Indexes support the expected API queries: product filtering, user order
-- history, checkout item lookup, and future recommendation joins.
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
