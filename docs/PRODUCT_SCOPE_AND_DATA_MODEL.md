# ORBITAL 首发范围与商品数据契约

更新时间：2026-09-22

## 中文

### Commerce Core 状态（2026-09-23）

- 第一阶段已进入：静态站已具备 PostgreSQL 商品目录 API、匿名 Session 购物袋和服务端报价校验；没有数据库配置的环境仍可回退到 JSON 基线。
- 当前已完成 Commerce Core 第一步和第二步：购物袋服务端持久化、商品变体选择、SKU 传递和变体级价格/库存校验已接通。
- 第三步库存基础已完成：支持库存预占、过期释放、主动释放和消费扣减；正式 Checkout 尚未调用这些事务。
- Checkout 已支持服务端普通配送费率及商品/配送/应付总额拆分；当前未设置费率，因此提交会被拦截且不会暂留库存。
- 订单账本迁移 `007` 已应用到本机数据库：定义订单状态、应付金额快照、商品行快照，并将库存预占关联到订单。
- Checkout 准备接口现可在费率已配置且商品可售时事务化创建订单草稿、商品快照和 15 分钟库存预占；配送费未配置时仍会提前拦截。
- `database/003_commerce_core.sql` 与 `database/004_seed_commerce_core.sql` 已完成商品变体、库存与购物袋结构；本机三款预览商品仍为零库存、不可购买。
- 支付、正式下单/履约、账户和真实库存扣减仍未开启；当前订单为待补充信息的草稿，不持久化顾客地址/联系方式。

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

1. 首页、目录和详情页共用商品数据与 FlipCard 动效（已完成）。
2. 商品详情支持变体、SKU 和变体级价格/库存（已完成）。
3. 购物袋接入匿名 Session、数据库持久化和数量变更（已完成）。
4. 建立库存预占、释放和扣减事务（已完成）。
5. 配置配送费并完成 Checkout 金额确认（基础能力已接入）。
6. 订单模型与事务化草稿创建已接入（数据库迁移 `007` 已应用）。下一步先确定顾客信息保存与保留规则，再完成地址持久化、待付款状态和订单正式提交；支付接在订单状态流转之后。

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
- `003_commerce_core.sql`：商品变体、库存字段、购物袋和购物袋明细。
- `004_seed_commerce_core.sql`：为现有商品写入不可售的标准变体基线。
- `005_commerce_runtime_grants.sql`：为 `orbital_app` 授予目录只读和购物袋读写权限。
- `006_inventory_reservations.sql`：库存预占、过期释放和消费扣减记录。
- `007_order_foundation.sql`：订单金额/状态、商品价格快照和库存预占关联；不保存顾客地址、联系方式或支付数据。

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
4. Add anonymous session-backed bag persistence and variant-aware quantity updates (complete).
5. Add inventory reservation, release, and deduction transactions.
6. Configure delivery pricing and final Checkout totals (the base capability is in place).
7. The order ledger and transactional draft creation are connected (migration `007` is applied locally). Decide customer-data retention before adding address persistence, payment-ready order submission, and payments.

### 5. Database decision

PostgreSQL 17 is the selected business database, using the new clean `orbital_catalog` database; the old `orbital_store` database has been deleted. Commerce Core now reads the server-side PostgreSQL catalog, persists anonymous session bags, and supports transactional inventory reservations, with a JSON fallback for environments without `DATABASE_URL`. Migration `007` defines the order ledger, item snapshots, and reservation linkage and is applied locally. Checkout can create a transactionally reserved draft when a shipping rate is configured; drafts intentionally omit customer contact/address and payment data. Final order submission, payments, and user accounts remain deferred.
