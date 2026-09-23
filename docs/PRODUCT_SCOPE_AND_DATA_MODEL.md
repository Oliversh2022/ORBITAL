# ORBITAL 首发范围与商品数据契约

更新时间：2026-09-22

## 中文

### 1. 第二步结论

ORBITAL 下一阶段先做“可理解、可浏览、可扩展”的内容型商品站，不立即接入支付、账户和真实库存。

首发 MVP 范围：

1. 首页与品牌叙事。
2. 商品目录：展示系列、材质、寓意和价格。
3. 商品详情：展示大图、材质故事、佩戴建议和相关占卜入口。
4. 占卜内容：塔罗、星座命盘、易经六爻保持独立入口。
5. 购物袋界面：先完成前端交互和数据结构，不创建真实订单。

暂不包含：

- 支付、结账和退款。
- 用户注册、登录和账户中心。
- 真实库存扣减和订单履约。
- 商家后台和供应链同步。

### 2. 页面信息架构

```text
/
├── 产品目录
│   ├── 余烬守护 / ember-guard
│   ├── 静水 / stillwater
│   └── 轨道之星 / the-stargazer
├── 商品详情
├── 占卜
│   ├── 塔罗牌阵
│   ├── 星座命盘
│   └── 易经六爻
└── 购物袋（第一阶段只做前端状态）
```

静态阶段使用 `.html` 页面；重新创建 Storefront 应用后，再迁移为 `/products`、`/products/[slug]` 和 `/cart`。旧 `/shop` 和 `/account` 不恢复。

### 3. 商品字段

`references/TraeWEBTEST/assets/data/products.json` 是当前视觉版本的商品数据基线。它只描述展示内容，不代表可售库存。

每个商品必须具备：

- 稳定 `id` 和 URL `slug`。
- 中英文名称和描述。
- 价格与货币。
- 材质与意图标签。
- 正面图与背面图字段。
- `availability` 和 `sellable` 状态。
- 是否在首页精选。

当前三款商品都标记为 `availability: preview`、`sellable: false`，避免静态价格被误解为真实可购买商品。

### 4. 下一阶段实现顺序

1. 用 JSON 数据替换首页硬编码商品字段，但保留当前 FlipCard 动效。
2. 新建商品目录页面，复用现有 GhostFibers 背景与导航。
3. 新建三个商品详情页面，只展示真实存在的数据字段。
4. 再做购物袋前端状态和数量变更。
5. 完成这组页面后，再决定 Commerce 技术和真实库存模型。

### 5. 验收标准

- 首页、目录和详情页使用同一份商品数据。
- 任一商品只修改一处数据即可同步名称、图片、价格和描述。
- 未标记为可售的商品不能出现“立即购买”或创建订单按钮。
- 旧 `/shop`、`/account` 和不存在的动态路由仍然返回 404。
- 商品详情页在手机宽度下不破坏卡牌、图片和导航布局。

### 6. 数据库决定

业务数据库确定使用 PostgreSQL 17，当前使用全新的 `orbital_catalog` 数据库；旧的 `orbital_store` 已删除。首批迁移位于 `database/`：

- `001_initial_catalog.sql`：商品分类、商品、图片、材质、意图和占卜关联表。
- `002_seed_visual_catalog.sql`：写入当前三款视觉基线商品和相关词典数据。

表名和字段名采用清晰的英文 `snake_case`，表注释和业务文本使用中文；这样既满足中文可读性，也避免中文 quoted identifier 对 ORM 和迁移工具造成兼容问题。当前迁移不创建用户、订单、支付和库存扣减表。

---

## English

### 1. Scope decision

The next ORBITAL milestone is a browsable and extensible editorial storefront. It will not connect payments, accounts, or real inventory yet.

MVP scope:

1. Homepage and brand narrative.
2. Product catalog with materials, intentions, and prices.
3. Product detail pages with imagery, material stories, wearing guidance, and related divination links.
4. Tarot, Zodiac, and I Ching content experiences.
5. A front-end shopping-bag interface without real order creation.

Deferred items:

- Payments, checkout, and refunds.
- Registration, login, and customer accounts.
- Inventory deduction and fulfillment.
- Merchant administration and supplier synchronization.

### 2. Information architecture

The static phase will use `.html` pages. Once the Storefront application is rebuilt, migrate the catalog to `/products`, product details to `/products/[slug]`, and the bag to `/cart`. The deleted `/shop` and `/account` routes stay retired.

### 3. Product contract

`references/TraeWEBTEST/assets/data/products.json` is the product-data baseline for the current visual version. It describes presentation content only and does not represent sellable inventory.

Each product requires a stable ID and slug, bilingual names and descriptions, price and currency, material and intention tags, front/back media fields, availability and sellable states, and a featured flag.

All three current products use `availability: preview` and `sellable: false`, preventing a visual reference price from being mistaken for a live offer.

### 4. Next implementation sequence

1. Replace homepage hardcoded product fields with the JSON source while preserving FlipCard motion.
2. Add a product catalog page using the current background and navigation.
3. Add three product detail pages using only fields that exist in the data contract.
4. Add front-end shopping-bag state and quantity updates.
5. Choose the Commerce stack and inventory model only after these pages are validated.

### 5. Database decision

PostgreSQL 17 is the selected business database, using the new clean `orbital_catalog` database; the old `orbital_store` database has been deleted. The first migrations live under `database/` and cover categories, products, media, materials, intentions, and divination relationships. Technical identifiers use readable English `snake_case`; PostgreSQL comments and business content remain Chinese-friendly. User, order, payment, and inventory-deduction tables remain deferred.
