BEGIN;

CREATE TABLE IF NOT EXISTS inventory_reservations (
  reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(variant_id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 20),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'released', 'expired', 'consumed')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expiry
  ON inventory_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_cart
  ON inventory_reservations(cart_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_variant
  ON inventory_reservations(variant_id, status);

DROP TRIGGER IF EXISTS trg_inventory_reservations_updated_at ON inventory_reservations;
CREATE TRIGGER trg_inventory_reservations_updated_at
BEFORE UPDATE ON inventory_reservations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE inventory_reservations IS '购物袋库存预占 / Inventory reservations for carts';
COMMENT ON COLUMN inventory_reservations.expires_at IS '预占过期时间，过期后可释放库存';
COMMENT ON COLUMN inventory_reservations.status IS 'reserved、released、expired 或 consumed';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orbital_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE inventory_reservations TO orbital_app';
    EXECUTE 'GRANT UPDATE (stock_quantity, reserved_quantity, updated_at) ON TABLE product_variants TO orbital_app';
  END IF;
END
$$;

COMMIT;
