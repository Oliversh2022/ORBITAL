const baseUrl = process.env.MEDUSA_URL?.trim().replace(/\/+$/, "") || "";
const publishableKey = process.env.MEDUSA_PUBLISHABLE_KEY?.trim() || "";
const regionId = process.env.MEDUSA_REGION_ID?.trim() || "";
const catalogCacheMs = 2_000;

let catalogCache;
let catalogCacheAt = 0;

export function isMedusaStoreConfigured() {
  return Boolean(baseUrl && publishableKey);
}

export function isMedusaCartConfigured() {
  return isMedusaStoreConfigured() && Boolean(regionId);
}

async function requestMedusa(path, { method = "GET", body, allowNotFound = false } = {}) {
  if (!isMedusaStoreConfigured()) {
    const error = new Error("Medusa Store API 尚未配置。我的设置尚未准备好。");
    error.code = "medusa_store_not_configured";
    error.status = 503;
    throw error;
  }

  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method,
    headers: {
      "x-publishable-api-key": publishableKey,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8_000),
  });

  if (allowNotFound && response.status === 404) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Medusa 暂时无法处理该请求。");
    error.code = data.type || "medusa_request_failed";
    error.status = response.status;
    error.details = data.details;
    throw error;
  }
  return data;
}

function normalizeProduct(product, inventoryProduct) {
  const metadata = product.metadata || {};
  const liveVariants = new Map(
    (inventoryProduct?.variants || []).map((variant) => [variant.id, variant])
  );
  const variants = (product.variants || []).map((variant) => {
    const live = liveVariants.get(variant.id);
    const price = (variant.prices || []).find(
      (entry) => entry.currency_code?.toLowerCase() === "cny" && !entry.price_list_id
    );
    const stock = Number(live?.inventory_quantity ?? 0);
    return {
      id: variant.id,
      sku: variant.sku || "",
      title: variant.title || "标准款",
      titleEn: "",
      price: Number(price?.amount ?? 0),
      currency: price?.currency_code?.toUpperCase() || "CNY",
      stock,
      availableStock: stock,
      isActive: true,
      allowBackorder: Boolean(variant.allow_backorder),
    };
  });

  const rawDescription = product.description || "";
  const description = metadata.description_zh || rawDescription.split("\n\n")[0];
  const descriptionEn = metadata.description_en || rawDescription.split("\n\n")[1] || "";
  const images = Array.isArray(metadata.storefront_images) ? metadata.storefront_images : [];
  const activeVariant = variants[0];
  const stock = variants.reduce((sum, variant) => sum + variant.availableStock, 0);

  return {
    id: product.id,
    slug: product.handle,
    name: product.title,
    nameEn: product.subtitle || "",
    description,
    descriptionEn,
    price: activeVariant?.price ?? 0,
    currency: activeVariant?.currency || "CNY",
    materials: Array.isArray(metadata.materials) ? metadata.materials : [],
    intentions: Array.isArray(metadata.intentions) ? metadata.intentions : [],
    frontImage: images[0] || product.thumbnail || "",
    backImage: images[1] || images[0] || product.thumbnail || "",
    featured: Boolean(metadata.featured),
    availability: metadata.availability || "preview",
    sellable: metadata.sellable === true,
    stock,
    variants,
  };
}

export async function getMedusaCatalog({ force = false } = {}) {
  if (!force && catalogCache && Date.now() - catalogCacheAt < catalogCacheMs) {
    return catalogCache;
  }

  const [catalog, inventory] = await Promise.all([
    requestMedusa("/store/orbital/catalog"),
    requestMedusa("/store/products?limit=100&fields=*variants%2C%2Bvariants.inventory_quantity%2C%2Bmetadata"),
  ]);
  const inventoryById = new Map((inventory.products || []).map((product) => [product.id, product]));
  const products = (catalog.products || []).map((product) =>
    normalizeProduct(product, inventoryById.get(product.id))
  );

  catalogCache = {
    catalogStatus: "medusa",
    defaultLocale: "zh-CN",
    currency: "CNY",
    products,
  };
  catalogCacheAt = Date.now();
  return catalogCache;
}

