import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDatabaseConfigured, loadDatabaseCatalog } from "./database.mjs";

let databaseCatalogCache = null;
let databaseCatalogCacheExpiresAt = 0;

const catalogPath = fileURLToPath(new URL("../references/TraeWEBTEST/assets/data/products.json", import.meta.url));

export function loadCatalog() {
  return JSON.parse(readFileSync(catalogPath, "utf8"));
}

export async function loadRuntimeCatalog() {
  if (!isDatabaseConfigured()) return loadCatalog();
  if (databaseCatalogCache && Date.now() < databaseCatalogCacheExpiresAt) return databaseCatalogCache;
  try {
    databaseCatalogCache = await loadDatabaseCatalog();
  } catch (error) {
    error.code = "catalog_unavailable";
    throw error;
  }
  databaseCatalogCacheExpiresAt = Date.now() + 5_000;
  return databaseCatalogCache;
}

export function getCatalogRuntimeSource() {
  return isDatabaseConfigured() ? "postgres" : "json";
}

export async function findProduct(slug) {
  const catalog = await loadRuntimeCatalog();
  return (catalog.products || []).find((product) => product.slug === slug) || null;
}

export function toPublicProduct(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const activeVariant = selectProductVariant(product);
  const stock = Number(product.stock ?? activeVariant?.availableStock ?? 0);
  const sellable = product.availability === "active" && product.sellable === true && stock > 0;
  return {
    ...product,
    price: Number(activeVariant?.price ?? product.price),
    currency: activeVariant?.currency || product.currency || "CNY",
    stock,
    sellable,
    availableForPurchase: sellable,
    variants,
  };
}

export function selectProductVariant(product, requestedVariantId) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (requestedVariantId) return variants.find((variant) => variant.id === requestedVariantId) || null;
  return variants.find((variant) => variant.isActive !== false) || null;
}

export async function getPublicCatalog() {
  const catalog = await loadRuntimeCatalog();
  return {
    catalogStatus: catalog.catalogStatus,
    defaultLocale: catalog.defaultLocale,
    currency: catalog.currency,
    products: (catalog.products || []).map(toPublicProduct),
  };
}

export async function quoteCart(items) {
  if (!Array.isArray(items)) throw new Error("购物袋项目格式无效。");

  const catalog = await loadRuntimeCatalog();
  const errors = [];
  const lines = [];
  for (const item of items) {
    const product = (catalog.products || []).find((entry) => entry.slug === item?.slug) || null;
    const quantity = Number(item?.quantity);
    if (!product) {
      errors.push({ slug: item?.slug || "", code: "not_found", message: "商品不存在。" });
      continue;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      errors.push({ slug: product.slug, code: "invalid_quantity", message: "商品数量必须是 1 到 20。" });
      continue;
    }
    const publicProduct = toPublicProduct(product);
    const variant = selectProductVariant(product, item?.variantId);
    const variantStock = variant ? Number(variant.availableStock ?? variant.stock ?? 0) : publicProduct.stock;
    const unitPrice = Number(variant?.price ?? product.price);
    const currency = variant?.currency || product.currency || catalog.currency;
    if ((product.variants?.length && !variant) || !publicProduct.availableForPurchase || variant?.isActive === false || quantity > variantStock) {
      errors.push({ slug: product.slug, code: "unavailable", message: "该商品当前不可购买或库存不足。" });
      continue;
    }
    lines.push({
      slug: product.slug,
      variantId: variant?.id,
      sku: variant?.sku,
      variantTitle: variant?.title,
      name: product.name,
      quantity,
      unitPrice,
      currency,
      lineTotal: unitPrice * quantity,
    });
  }

  if (errors.length) {
    const error = new Error("购物袋校验失败。");
    error.code = "cart_validation_failed";
    error.details = errors;
    throw error;
  }

  return {
    currency: catalog.currency,
    lines,
    subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
  };
}
