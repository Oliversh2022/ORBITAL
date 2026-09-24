import { randomUUID } from "node:crypto";
import { query } from "./database.mjs";

const SESSION_TOKEN_PATTERN = /^[0-9a-f-]{36}$/i;

function isValidSessionToken(value) {
  return typeof value === "string" && SESSION_TOKEN_PATTERN.test(value);
}

export async function ensureCart(sessionToken) {
  let token = isValidSessionToken(sessionToken) ? sessionToken : randomUUID();
  let result = await query("SELECT cart_id, session_token, status, currency_code FROM carts WHERE session_token = $1", [token]);
  if (result.rows[0]?.status === "active") return { ...result.rows[0], created: false };

  if (result.rows[0]) token = randomUUID();
  result = await query(`
    INSERT INTO carts (session_token, currency_code, status)
    VALUES ($1, 'CNY', 'active')
    RETURNING cart_id, session_token, status, currency_code
  `, [token]);
  return { ...result.rows[0], created: true };
}

export async function readCart(cartId) {
  const result = await query(`
    SELECT
      ci.cart_item_id,
      ci.quantity,
      pv.variant_id,
      pv.sku,
      pv.title_zh,
      p.slug,
      p.name_zh,
      pv.price_amount,
      pv.currency_code,
      GREATEST(pv.stock_quantity - pv.reserved_quantity, 0)::integer AS available_stock,
      pv.is_active
    FROM cart_items ci
    JOIN product_variants pv ON pv.variant_id = ci.variant_id
    JOIN products p ON p.product_id = pv.product_id
    WHERE ci.cart_id = $1
    ORDER BY ci.created_at
  `, [cartId]);

  return result.rows.map((row) => ({
    cartItemId: row.cart_item_id,
    slug: row.slug,
    name: row.name_zh,
    variantId: row.variant_id,
    sku: row.sku,
    variantTitle: row.title_zh,
    quantity: row.quantity,
    unitPrice: Number(row.price_amount),
    currency: row.currency_code.trim(),
    availableStock: row.available_stock,
    variantActive: row.is_active,
  }));
}

export async function addCartItem(cartId, { variantId, quantity }) {
  const result = await query(`
    INSERT INTO cart_items (cart_id, variant_id, quantity)
    VALUES ($1, $2, $3)
    ON CONFLICT (cart_id, variant_id)
    DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
    RETURNING cart_item_id
  `, [cartId, variantId, quantity]);
  return result.rows[0];
}

export async function updateCartItem(cartId, key, quantity) {
  const result = await query(`
    UPDATE cart_items ci
    SET quantity = $3, updated_at = NOW()
    FROM product_variants pv
    JOIN products p ON p.product_id = pv.product_id
    WHERE ci.cart_id = $1 AND ci.variant_id = pv.variant_id AND (pv.variant_id::text = $2 OR p.slug = $2)
    RETURNING ci.cart_item_id
  `, [cartId, key, quantity]);
  return result.rows[0] || null;
}

export async function removeCartItem(cartId, key) {
  const result = await query(`
    DELETE FROM cart_items ci
    USING product_variants pv, products p
    WHERE ci.cart_id = $1 AND ci.variant_id = pv.variant_id AND pv.product_id = p.product_id AND (pv.variant_id::text = $2 OR p.slug = $2)
    RETURNING ci.cart_item_id
  `, [cartId, key]);
  return result.rows[0] || null;
}

export async function findActiveVariant(slug) {
  const result = await query(`
    SELECT pv.variant_id
    FROM product_variants pv
    JOIN products p ON p.product_id = pv.product_id
    WHERE p.slug = $1 AND pv.is_active = TRUE
    ORDER BY pv.created_at
    LIMIT 1
  `, [slug]);
  return result.rows[0] || null;
}
