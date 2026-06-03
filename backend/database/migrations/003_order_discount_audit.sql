-- Order-level discount audit fields for Bonus B Dynamic Discount Service.
-- These values prove the final total was recalculated on the backend.

ALTER TABLE orders ADD COLUMN subtotal_amount NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0);
ALTER TABLE orders ADD COLUMN subscription_discount_amount NUMERIC NOT NULL DEFAULT 0 CHECK (subscription_discount_amount >= 0);
ALTER TABLE orders ADD COLUMN dynamic_discount_amount NUMERIC NOT NULL DEFAULT 0 CHECK (dynamic_discount_amount >= 0);
ALTER TABLE orders ADD COLUMN dynamic_discount_reason TEXT;

