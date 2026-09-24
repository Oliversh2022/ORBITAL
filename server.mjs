import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureCart, addCartItem, readCart, updateCartItem, removeCartItem } from "./commerce/cart.mjs";
import { findProduct, getCatalogRuntimeSource, getPublicCatalog, loadRuntimeCatalog, quoteCart, selectProductVariant, toPublicProduct } from "./commerce/catalog.mjs";
import { getInventorySummary, releaseExpiredReservations, releaseReservation, reserveCart } from "./commerce/inventory.mjs";
import { getShippingQuote } from "./commerce/shipping.mjs";
import { createOrderDraftFromCart } from "./commerce/orders.mjs";
import {
  addMedusaCartItem,
  createMedusaCart,
  getMedusaCatalog,
  getMedusaProduct,
  isMedusaCartConfigured,
  isMedusaStoreConfigured,
  mapMedusaCart,
  quoteMedusaCart,
  removeMedusaCartItem,
  retrieveMedusaCart,
  updateMedusaCartItem,
} from "./commerce/medusa-store.mjs";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const pagesRoot = resolve(projectRoot, "references", "TraeWEBTEST", "pages");
const assetsRoot = resolve(projectRoot, "references", "TraeWEBTEST", "assets");
const port = Number(process.env.PORT || 3002);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function safePath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const clean = normalize(decoded).replace(/^([/\\])+/, "");
  const absolute = resolve(root, clean);
  const rel = relative(root, absolute);
  return rel.startsWith("..") || rel.includes(`..${process.platform === "win32" ? "\\" : "/"}`) ? null : absolute;
}

function serveFile(response, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-cache",
  });
  createReadStream(filePath).pipe(response);
}

function serveNotFound(response, pathname) {
  const notFound = join(pagesRoot, "404.html");
  if (!existsSync(notFound)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(404, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
  createReadStream(notFound).pipe(response);
  console.warn(`Static route not found: ${pathname}`);
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  response.end(body);
}

function parseCookies(header = "") {
  return header.split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function cartSessionCookie(token) {
  return `orbital_cart_session=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`;
}

function medusaCartSessionCookie(cartId) {
  return `orbital_medusa_cart_id=${encodeURIComponent(cartId)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`;
}

async function getCartContext(request, response) {
  const cookies = parseCookies(request.headers.cookie || "");
  const cart = await ensureCart(cookies.orbital_cart_session);
  if (cart.created || cart.session_token !== cookies.orbital_cart_session) {
    response.setHeader("Set-Cookie", cartSessionCookie(cart.session_token));
  }
  return cart;
}

async function getMedusaCartContext(request, response) {
  const cookies = parseCookies(request.headers.cookie || "");
  let cart = await retrieveMedusaCart(cookies.orbital_medusa_cart_id);
  if (!cart) {
    if (!isMedusaCartConfigured()) return null;
    cart = await createMedusaCart();
  }
  if (!cart) return null;
  if (cart.id !== cookies.orbital_medusa_cart_id) {
    response.setHeader("Set-Cookie", medusaCartSessionCookie(cart.id));
  }
  return cart;
}

function cartResponse(cart, items) {
  return {
    cart: {
      id: cart.cart_id,
      currency: cart.currency_code.trim(),
      status: cart.status,
      items,
    },
  };
}

function quantityFrom(value) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 20 ? quantity : null;
}

function readJsonBody(request) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 256 * 1024) reject(new Error("请求体过大。"));
    });
    request.on("end", () => {
      try { resolveBody(body ? JSON.parse(body) : {}); }
      catch (_) { reject(new Error("请求体不是有效 JSON。")); }
    });
    request.on("error", reject);
  });
}

