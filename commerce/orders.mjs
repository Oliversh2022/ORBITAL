import { randomUUID } from "node:crypto";
import { withTransaction } from "./database.mjs";

function orderError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function toCents(value) {
  return Math.round(Number(value) * 100);
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

export async function createOrderDraftFromCart(cartId, { shippingFee, reservationSeconds = 900 }) {
  const expiresIn = Math.min(3_600, Math.max(60, Number(reservationSeconds) || 900));
  const feeCents = toCents(shippingFee);
  if (!Number.isSafeInteger(feeCents) || feeCents < 0) {
    throw orderError("shipping_configuration_invalid", "配送费用配置无效。");
  }

  return withTransaction(async (client) => {
    const expired = await client.query(`
      UPDATE inventory_reservations
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'reserved' AND expires_at <= NOW()
      RETURNING variant_id, quantity
    `);
    for (const row of expired.rows) {
      await client.query(`
        UPDATE product_variants
        SET reserved_quantity = GREATEST(0, reserved_quantity - $2), updated_at = NOW()
        WHERE variant_id = $1
      `, [row.variant_id, row.quantity]);
    }

    const cartResult = await client.query(
      "SELECT cart_id, status, currency_code FROM carts WHERE cart_id = $1 FOR UPDATE",
      [cartId],
    );
    const cart = cartResult.rows[0];
    if (!cart || cart.status !== "active") throw orderError("cart_unavailable", "购物袋当前不可用，请刷新后重试。");

    const priorReservations = await client.query(`
      UPDATE inventory_reservations
      SET status = 'released', updated_at = NOW()
      WHERE cart_id = $1 AND status = 'reserved'
      RETURNING variant_id, quantity
    `, [cartId]);
    for (const row of priorReservations.rows) {
      await client.query(`
        UPDATE product_variants
        SET reserved_quantity = GREATEST(0, reserved_quantity - $2), updated_at = NOW()
        WHERE variant_id = $1
      `, [row.variant_id, row.quantity]);
    }
    await client.query(`
      UPDATE orders SET status = 'cancelled', updated_at = NOW()
      WHERE cart_id = $1 AND status = 'pending_details'
    `, [cartId]);

    const itemsResult = await client.query(`
      SELECT ci.variant_id, ci.quantity, p.slug, p.name_zh, p.status AS product_status,
        p.is_sellable, pv.sku, pv.title_zh, pv.price_amount, pv.currency_code,
        pv.stock_quantity, pv.reserved_quantity, pv.is_active
      FROM cart_items ci
      JOIN product_variants pv ON pv.variant_id = ci.variant_id
      JOIN products p ON p.product_id = pv.product_id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at
      FOR UPDATE OF ci, pv, p
    `, [cartId]);
    if (!itemsResult.rows.length) throw orderError("cart_empty", "购物袋为空，无法创建订单草稿。");

    const unavailable = itemsResult.rows.filter((row) =>
      row.product_status !== "active" || !row.is_sellable || !row.is_active
      || Number(row.stock_quantity) - Number(row.reserved_quantity) < Number(row.quantity)
      || row.currency_code.trim() !== "CNY",
    );
    if (unavailable.length) {
      throw orderError("inventory_unavailable", "部分商品不可购买、库存不足或币种不一致。", unavailable.map((row) => ({
        slug: row.slug, sku: row.sku, code: "unavailable", message: "请返回购物袋更新商品后重试。",
      })));
    }

    const subtotalCents = itemsResult.rows.reduce((sum, row) => sum + toCents(row.price_amount) * Number(row.quantity), 0);
    const totalCents = subtotalCents + feeCents;
    const orderId = randomUUID();
    const orderNumber = `OR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${orderId.slice(0, 8).toUpperCase()}`;
    const orderResult = await client.query(`
      INSERT INTO orders (order_id, order_number, cart_id, status, currency_code, item_subtotal, shipping_method, shipping_fee, total_amount)
      VALUES ($1, $2, $3, 'pending_details', $4, $5, 'standard', $6, $7)
      RETURNING order_id, order_number, status, currency_code, item_subtotal, shipping_fee, total_amount, created_at
    `, [orderId, orderNumber, cartId, cart.currency_code.trim(), fromCents(subtotalCents), fromCents(feeCents), fromCents(totalCents)]);

    const reservations = [];
    for (const row of itemsResult.rows) {
      const quantity = Number(row.quantity);
      await client.query(`
        INSERT INTO order_items (order_id, variant_id, product_slug, product_name, sku, variant_title, quantity, unit_price, line_total, currency_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [orderId, row.variant_id, row.slug, row.name_zh, row.sku, row.title_zh, quantity,
        fromCents(toCents(row.price_amount)), fromCents(toCents(row.price_amount) * quantity), row.currency_code.trim()]);

      const reservationResult = await client.query(`
        INSERT INTO inventory_reservations (cart_id, order_id, variant_id, quantity, expires_at)
        VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 second'))
        RETURNING reservation_id, variant_id, quantity, status, expires_at
      `, [cartId, orderId, row.variant_id, quantity, expiresIn]);
      await client.query(`
        UPDATE product_variants SET reserved_quantity = reserved_quantity + $2, updated_at = NOW()
        WHERE variant_id = $1
      `, [row.variant_id, quantity]);
      reservations.push(reservationResult.rows[0]);
    }

    return {
      order: orderResult.rows[0],
      reservations: { cartId, currency: cart.currency_code.trim(), expiresIn, reservations },
      lines: itemsResult.rows.map((row) => {
        const unitPriceCents = toCents(row.price_amount);
        const quantity = Number(row.quantity);
        return {
          slug: row.slug,
          variantId: row.variant_id,
          sku: row.sku,
          variantTitle: row.title_zh,
          name: row.name_zh,
          quantity,
          unitPrice: fromCents(unitPriceCents),
          currency: row.currency_code.trim(),
          lineTotal: fromCents(unitPriceCents * quantity),
        };
      }),
    };
  });
}
