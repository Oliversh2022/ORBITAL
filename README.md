# ORBITAL

## 中文

ORBITAL 是一个以星象、占卜与天然水晶手串为核心的独立站视觉版本。当前仓库保存的是可直接运行的静态网站版本，重点完成了品牌首页、动态背景、导航交互、产品卡牌翻转与占卜入口的统一视觉体验。

### 当前版本内容

- GhostFibers 动态 WebGL 光纤背景作为全站背景。
- JellyRadio 导航切换：首页 / 精选 / 占卜 / 寻物，保留回弹动效，按钮背景以透明为主。
- 产品展示卡使用 FlipCard：正面展示商品图，点击后以卡牌翻转动效展示价格与暗色商品图。
- 三张占卜入口卡保留 BorderGlow 边缘光效，移除了额外的鼠标浮动抬升效果。
- 首页、商品目录、商品详情、塔罗牌阵、星座命盘和易经六爻均可通过静态服务器访问。
- Commerce Core 第一阶段已接入服务端商品目录 API、购物袋页面、购物袋本地状态和服务端报价校验；当前预览商品仍不可购买。
- 账户和旧版商城入口不会再跳转到已删除的旧页面。

### 阶段状态

- Phase 2 — Design Preview：已关闭。Direction A 作为品牌视觉基础，商品信息层级采用更清晰的商业化表达；独立设计对比页按当前决策不保留。
- Phase 3 — Core UI：桌面端页面壳、导航、首页、商品目录和商品详情已统一；首页精选商品已联动目录数据并可进入详情。移动端按当前决策暂缓。
- Commerce Core：第一阶段基础已进入。服务端商品目录、Session 购物袋、变体/SKU、库存预占/释放/消费事务、购物袋报价 API、购物袋页面和 PostgreSQL 迁移已就位；支付、订单、账户和正式 Checkout 仍未开启。
- Checkout 支持服务端普通配送费率报价和事务化订单草稿/库存暂留。通过 `ORBITAL_STANDARD_SHIPPING_FEE` 配置统一费率（人民币，最多两位小数）；未配置时会阻止提交且不会创建订单。草稿不保存收货信息，也不发起支付或履约。
- 页面结构约定：新页面沿用首页的 ORBITAL 页面壳、`JellyRadio` 导航、动态背景和 `site-shell.css`，不再创建独立的旧版 Header。

### 运行

```powershell
pnpm install
pnpm dev
```

然后打开 <http://localhost:3002>。

当前端口约定已经统一：

- `3002`：唯一公共访问入口，也是当前静态网站的实际服务端口。
- `3010`：未来 Storefront 服务的预留内部端口，当前版本未启用。
- `9001`：未来 Commerce 服务的预留内部端口，当前版本未启用。

### 页面

- `/`：ORBITAL 首页
- `/shop.html`：商品目录（当前为预览商品）
- `/product.html?slug=ember-guard`：商品详情（当前为预览商品）
- `/cart.html`：购物袋（Commerce Core 预览）
- `/checkout.html`：结账信息确认与库存暂留预览
- `/tarot.html`：塔罗牌阵
- `/zodiac.html`：星座命盘
- `/iching.html`：易经六爻
- `/ghost-fibers`：动态背景单独预览
- `/404.html`：统一 404 页面
- `/robots.txt`、`/sitemap.xml`：基础搜索引擎入口
- `/assets/*`：页面使用的脚本、样式与图片资源

### 目录

```text
references/TraeWEBTEST/pages   静态页面
references/TraeWEBTEST/assets  背景、组件脚本、样式与图片资源
references/TraeWEBTEST/assets/data/products.json  当前视觉版商品数据基线
commerce/                    服务端商品目录与购物袋校验基础层
database/                     PostgreSQL 迁移与商品种子数据
server.mjs                     3002 静态服务入口
docs/                          项目审计与后续规划
```

当前 Commerce Core API：`GET /api/health`、目录读取、Session 购物袋读写、`POST /api/cart/quote`、`GET /api/checkout/shipping-quote`、`POST /api/cart/reserve`、`POST /api/checkout/prepare` 和当前 Session 的预占释放。库存消费由正式订单流程调用，公开接口不会直接扣减库存。当前工作区已配置 PostgreSQL 商品目录、商品变体库存、匿名 Session 购物袋和库存事务；未配置 `DATABASE_URL` 的环境会安全回退到视觉 JSON 基线。复制 `.env.example` 为 `.env.local` 后，可在 `ORBITAL_STANDARD_SHIPPING_FEE` 中设置统一普通配送费率；未配置时会禁用结账准备。

