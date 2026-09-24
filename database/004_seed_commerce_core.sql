BEGIN;

INSERT INTO product_variants (product_id, sku, title_zh, title_en, price_amount, currency_code, stock_quantity, reserved_quantity, is_active)
SELECT p.product_id, p.sku || '-STANDARD', '标准款', 'Standard', p.price_amount, p.currency_code, 0, 0, FALSE
FROM products p
WHERE p.sku IS NOT NULL
ON CONFLICT (sku) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  price_amount = EXCLUDED.price_amount,
  currency_code = EXCLUDED.currency_code;

COMMIT;
