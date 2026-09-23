BEGIN;

-- ORBITAL 使用 PostgreSQL 作为业务数据源。
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE product_status AS ENUM ('preview', 'draft', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE product_image_role AS ENUM ('front', 'back', 'gallery');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 商品分类：例如“水晶手串”“配件”“礼盒”。
CREATE TABLE IF NOT EXISTS product_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT,
  description_zh TEXT,
  description_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 商品主表：价格在真正接入订单前仍属于展示数据。
CREATE TABLE IF NOT EXISTS products (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES product_categories(category_id) ON DELETE SET NULL,
  sku TEXT UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT,
  summary_zh TEXT,
  summary_en TEXT,
  description_zh TEXT,
  description_en TEXT,
  price_amount NUMERIC(12, 2) NOT NULL CHECK (price_amount >= 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'CNY',
  status product_status NOT NULL DEFAULT 'preview',
  is_sellable BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 商品图片：正面、背面、画廊图分开管理，不把图片路径写死在页面中。
CREATE TABLE IF NOT EXISTS product_images (
  image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  role product_image_role NOT NULL,
  image_url TEXT NOT NULL,
  alt_zh TEXT,
  alt_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, role, sort_order)
);

-- 材质词典：例如黑曜石、红玛瑙、海蓝宝。
CREATE TABLE IF NOT EXISTS materials (
  material_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT,
  description_zh TEXT,
  description_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_materials (
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(material_id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, material_id)
);

-- 意图词典：例如守护、平静、直觉。
CREATE TABLE IF NOT EXISTS intentions (
  intention_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT,
  description_zh TEXT,
  description_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_intentions (
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  intention_id UUID NOT NULL REFERENCES intentions(intention_id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, intention_id)
);

-- 占卜体验：让商品详情页可以关联塔罗、星座和易经入口。
CREATE TABLE IF NOT EXISTS divination_experiences (
  experience_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  route_path TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT,
  description_zh TEXT,
  description_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_divination_links (
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES divination_experiences(experience_id) ON DELETE CASCADE,
  note_zh TEXT,
  note_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, experience_id)
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status_featured ON products(status, is_featured, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id, role, sort_order);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_categories_updated_at ON product_categories;
CREATE TRIGGER trg_product_categories_updated_at
BEFORE UPDATE ON product_categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE product_categories IS '商品分类 / Product categories';
COMMENT ON TABLE products IS '商品主表 / Products';
COMMENT ON TABLE product_images IS '商品图片 / Product media';
COMMENT ON TABLE materials IS '水晶材质词典 / Material dictionary';
COMMENT ON TABLE intentions IS '佩戴意图词典 / Intention dictionary';
COMMENT ON TABLE divination_experiences IS '占卜体验入口 / Divination experiences';
COMMENT ON COLUMN products.is_sellable IS '是否允许真实购买；preview 阶段必须为 false';
COMMENT ON COLUMN products.price_amount IS '展示价格；真实订单价格需要在订单创建时快照';

COMMIT;