当前仓库刻意不包含 `node_modules`、本地环境变量、证书/私钥以及已被删除的 `apps` 业务源码。后续若恢复真实商城、账户、订单和支付能力，应在本版本基础上重新规划服务边界与生产部署。

---

## English

ORBITAL is an independent-store visual baseline centered on astrology, divination, and natural crystal bracelets. This repository contains the currently runnable static website version, including the unified brand homepage, animated background, navigation interaction, product card flipping, and divination entry points.

### Included in this version

- GhostFibers WebGL fiber background used as the global visual background.
- JellyRadio navigation for Home / Featured / Divination / Shop, keeping the spring-like interaction while using a transparent surrounding surface.
- FlipCard product cards: product imagery on the front, and price plus a dark product image on the back with the original card-flip motion.
- BorderGlow applied to the three divination cards, with the additional mouse-lift effect removed.
- Static pages for the homepage, product catalog, product detail, Tarot, Zodiac, and I Ching.
- Commerce Core foundation now includes a server-backed catalog API, a shopping-bag page, local bag state, and server-side quote validation; preview products remain unavailable for purchase.
- Account and legacy store links no longer redirect to deleted legacy pages.

### Phase status

- Phase 2 — Design Preview: closed. Direction A remains the brand visual foundation, with clearer commercial information hierarchy applied to the storefront; the standalone design comparison page is intentionally not retained.
- Phase 3 — Core UI: the desktop page shell, navigation, homepage, catalog, and product detail are unified; featured homepage products now use catalog data and link to detail pages. Mobile is deferred by decision.
- Commerce Core: the catalog, session-backed bag, variants/SKUs, inventory reservation/release/consume transactions, quote APIs, and PostgreSQL migrations are ready. Checkout supports a server-configured flat standard-shipping rate via `ORBITAL_STANDARD_SHIPPING_FEE`; when unset, preparation is blocked without reserving stock. Orders, payments, and accounts remain deferred.
- Page structure convention: new pages reuse the homepage ORBITAL shell, `JellyRadio` navigation, animated background, and `site-shell.css` instead of introducing a separate legacy header.

### Run locally

```powershell
pnpm install
pnpm dev
```

Open <http://localhost:3002>.

The port contract is now explicit:

- `3002`: the only public entry point and the active static-site server port.
- `3010`: reserved internal Storefront port; not enabled in this version.
- `9001`: reserved internal Commerce port; not enabled in this version.

### Pages

- `/`: ORBITAL homepage
- `/shop.html`: preview product catalog
- `/product.html?slug=ember-guard`: preview product detail
- `/cart.html`: Commerce Core preview shopping bag
- `/checkout.html`: checkout information and inventory-hold preview
- `/tarot.html`: Tarot spread
- `/zodiac.html`: Zodiac chart
- `/iching.html`: I Ching reading
- `/ghost-fibers`: standalone animated-background preview
- `/404.html`: shared not-found page
- `/robots.txt` and `/sitemap.xml`: basic search-engine entry points
- `/assets/*`: page scripts, styles, and image assets

### Repository scope

```text
references/TraeWEBTEST/pages   Static pages
references/TraeWEBTEST/assets  Background, component, style, and image assets
references/TraeWEBTEST/assets/data/products.json  Product-data baseline for this visual version
commerce/                    Server-side catalog and bag validation foundation
database/                     PostgreSQL migrations and catalog seed data
server.mjs                     Static server entry on port 3002
docs/                          Project audit and follow-up planning
```

Current Commerce Core APIs include health and catalog reads, session bag reads and writes, `POST /api/cart/quote`, `GET /api/checkout/shipping-quote`, `POST /api/cart/reserve`, `POST /api/checkout/prepare`, and release of reservations owned by the current session. Set `ORBITAL_STANDARD_SHIPPING_FEE` to a non-negative CNY amount (up to two decimal places) to enable the single-rate standard-shipping quote; when unset, checkout preparation is blocked before inventory is reserved. Inventory consumption is reserved for the order flow; public callers cannot directly deduct stock. This workspace reads the PostgreSQL catalog, variant inventory, anonymous session-backed bags, and inventory transactions; environments without `DATABASE_URL` safely fall back to the visual JSON baseline.

`node_modules`, local environment files, certificates/private keys, and the deleted `apps` business source are intentionally excluded. If commerce, accounts, orders, or payments are restored later, rebuild those service boundaries and production deployment plans on top of this baseline.
