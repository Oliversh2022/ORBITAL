# ORBITAL

## 中文

ORBITAL 是一个以星象、占卜与天然水晶手串为核心的独立站视觉版本。当前仓库保存的是可直接运行的静态网站版本，重点完成了品牌首页、动态背景、导航交互、产品卡牌翻转与占卜入口的统一视觉体验。

### 当前版本内容

- GhostFibers 动态 WebGL 光纤背景作为全站背景。
- JellyRadio 导航切换：占卜 / 关于，保留回弹动效，按钮背景以透明为主。
- 产品展示卡使用 FlipCard：正面展示商品图，点击后以卡牌翻转动效展示价格与暗色商品图。
- 三张占卜入口卡保留 BorderGlow 边缘光效，移除了额外的鼠标浮动抬升效果。
- 首页、塔罗牌阵、星座命盘、易经六爻和视觉预览页面均可通过静态服务器访问。
- 购物车、账户和旧版商城入口不会再跳转到已删除的旧页面。

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
- `/tarot.html`：塔罗牌阵
- `/zodiac.html`：星座命盘
- `/iching.html`：易经六爻
- `/design-preview.html`：视觉方向预览
- `/ghost-fibers`：动态背景单独预览
- `/404.html`：统一 404 页面
- `/robots.txt`、`/sitemap.xml`：基础搜索引擎入口
- `/assets/*`：页面使用的脚本、样式与图片资源

### 目录

```text
references/TraeWEBTEST/pages   静态页面
references/TraeWEBTEST/assets  背景、组件脚本、样式与图片资源
server.mjs                     3002 静态服务入口
docs/                          项目审计与后续规划
```

当前仓库刻意不包含 `node_modules`、本地环境变量、证书/私钥以及已被删除的 `apps` 业务源码。后续若恢复真实商城、账户、订单和支付能力，应在本版本基础上重新规划服务边界与生产部署。

---

## English

ORBITAL is an independent-store visual baseline centered on astrology, divination, and natural crystal bracelets. This repository contains the currently runnable static website version, including the unified brand homepage, animated background, navigation interaction, product card flipping, and divination entry points.

### Included in this version

- GhostFibers WebGL fiber background used as the global visual background.
- JellyRadio navigation for Divination / About, keeping the spring-like interaction while using a transparent surrounding surface.
- FlipCard product cards: product imagery on the front, and price plus a dark product image on the back with the original card-flip motion.
- BorderGlow applied to the three divination cards, with the additional mouse-lift effect removed.
- Static pages for the homepage, Tarot, Zodiac, I Ching, and design preview.
- Cart and account links no longer redirect to deleted legacy pages.

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
- `/tarot.html`: Tarot spread
- `/zodiac.html`: Zodiac chart
- `/iching.html`: I Ching reading
- `/design-preview.html`: visual direction preview
- `/ghost-fibers`: standalone animated-background preview
- `/404.html`: shared not-found page
- `/robots.txt` and `/sitemap.xml`: basic search-engine entry points
- `/assets/*`: page scripts, styles, and image assets

### Repository scope

```text
references/TraeWEBTEST/pages   Static pages
references/TraeWEBTEST/assets  Background, component, style, and image assets
server.mjs                     Static server entry on port 3002
docs/                          Project audit and follow-up planning
```

`node_modules`, local environment files, certificates/private keys, and the deleted `apps` business source are intentionally excluded. If commerce, accounts, orders, or payments are restored later, rebuild those service boundaries and production deployment plans on top of this baseline.
