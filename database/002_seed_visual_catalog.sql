BEGIN;

INSERT INTO product_categories (slug, name_zh, name_en, description_zh, description_en)
VALUES ('crystal-bracelets', '水晶手串', 'Crystal Bracelets', '天然水晶与手工串制的随身之物。', 'Natural crystal bracelets made as everyday talismans.')
ON CONFLICT (slug) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en,
  description_zh = EXCLUDED.description_zh,
  description_en = EXCLUDED.description_en;

INSERT INTO materials (slug, name_zh, name_en)
VALUES
  ('obsidian', '黑曜石', 'Obsidian'),
  ('red-agate', '红玛瑙', 'Red Agate'),
  ('tiger-eye', '虎眼石', 'Tiger''s Eye'),
  ('aquamarine', '海蓝宝', 'Aquamarine'),
  ('moonstone', '月光石', 'Moonstone'),
  ('smoky-quartz', '烟晶', 'Smoky Quartz'),
  ('amethyst', '紫水晶', 'Amethyst'),
  ('citrine', '黄水晶', 'Citrine'),
  ('clear-quartz', '白水晶', 'Clear Quartz')
ON CONFLICT (slug) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en;

INSERT INTO intentions (slug, name_zh, name_en)
VALUES
  ('protection', '守护', 'Protection'),
  ('boundaries', '边界', 'Boundaries'),
  ('strength', '心力', 'Strength'),
  ('calm', '平静', 'Calm'),
  ('emotions', '情绪', 'Emotional Balance'),
  ('clarity', '清晰', 'Clarity'),
  ('intuition', '直觉', 'Intuition'),
  ('abundance', '丰盛', 'Abundance'),
  ('direction', '方向', 'Direction')
ON CONFLICT (slug) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en;

INSERT INTO divination_experiences (slug, route_path, name_zh, name_en, description_zh, description_en)
VALUES
  ('tarot', '/tarot.html', '塔罗牌阵', 'Tarot Spread', 'AI 解牌与传统牌阵结合。', 'AI-assisted reflection with traditional spreads.'),
  ('zodiac', '/zodiac.html', '星座命盘', 'Zodiac Chart', '生成你的本命星盘。', 'Generate a natal chart for reflection.'),
  ('iching', '/iching.html', '易经六爻', 'I Ching', '以卦象回应当下抉择。', 'Use hexagrams to reflect on a current choice.')
ON CONFLICT (slug) DO UPDATE SET
  route_path = EXCLUDED.route_path,
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en,
  description_zh = EXCLUDED.description_zh,
  description_en = EXCLUDED.description_en;

INSERT INTO products (
  category_id, sku, slug, name_zh, name_en, summary_zh, summary_en,
  description_zh, description_en, price_amount, currency_code, status,
  is_sellable, is_featured, sort_order
)
VALUES
  ((SELECT category_id FROM product_categories WHERE slug = 'crystal-bracelets'), 'ORBITAL-EMBER-GUARD', 'ember-guard', '余烬守护', 'Ember Guard', '黑曜石与红玛瑙，守护边界与心力。', 'Obsidian and red agate for boundaries, grounding, and inner strength.', '黑曜石、红玛瑙与虎眼石组成的视觉基线商品。', 'A visual-baseline bracelet featuring obsidian, red agate, and tiger''s eye.', 1280, 'CNY', 'preview', FALSE, TRUE, 1),
  ((SELECT category_id FROM product_categories WHERE slug = 'crystal-bracelets'), 'ORBITAL-STILLWATER', 'stillwater', '静水', 'Stillwater', '海蓝宝与月光石，平复情绪之流。', 'Aquamarine and moonstone for calm, clarity, and a gentler emotional current.', '海蓝宝、月光石与烟晶组成的视觉基线商品。', 'A visual-baseline bracelet featuring aquamarine, moonstone, and smoky quartz.', 980, 'CNY', 'preview', FALSE, TRUE, 2),
  ((SELECT category_id FROM product_categories WHERE slug = 'crystal-bracelets'), 'ORBITAL-THE-STARGAZER', 'the-stargazer', '轨道之星', 'The Stargazer', '紫水晶与黄水晶，接引直觉与丰盛。', 'Amethyst and citrine for intuition, imagination, and a sense of abundance.', '紫水晶、黄水晶与白水晶组成的视觉基线商品。', 'A visual-baseline bracelet featuring amethyst, citrine, and clear quartz.', 1580, 'CNY', 'preview', FALSE, TRUE, 3)
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  sku = EXCLUDED.sku,
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en,
  summary_zh = EXCLUDED.summary_zh,
  summary_en = EXCLUDED.summary_en,
  description_zh = EXCLUDED.description_zh,
  description_en = EXCLUDED.description_en,
  price_amount = EXCLUDED.price_amount,
  currency_code = EXCLUDED.currency_code,
  status = EXCLUDED.status,
  is_sellable = EXCLUDED.is_sellable,
  is_featured = EXCLUDED.is_featured,
  sort_order = EXCLUDED.sort_order;