export async function getMedusaProduct(slug) {
  const catalog = await getMedusaCatalog();
  return catalog.products.find((product) => product.slug === slug) || null;
}

function cartFields() {
  return new URLSearchParams({
    fields: "*items,*items.variant,*items.product,+items.thumbnail",
  }).toString();
}

export async function createMedusaCart() {
  if (!regionId) return null;
  const data = await requestMedusa("/store/carts", {
    method: "POST",
    body: { region_id: regionId },
  });
  return data.cart;
}

export async function retrieveMedusaCart(cartId) {
  if (!cartId) return null;
  const query = cartFields();
  const data = await requestMedusa(`/store/carts/${encodeURIComponent(cartId)}?${query}`, {
    allowNotFound: true,
  });
  return data?.cart || null;
}

export async function addMedusaCartItem(cartId, variantId, quantity) {
  const data = await requestMedusa(`/store/carts/${encodeURIComponent(cartId)}/line-items`, {
    method: "POST",
    body: { variant_id: variantId, quantity },
  });
  return data.cart;
}

export async function updateMedusaCartItem(cartId, lineId, quantity) {
  const data = await requestMedusa(
    `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineId)}`,
    { method: "POST", body: { quantity } }
  );
  return data.cart;
}

export async function removeMedusaCartItem(cartId, lineId) {
  const data = await requestMedusa(
    `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineId)}`,
    { method: "DELETE" }
  );
  return data.cart;
}

export function mapMedusaCart(cart) {
  return {
    id: cart.id,
    currency: (cart.currency_code || "CNY").toUpperCase(),
    status: "active",
    items: (cart.items || []).map((item) => ({
      cartItemId: item.id,
      id: item.id,
      slug: item.product_handle || item.product?.handle || item.variant?.product?.handle || "",
      name: item.product_title || item.product?.title || item.variant?.product?.title || "商品",
      variantId: item.variant_id,
      sku: item.variant_sku || item.variant?.sku || "",
      variantTitle: item.variant_title || item.variant?.title || "标准款",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price ?? item.subtotal ?? 0),
      currency: (cart.currency_code || "CNY").toUpperCase(),
      availableStock: Number(item.variant?.inventory_quantity ?? 0),
      variantActive: true,
    })),
  };
}

export async function quoteMedusaCart(items) {
  if (!Array.isArray(items)) {
    const error = new Error("购物袋项目格式无效。");
    error.code = "cart_validation_failed";
    throw error;
  }
  const catalog = await getMedusaCatalog();
  const errors = [];
  const lines = [];

  for (const item of items) {
    const product = catalog.products.find((entry) => entry.slug === item?.slug);
    const quantity = Number(item?.quantity);
    const variant = product?.variants.find((entry) => entry.id === item?.variantId) || null;
    if (!product) {
      errors.push({ slug: item?.slug || "", code: "not_found", message: "商品不存在。" });
      continue;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      errors.push({ slug: product.slug, code: "invalid_quantity", message: "商品数量必须是 1 到 20。" });
      continue;
    }
    if (!variant || !product.sellable || variant.availableStock < quantity) {
      errors.push({ slug: product.slug, code: "unavailable", message: "该商品当前不可购买或库存不足。" });
      continue;
    }
    lines.push({
      slug: product.slug,
      variantId: variant.id,
      sku: variant.sku,
      variantTitle: variant.title,
      name: product.name,
      quantity,
      unitPrice: variant.price,
      currency: variant.currency,
      lineTotal: variant.price * quantity,
    });
  }

  if (errors.length) {
    const error = new Error("购物袋校验失败。");
    error.code = "cart_validation_failed";
    error.details = errors;
    throw error;
  }
  return {
    currency: "CNY",
    lines,
    subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
  };
}