async function handleApi(request, response, url) {
  if (!url.pathname.startsWith("/api/")) return false;

  if (url.pathname === "/api/health" && request.method === "GET") {
    if (isMedusaStoreConfigured()) {
      const catalog = await getMedusaCatalog();
      sendJson(response, 200, {
        status: "ok",
        catalogSource: "medusa",
        products: catalog.products.length,
        cartReady: isMedusaCartConfigured(),
      });
      return true;
    }
    await loadRuntimeCatalog();
    const inventory = getCatalogRuntimeSource() === "postgres" ? await getInventorySummary() : null;
    sendJson(response, 200, { status: "ok", catalogSource: getCatalogRuntimeSource(), inventory });
    return true;
  }

  if (url.pathname === "/api/catalog/products" && request.method === "GET") {
    if (isMedusaStoreConfigured()) {
      const catalog = await getMedusaCatalog();
      if (url.searchParams.get("featured") === "true") {
        sendJson(response, 200, {
          ...catalog,
          products: catalog.products.filter((product) => product.featured),
        });
        return true;
      }
      sendJson(response, 200, catalog);
      return true;
    }
    const catalog = await getPublicCatalog();
    if (url.searchParams.get("featured") === "true") {
      catalog.products = catalog.products.filter((product) => product.featured);
    }
    sendJson(response, 200, catalog);
    return true;
  }

  if (url.pathname.startsWith("/api/catalog/products/") && request.method === "GET") {
    const slug = decodeURIComponent(url.pathname.slice("/api/catalog/products/".length));
    if (isMedusaStoreConfigured()) {
      const product = await getMedusaProduct(slug);
      if (!product) {
        sendJson(response, 404, { error: "product_not_found", message: "商品不存在。" });
        return true;
      }
      sendJson(response, 200, { product });
      return true;
    }
    const product = await findProduct(slug);
    if (!product) {
      sendJson(response, 404, { error: "product_not_found", message: "商品不存在。" });
      return true;
    }
    sendJson(response, 200, { product: toPublicProduct(product) });
    return true;
  }

  if (url.pathname === "/api/cart/quote" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      sendJson(response, 200, isMedusaStoreConfigured()
        ? await quoteMedusaCart(payload.items)
        : await quoteCart(payload.items));
    } catch (error) {
      sendJson(response, error.code === "cart_validation_failed" ? 409 : 400, {
        error: error.code || "invalid_request",
        message: error.message,
        details: error.details || undefined,
      });
    }
    return true;
  }

  if (url.pathname === "/api/checkout/shipping-quote" && request.method === "GET") {
    if (isMedusaStoreConfigured()) {
      sendJson(response, 200, {
        shipping: {
          method: url.searchParams.get("method") || "standard",
          status: "not_configured",
          fee: null,
          currency: "CNY",
          message: "配送地区与费率尚未配置。",
        },
      });
      return true;
    }
    try {
      const shipping = getShippingQuote(url.searchParams.get("method") || "standard");
      sendJson(response, 200, { shipping });
    } catch (error) {
      sendJson(response, error.code === "shipping_configuration_invalid" ? 503 : 422, {
        error: error.code || "shipping_quote_failed",
        message: error.message,
      });
    }
    return true;
  }

  if (url.pathname === "/api/cart/reserve" && request.method === "POST") {
    if (isMedusaStoreConfigured()) {
      sendJson(response, 409, {
        error: "checkout_not_configured",
        message: "配送地区、运费与库存尚未配置，当前不会暂留或扣减库存。",
      });
      return true;
    }
    try {
      const payload = await readJsonBody(request);
      const cart = await getCartContext(request, response);
      const reservation = await reserveCart(cart.cart_id, payload.expiresInSeconds);
      sendJson(response, 201, { reservation });
    } catch (error) {
      const statusCode = error.code === "database_unavailable" ? 503 : error.code === "reservation_not_found" ? 404 : 409;
      sendJson(response, statusCode, {
        error: error.code || "reservation_failed",
        message: error.message,
        details: error.details || undefined,
      });
    }
    return true;
  }

  if (url.pathname === "/api/checkout/prepare" && request.method === "POST") {
    if (isMedusaStoreConfigured()) {
      sendJson(response, 409, {
        error: "shipping_not_configured",
        message: "Medusa 后台尚未配置销售地区、配送费率和支付方式，暂不能提交订单。",
      });
      return true;
    }
    try {
      const payload = await readJsonBody(request);
      const requiredFields = ["fullName", "phone", "province", "city", "district", "addressLine"];
      const invalidFields = requiredFields.filter((field) => typeof payload[field] !== "string" || !payload[field].trim());
      const fieldLimits = { fullName: 100, phone: 30, province: 80, city: 80, district: 80, addressLine: 240 };
      for (const [field, limit] of Object.entries(fieldLimits)) {
        if (typeof payload[field] === "string" && payload[field].trim().length > limit && !invalidFields.includes(field)) invalidFields.push(field);
      }
      const phone = typeof payload.phone === "string" ? payload.phone.replace(/[\s()-]/g, "") : "";
      if (invalidFields.length || phone.length < 7 || phone.length > 20 || !/^\+?[0-9]+$/.test(phone)) {
        sendJson(response, 422, {
          error: "checkout_details_invalid",
          message: "请补全收货信息，并检查联系电话。",
          fields: invalidFields,
        });
        return true;
      }
      if (payload.deliveryMethod !== "standard") {
        sendJson(response, 422, { error: "delivery_method_unavailable", message: "当前只开放普通配送方案。" });
        return true;
      }
      const delivery = getShippingQuote(payload.deliveryMethod);
      if (delivery.status !== "configured") {
        sendJson(response, 409, {
          error: "shipping_not_configured",
          message: "普通配送费用尚未配置，暂时不能确认结账或暂留库存。",
        });
        return true;
      }

      const cart = await getCartContext(request, response);
      const created = await createOrderDraftFromCart(cart.cart_id, { shippingFee: delivery.fee, reservationSeconds: 900 });
      const quote = {
        currency: created.order.currency_code.trim(),
        lines: created.lines,
        itemSubtotal: Number(created.order.item_subtotal),
        subtotal: Number(created.order.item_subtotal),
        shippingFee: Number(created.order.shipping_fee),
        total: Number(created.order.total_amount),
      };
      sendJson(response, 201, {
        status: "draft_created",
        order: created.order,
        quote,
        delivery,
        reservation: created.reservations,
        message: "订单草稿已创建，库存已暂留 15 分钟。收货信息仅在本次请求中校验，不会保存；订单仍待补充收货信息，尚未创建支付或履约任务。",
      });
    } catch (error) {
      const statusCode = error.code === "cart_validation_failed" || error.code === "inventory_unavailable" ? 409
        : error.code === "database_unavailable" || error.code === "catalog_unavailable" ? 503
          : error.code === "shipping_configuration_invalid" ? 503
          : ["cart_empty", "cart_unavailable"].includes(error.code) ? 409 : 400;
      sendJson(response, statusCode, {
        error: error.code || "checkout_prepare_failed",
        message: error.message || "暂时无法准备结账。",
        details: error.details || undefined,
      });
    }
    return true;
  }

  if (url.pathname.startsWith("/api/inventory/reservations/") && request.method === "POST") {
    if (isMedusaStoreConfigured()) {
      sendJson(response, 409, {
        error: "checkout_not_configured",
        message: "当前购物袋未创建 Medusa 订单，因此没有可操作的库存预留。",
      });
      return true;
    }
    const path = url.pathname.slice("/api/inventory/reservations/".length);
    const separator = path.lastIndexOf("/");
    const reservationId = separator >= 0 ? path.slice(0, separator) : "";
    const action = separator >= 0 ? path.slice(separator + 1) : "";
    if (action === "consume") {
      sendJson(response, 409, { error: "order_required", message: "库存扣减需要由正式订单流程触发。" });
      return true;
    }
    if (!reservationId || action !== "release") {
      sendJson(response, 404, { error: "inventory_route_not_found", message: "库存接口不存在。" });
      return true;
    }
    try {
      const cart = await getCartContext(request, response);
      const reservation = await releaseReservation(decodeURIComponent(reservationId), cart.cart_id);
      sendJson(response, 200, { reservation });
    } catch (error) {
      const statusCode = error.code === "database_unavailable" ? 503 : error.code === "reservation_not_found" ? 404 : 409;
      sendJson(response, statusCode, {
        error: error.code || "inventory_action_failed",
        message: error.message,
        details: error.details || undefined,
      });
    }
    return true;
  }

  if (url.pathname === "/api/cart" && request.method === "GET") {
    if (isMedusaStoreConfigured()) {
      const cart = await getMedusaCartContext(request, response);
      sendJson(response, 200, {
        cart: cart
          ? mapMedusaCart(cart)
          : { id: null, currency: "CNY", status: "region_required", items: [] },
        cartReady: Boolean(cart),
        message: cart ? undefined : "Medusa 销售地区尚未配置，购物袋暂不可持久化。",
      });
      return true;
    }
    const cart = await getCartContext(request, response);
    sendJson(response, 200, cartResponse(cart, await readCart(cart.cart_id)));
    return true;
  }

  if (url.pathname === "/api/cart/items" && request.method === "POST") {
    const payload = await readJsonBody(request);
    const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
    const requestedVariantId = typeof payload.variantId === "string" ? payload.variantId.trim() : "";
    const quantity = quantityFrom(payload.quantity);
    if (!slug || !quantity) {
      sendJson(response, 400, { error: "invalid_cart_item", message: "商品和数量格式无效。" });
      return true;
    }
    if (isMedusaStoreConfigured()) {
      const product = await getMedusaProduct(slug);
      const variant = product?.variants.find((entry) => entry.id === requestedVariantId);
      if (!product || !variant) {
        sendJson(response, 404, { error: "product_not_found", message: "商品不存在或规格已失效。" });
        return true;
      }
      if (!product.sellable || variant.availableStock < quantity) {
        sendJson(response, 409, { error: "unavailable", message: "该商品当前为预览状态，尚未开放购买。" });
        return true;
      }
      try {
        const cart = await getMedusaCartContext(request, response);
        if (!cart) {
          sendJson(response, 409, {
            error: "region_not_configured",
            message: "尚未配置销售地区，当前不能创建 Medusa 购物袋。",
          });
          return true;
        }
        const updated = await addMedusaCartItem(cart.id, variant.id, quantity);
        sendJson(response, 200, { cart: mapMedusaCart(updated) });
      } catch (error) {
        sendJson(response, error.status || 503, {
          error: error.code || "medusa_cart_failed",
          message: error.message,
        });
      }
      return true;
    }
    const product = await findProduct(slug);
    if (!product) {
      sendJson(response, 404, { error: "product_not_found", message: "商品不存在。" });
      return true;
    }
    const publicProduct = toPublicProduct(product);
    const variant = selectProductVariant(product, requestedVariantId);
    if (!publicProduct.availableForPurchase || !variant) {
      sendJson(response, 409, { error: requestedVariantId ? "variant_unavailable" : "unavailable", message: "该商品当前不可购买或没有可用规格。" });
      return true;
    }
    const variantStock = Number(variant.availableStock ?? variant.stock ?? 0);
    if (quantity > variantStock) {
      sendJson(response, 409, { error: "insufficient_stock", message: "商品库存不足。" });
      return true;
    }
    const cart = await getCartContext(request, response);
    const existingItem = (await readCart(cart.cart_id)).find((item) => item.variantId === variant.id);
    if (existingItem && existingItem.quantity + quantity > 20) {
      sendJson(response, 400, { error: "quantity_limit", message: "同一规格最多加入 20 件。" });
      return true;
    }
    if (existingItem && existingItem.quantity + quantity > variantStock) {
      sendJson(response, 409, { error: "insufficient_stock", message: "商品库存不足。" });
      return true;
    }
    await addCartItem(cart.cart_id, { variantId: variant.id, quantity });
    sendJson(response, 200, cartResponse(cart, await readCart(cart.cart_id)));
    return true;
  }

  if (url.pathname.startsWith("/api/cart/items/") && request.method === "PATCH") {
    const slug = decodeURIComponent(url.pathname.slice("/api/cart/items/".length));
    const payload = await readJsonBody(request);
    const quantity = quantityFrom(payload.quantity);
    if (!quantity) {
      sendJson(response, 400, { error: "invalid_quantity", message: "商品数量必须是 1 到 20。" });
      return true;
    }
    if (isMedusaStoreConfigured()) {
      try {
        const cart = await getMedusaCartContext(request, response);
        const items = mapMedusaCart(cart).items;
        const item = items.find((entry) => entry.variantId === slug || entry.slug === slug);
        if (!item) {
          sendJson(response, 404, { error: "cart_item_not_found", message: "购物袋中没有该商品。" });
          return true;
        }
        const product = await getMedusaProduct(item.slug);
        const variant = product?.variants.find((entry) => entry.id === item.variantId);
        if (!product?.sellable || !variant || quantity > variant.availableStock) {
          sendJson(response, 409, { error: "unavailable", message: "商品当前不可购买或库存不足。" });
          return true;
        }
        const updated = await updateMedusaCartItem(cart.id, item.cartItemId, quantity);
        sendJson(response, 200, { cart: mapMedusaCart(updated) });
      } catch (error) {
        sendJson(response, error.status || 503, { error: error.code || "medusa_cart_failed", message: error.message });
      }
      return true;
    }
    const cart = await getCartContext(request, response);
    const updated = await updateCartItem(cart.cart_id, slug, quantity);
    if (!updated) {
      sendJson(response, 404, { error: "cart_item_not_found", message: "购物袋中没有该商品。" });
      return true;
    }
    sendJson(response, 200, cartResponse(cart, await readCart(cart.cart_id)));
    return true;
  }

  if (url.pathname.startsWith("/api/cart/items/") && request.method === "DELETE") {
    const slug = decodeURIComponent(url.pathname.slice("/api/cart/items/".length));
    if (isMedusaStoreConfigured()) {
      try {
        const cart = await getMedusaCartContext(request, response);
        const item = mapMedusaCart(cart).items.find((entry) => entry.variantId === slug || entry.slug === slug);
        if (!item) {
          sendJson(response, 404, { error: "cart_item_not_found", message: "购物袋中没有该商品。" });
          return true;
        }
        const updated = await removeMedusaCartItem(cart.id, item.cartItemId);
        sendJson(response, 200, { cart: mapMedusaCart(updated) });
      } catch (error) {
        sendJson(response, error.status || 503, { error: error.code || "medusa_cart_failed", message: error.message });
      }
      return true;
    }
    const cart = await getCartContext(request, response);
    const removed = await removeCartItem(cart.cart_id, slug);
    if (!removed) {
      sendJson(response, 404, { error: "cart_item_not_found", message: "购物袋中没有该商品。" });
      return true;
    }
    sendJson(response, 200, cartResponse(cart, await readCart(cart.cart_id)));
    return true;
  }

  sendJson(response, 404, { error: "api_route_not_found", message: "接口不存在。" });
  return true;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (await handleApi(request, response, url)) return;
    const pathname = url.pathname;
    if (pathname === "/ghost-fibers") return serveFile(response, join(pagesRoot, "ghost-fibers.html"));
    if (pathname === "/") return serveFile(response, join(pagesRoot, "index.html"));

    if (pathname.startsWith("/assets/")) {
      const filePath = safePath(assetsRoot, pathname.slice("/assets/".length));
      if (filePath && existsSync(filePath) && statSync(filePath).isFile()) return serveFile(response, filePath);
      return serveNotFound(response, pathname);
    }

    const filePath = safePath(pagesRoot, pathname);
    if (filePath && existsSync(filePath) && statSync(filePath).isFile()) return serveFile(response, filePath);
    return serveNotFound(response, pathname);
  } catch (error) {
    if (response.headersSent) return response.end();
    const statusCode = ["catalog_unavailable", "database_unavailable"].includes(error.code) ? 503 : 500;
    sendJson(response, statusCode, {
      error: error.code || "internal_error",
      message: error.code === "database_unavailable" ? "购物袋服务暂时不可用。" : statusCode === 503 ? "商品目录暂时不可用。" : "服务器暂时无法处理请求。",
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`CODEX_WEB26 static server: http://localhost:${port}`);
  console.log(`Pages directory: ${pagesRoot}`);
});

if (getCatalogRuntimeSource() === "postgres") {
  const inventorySweep = setInterval(() => {
    releaseExpiredReservations().catch((error) => console.error(`Inventory sweep failed: ${error.message}`));
  }, 30_000);
  inventorySweep.unref();
}
