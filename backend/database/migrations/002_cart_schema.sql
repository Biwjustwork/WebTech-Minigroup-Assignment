-- Cart persistence for Session 4 continuity plus backend-side cart validation.
-- Guest carts are linked by session_id from the frontend, while logged-in carts
-- are linked by user_id from JWT auth.

CREATE TABLE IF NOT EXISTS carts (
  cart_id TEXT PRIMARY KEY,
  user_id TEXT,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'checked_out', 'abandoned')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  is_recurring INTEGER NOT NULL DEFAULT 0 CHECK (is_recurring IN (0, 1)),
  frequency TEXT CHECK (frequency IN ('weekly', 'bi_weekly', 'monthly')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
  UNIQUE (cart_id, product_id),
  CHECK (
    (is_recurring = 0 AND frequency IS NULL)
    OR
    (is_recurring = 1 AND frequency IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_carts_user_id
  ON carts(user_id)
  WHERE user_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_carts_session_id
  ON carts(session_id)
  WHERE session_id IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