INSERT INTO product_images (product_id, role, image_url, alt_zh, alt_en, sort_order)
SELECT p.product_id, v.role::product_image_role, v.image_url, p.name_zh, p.name_en, 0
FROM products p
JOIN (VALUES
  ('ember-guard', 'front', '/assets/ember-guard.png'),
  ('ember-guard', 'back', '/assets/ember-guard.png'),
  ('stillwater', 'front', '/assets/stillwater.png'),
  ('stillwater', 'back', '/assets/stillwater.png'),
  ('the-stargazer', 'front', '/assets/orbital-hero.png'),
  ('the-stargazer', 'back', '/assets/orbital-hero.png')
) AS v(slug, role, image_url) ON v.slug = p.slug
ON CONFLICT (product_id, role, sort_order) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  alt_zh = EXCLUDED.alt_zh,
  alt_en = EXCLUDED.alt_en;

INSERT INTO product_materials (product_id, material_id, sort_order)
SELECT p.product_id, m.material_id, v.sort_order
FROM (VALUES
  ('ember-guard', 'obsidian', 0), ('ember-guard', 'red-agate', 1), ('ember-guard', 'tiger-eye', 2),
  ('stillwater', 'aquamarine', 0), ('stillwater', 'moonstone', 1), ('stillwater', 'smoky-quartz', 2),
  ('the-stargazer', 'amethyst', 0), ('the-stargazer', 'citrine', 1), ('the-stargazer', 'clear-quartz', 2)
) AS v(product_slug, material_slug, sort_order)
JOIN products p ON p.slug = v.product_slug
JOIN materials m ON m.slug = v.material_slug
ON CONFLICT (product_id, material_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

INSERT INTO product_intentions (product_id, intention_id, sort_order)
SELECT p.product_id, i.intention_id, v.sort_order
FROM (VALUES
  ('ember-guard', 'protection', 0), ('ember-guard', 'boundaries', 1), ('ember-guard', 'strength', 2),
  ('stillwater', 'calm', 0), ('stillwater', 'emotions', 1), ('stillwater', 'clarity', 2),
  ('the-stargazer', 'intuition', 0), ('the-stargazer', 'abundance', 1), ('the-stargazer', 'direction', 2)
) AS v(product_slug, intention_slug, sort_order)
JOIN products p ON p.slug = v.product_slug
JOIN intentions i ON i.slug = v.intention_slug
ON CONFLICT (product_id, intention_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

INSERT INTO product_divination_links (product_id, experience_id, sort_order)
SELECT p.product_id, d.experience_id, v.sort_order
FROM (VALUES
  ('ember-guard', 'tarot', 0), ('stillwater', 'zodiac', 0), ('the-stargazer', 'iching', 0)
) AS v(product_slug, experience_slug, sort_order)
JOIN products p ON p.slug = v.product_slug
JOIN divination_experiences d ON d.slug = v.experience_slug
ON CONFLICT (product_id, experience_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

COMMIT;
