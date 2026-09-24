import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL?.trim();
const databaseSsl = process.env.DATABASE_SSL === "true";

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 1_500,
      ssl: databaseSsl ? { rejectUnauthorized: false } : undefined,
    })
  : null;

export function isDatabaseConfigured() {
  return Boolean(pool);
}

export async function query(text, values) {
  if (!pool) {
    const error = new Error("DATABASE_URL 未配置。");
    error.code = "database_unavailable";
    throw error;
  }
  return pool.query(text, values);
}

export async function withTransaction(callback) {
  if (!pool) {
    const error = new Error("DATABASE_URL 未配置。");
    error.code = "database_unavailable";
    throw error;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function loadDatabaseCatalog() {
  if (!pool) throw new Error("DATABASE_URL 未配置。");

  const productsResult = await pool.query(`
    SELECT
      p.product_id,
      p.slug,
      p.name_zh,
      p.name_en,
      COALESCE(p.summary_zh, p.description_zh, '') AS description_zh,
      COALESCE(p.summary_en, p.description_en, '') AS description_en,
      p.price_amount,
      p.currency_code,
      p.status,
      p.is_sellable,
      p.is_featured,
      COALESCE(SUM(GREATEST(v.stock_quantity - v.reserved_quantity, 0)) FILTER (WHERE v.is_active), 0)::integer AS stock
    FROM products p
    LEFT JOIN product_variants v ON v.product_id = p.product_id
    GROUP BY p.product_id
    ORDER BY p.sort_order, p.created_at
  `);

  const [imagesResult, materialsResult, intentionsResult, variantsResult] = await Promise.all([
    pool.query(`
      SELECT p.slug, i.role, i.image_url
      FROM products p
      JOIN product_images i ON i.product_id = p.product_id
      ORDER BY p.slug, i.sort_order
    `),
    pool.query(`
      SELECT p.slug, m.name_zh
      FROM products p
      JOIN product_materials pm ON pm.product_id = p.product_id
      JOIN materials m ON m.material_id = pm.material_id
      ORDER BY p.slug, pm.sort_order
    `),
    pool.query(`
      SELECT p.slug, i.name_zh
      FROM products p
      JOIN product_intentions pi ON pi.product_id = p.product_id
      JOIN intentions i ON i.intention_id = pi.intention_id
      ORDER BY p.slug, pi.sort_order
    `),
    pool.query(`
      SELECT
        p.slug,
        v.variant_id,
        v.sku,
        v.title_zh,
        v.title_en,
        v.price_amount,
        v.currency_code,
        v.stock_quantity,
        v.reserved_quantity,
        v.is_active
      FROM products p
      JOIN product_variants v ON v.product_id = p.product_id
      ORDER BY p.slug, v.created_at
    `),
  ]);

  const products = new Map(productsResult.rows.map((row) => [row.slug, {
    id: row.product_id,
    slug: row.slug,
    name: row.name_zh,
    nameEn: row.name_en,
    description: row.description_zh,
    descriptionEn: row.description_en,
    price: Number(row.price_amount),
    currency: row.currency_code.trim(),
    materials: [],
    intentions: [],
    frontImage: "",
    backImage: "",
    featured: row.is_featured,
    availability: row.status,
    sellable: row.is_sellable,
    stock: Number(row.stock),
    variants: [],
  }]));

  for (const row of imagesResult.rows) {
    const product = products.get(row.slug);
    if (!product) continue;
    if (row.role === "front") product.frontImage = row.image_url;
    if (row.role === "back") product.backImage = row.image_url;
  }
  for (const row of materialsResult.rows) {
    const product = products.get(row.slug);
    if (product) product.materials.push(row.name_zh);
  }
  for (const row of intentionsResult.rows) {
    const product = products.get(row.slug);
    if (product) product.intentions.push(row.name_zh);
  }
  for (const row of variantsResult.rows) {
    const product = products.get(row.slug);
    if (!product) continue;
    product.variants.push({
      id: row.variant_id,
      sku: row.sku,
      title: row.title_zh,
      titleEn: row.title_en,
      price: Number(row.price_amount),
      currency: row.currency_code.trim(),
      stock: Number(row.stock_quantity),
      reserved: Number(row.reserved_quantity),
      availableStock: Math.max(0, Number(row.stock_quantity) - Number(row.reserved_quantity)),
      isActive: row.is_active,
    });
  }

  return {
    catalogStatus: "database",
    defaultLocale: "zh-CN",
    currency: "CNY",
    products: Array.from(products.values()),
  };
}
