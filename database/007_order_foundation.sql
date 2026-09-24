BEGIN;

-- Order ledger foundation. Checkout/customer PII is intentionally not stored yet.
CREATE TABLE IF NOT EXISTS orders (
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  cart_id UUID NOT NULL REFERENCES carts(cart_id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending_details'
    CHECK (status IN ('pending_details', 'awaiting_payment', 'paid', 'fulfilling', 'shipped', 'completed', 'cancelled', 'expired', 'refunded')),
  currency_code CHAR(3) NOT NULL DEFAULT 'CNY',
  item_subtotal NUMERIC(12, 2) NOT NULL CHECK (item_subtotal >= 0),
  shipping_method TEXT NOT NULL DEFAULT 'standard' CHECK (shipping_method = 'standard'),
  shipping_fee NUMERIC(12, 2) NOT NULL CHECK (shipping_fee >= 0),
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount = item_subtotal + shipping_fee),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(variant_id) ON DELETE SET NULL,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  variant_title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 20),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total = unit_price * quantity),
  currency_code CHAR(3) NOT NULL DEFAULT 'CNY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventory_reservations
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(order_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_cart_id ON orders(cart_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_id ON inventory_reservations(order_id);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE orders IS '订单金额与生命周期记录；暂不保存客户地址、联系方式或支付信息';
COMMENT ON TABLE order_items IS '下单时商品与价格快照 / Immutable product and price snapshots';
COMMENT ON COLUMN orders.status IS '订单状态；支付与履约状态流转由后续订单流程实现';
COMMENT ON COLUMN orders.total_amount IS '商品小计加配送费；由服务端计算并在订单创建事务中写入';
COMMENT ON COLUMN inventory_reservations.order_id IS '库存预占转入订单后关联的订单 ID';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orbital_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE orders, order_items TO orbital_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE inventory_reservations TO orbital_app';
  END IF;
END
$$;

COMMIT;
