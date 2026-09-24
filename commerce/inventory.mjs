import { query, withTransaction } from "./database.mjs";

function inventoryError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

async function releaseExpiredWithClient(client) {
  const expired = await client.query(`
      UPDATE inventory_reservations
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'reserved' AND expires_at <= NOW()
      RETURNING reservation_id, order_id, variant_id, quantity
  `);
  for (const row of expired.rows) {
    await client.query(`
      UPDATE product_variants
      SET reserved_quantity = GREATEST(0, reserved_quantity - $2), updated_at = NOW()
      WHERE variant_id = $1
    `, [row.variant_id, row.quantity]);
  }
  const expiredOrderIds = [...new Set(expired.rows.map((row) => row.order_id).filter(Boolean))];
  for (const orderId of expiredOrderIds) {
    await client.query(`
      UPDATE orders SET status = 'expired', updated_at = NOW()
      WHERE order_id = $1 AND status = 'pending_details'
        AND NOT EXISTS (SELECT 1 FROM inventory_reservations WHERE order_id = $1 AND status = 'reserved')
    `, [orderId]);
  }
  return expired.rows;
}

export async function releaseExpiredReservations() {
  return withTransaction(async (client) => releaseExpiredWithClient(client));
}

async function releaseCartReservationsWithClient(client, cartId) {
  const active = await client.query(`
    UPDATE inventory_reservations
    SET status = 'released', updated_at = NOW()
    WHERE cart_id = $1 AND status = 'reserved'
    RETURNING reservation_id, order_id, variant_id, quantity
  `, [cartId]);
  for (const row of active.rows) {
    await client.query(`
      UPDATE product_variants
      SET reserved_quantity = GREATEST(0, reserved_quantity - $2), updated_at = NOW()
      WHERE variant_id = $1
    `, [row.variant_id, row.quantity]);
  }
  const releasedOrderIds = [...new Set(active.rows.map((row) => row.order_id).filter(Boolean))];
  for (const orderId of releasedOrderIds) {
    await client.query(`
      UPDATE orders SET status = 'cancelled', updated_at = NOW()
      WHERE order_id = $1 AND status = 'pending_details'
        AND NOT EXISTS (SELECT 1 FROM inventory_reservations WHERE order_id = $1 AND status = 'reserved')
    `, [orderId]);
  }
  return active.rows;
}

export async function reserveCart(cartId, expiresInSeconds = 900) {
  const expiresIn = Math.min(3_600, Math.max(60, Number(expiresInSeconds) || 900));
  return withTransaction(async (client) => {
    await releaseExpiredWithClient(client);
    const cartResult = await client.query("SELECT cart_id, status, currency_code FROM carts WHERE cart_id = $1 FOR UPDATE", [cartId]);
    if (!cartResult.rows[0] || cartResult.rows[0].status !== "active") {
      throw inventoryError("cart_unavailable", "购物袋当前不可用。");
    }

    await releaseCartReservationsWithClient(client, cartId);
    const items = await client.query(`
      SELECT
        ci.variant_id,
        ci.quantity,
        p.slug,
        p.name_zh,
        p.status,
        p.is_sellable,
        pv.sku,
        pv.title_zh,
        pv.price_amount,
        pv.currency_code,
        pv.stock_quantity,
        pv.reserved_quantity,
        pv.is_active
      FROM cart_items ci
      JOIN product_variants pv ON pv.variant_id = ci.variant_id
      JOIN products p ON p.product_id = pv.product_id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at
      FOR UPDATE OF ci, pv, p
    `, [cartId]);
    if (!items.rows.length) throw inventoryError("cart_empty", "购物袋为空，无法预占库存。");

    const errors = [];
    for (const row of items.rows) {
      const available = Number(row.stock_quantity) - Number(row.reserved_quantity);
      if (row.status !== "active" || !row.is_sellable || !row.is_active || available < row.quantity) {
        errors.push({ slug: row.slug, sku: row.sku, code: "insufficient_stock", message: "商品库存不足或当前不可购买。" });
      }
    }
    if (errors.length) throw inventoryError("inventory_unavailable", "库存预占失败。", errors);

    const reservations = [];
    for (const row of items.rows) {
      const reservation = await client.query(`
        INSERT INTO inventory_reservations (cart_id, variant_id, quantity, expires_at)
        VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 second'))
        RETURNING reservation_id, variant_id, quantity, status, expires_at
      `, [cartId, row.variant_id, row.quantity, expiresIn]);
      await client.query(`
        UPDATE product_variants
        SET reserved_quantity = reserved_quantity + $2, updated_at = NOW()
        WHERE variant_id = $1
      `, [row.variant_id, row.quantity]);
      reservations.push(reservation.rows[0]);
    }
    return { cartId, currency: cartResult.rows[0].currency_code.trim(), expiresIn, reservations };
  });
}

async function changeReservation(reservationId, nextStatus, cartId = null) {
  return withTransaction(async (client) => {
    await releaseExpiredWithClient(client);
    const result = await client.query(`
      SELECT reservation_id, order_id, variant_id, quantity, status, expires_at
      FROM inventory_reservations
      WHERE reservation_id = $1 AND ($2::uuid IS NULL OR cart_id = $2)
      FOR UPDATE
    `, [reservationId, cartId]);
    const reservation = result.rows[0];
    if (!reservation) throw inventoryError("reservation_not_found", "库存预占不存在。");
    if (reservation.status !== "reserved") return reservation;

    if (nextStatus === "consumed") {
      const updatedVariant = await client.query(`
        UPDATE product_variants
        SET stock_quantity = stock_quantity - $2,
            reserved_quantity = reserved_quantity - $2,
            updated_at = NOW()
        WHERE variant_id = $1 AND stock_quantity >= $2 AND reserved_quantity >= $2
        RETURNING variant_id
      `, [reservation.variant_id, reservation.quantity]);
      if (!updatedVariant.rows[0]) throw inventoryError("inventory_mismatch", "库存状态已变化，无法完成扣减。");
    } else {
      await client.query(`
        UPDATE product_variants
        SET reserved_quantity = GREATEST(0, reserved_quantity - $2), updated_at = NOW()
        WHERE variant_id = $1
      `, [reservation.variant_id, reservation.quantity]);
    }

    const updated = await client.query(`
      UPDATE inventory_reservations
      SET status = $2, updated_at = NOW()
      WHERE reservation_id = $1
      RETURNING reservation_id, variant_id, quantity, status, expires_at
    `, [reservationId, nextStatus]);
    if (nextStatus === "released" && reservation.order_id) {
      await client.query(`
        UPDATE orders SET status = 'cancelled', updated_at = NOW()
        WHERE order_id = $1 AND status = 'pending_details'
          AND NOT EXISTS (SELECT 1 FROM inventory_reservations WHERE order_id = $1 AND status = 'reserved')
      `, [reservation.order_id]);
    }
    return updated.rows[0];
  });
}

export function releaseReservation(reservationId, cartId) {
  return changeReservation(reservationId, "released", cartId);
}

export function consumeReservation(reservationId) {
  return changeReservation(reservationId, "consumed");
}

export async function getInventorySummary() {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'reserved')::integer AS active_reservations,
      COALESCE(SUM(quantity) FILTER (WHERE status = 'reserved'), 0)::integer AS reserved_units
    FROM inventory_reservations
  `);
  return result.rows[0];
}
