# ORBITAL

ORBITAL 是面向海外销售的天然水晶手串独立站。项目包含品牌前台、Medusa 电商管理后端，以及用于本地开发的前台服务端网关。前台保留既有 ORBITAL 视觉语言；商品详情、购物袋与结账界面采用清晰的商品信息和交易信息层级。

> 当前版本用于开发与预览。商品、库存、配送、支付和订单流程尚未达到正式销售上线条件；不要将本地开发配置直接用于生产环境。

## 项目组成

```text
前台浏览器
   │
   ▼
server.mjs（本地前台与同源 API 网关，默认 :3002）
   ├── Medusa Store API（商品目录及购物袋，默认 :9000）
   └── Commerce Core / PostgreSQL（独立的目录、库存与交易基础模块）

medusa-platform/apps/backend（Medusa v2 管理后台与 API）
```

- `references/TraeWEBTEST/pages/`：首页、商品目录、商品详情、购物袋、结账及占卜页面。
- `references/TraeWEBTEST/assets/`：JellyRadio 导航、商品卡、页面样式和动态背景资源。
- `medusa-platform/`：Medusa v2 后端与管理后台。
- `commerce/`、`database/`：Commerce Core 服务模块及 PostgreSQL 迁移文件；它与 Medusa 使用的数据库配置相互独立。
- `server.mjs`：前台静态服务、会话购物袋 API 与 Medusa 代理网关。
- `docs/`：产品范围、数据模型和实施规划。

## 本地开发

需要 Node.js `20.19+` 或 `22.12+`，并安装 pnpm。首次运行时，在项目根目录安装前台依赖并准备本地配置：

```powershell
pnpm install
Copy-Item .env.example .env.local
```

如需连接 Medusa，请在 `.env.local` 中填写 Medusa 地址、Store API Publishable Key 和已创建的 Region ID。Publishable Key 可供前台使用；数据库连接串、管理员凭据及其他服务端密钥不得放入前端代码或提交到 Git。

在第一个终端启动 Medusa 后端（先按下方说明准备后端环境变量和 PostgreSQL/Redis）：

```powershell
Set-Location .\medusa-platform
pnpm install
Set-Location .\apps\backend
pnpm dev
```

在第二个终端的项目根目录启动前台：

```powershell
pnpm dev
```

访问：

- 前台：<http://localhost:3002>
- Medusa 管理后台：<http://localhost:9000/app>
- Medusa API：<http://localhost:9000>
- 前台网关健康检查：<http://localhost:3002/api/health>

若只需查看前台视觉，可不启动 Medusa；目录会使用当前可用的数据源或预览数据。实际商品 API 与 Medusa 购物袋需要有效的 Medusa URL、Publishable Key 和 Region 配置。

## Medusa 后端配置

复制后端模板并编辑本地 `.env`：

```powershell
Set-Location .\medusa-platform\apps\backend
Copy-Item .env.template .env
```

在 `apps/backend/.env` 中配置 Medusa 专用 PostgreSQL `DATABASE_URL`、Redis 地址，以及 `JWT_SECRET`、`COOKIE_SECRET` 等服务端变量。请为密钥生成独立的随机值，不要保留模板中的示例值。PostgreSQL 和 Redis 必须先运行。之后从 `medusa-platform/apps/backend` 执行 `pnpm dev`。

管理后台可在登录后进入 **Settings → Profile → Language**，将当前管理员界面设为简体中文。该设置按管理员账号保存。

更完整的后端说明见 [`medusa-platform/apps/backend/README.md`](medusa-platform/apps/backend/README.md)。

## 页面

| 路径 | 页面 |
| --- | --- |
| `/` | 首页 / 精选 / 占卜 / 寻物导航 |
| `/shop.html` | 商品目录 |
| `/product.html?slug=ember-guard` | 商品详情示例 |
| `/cart.html` | 购物袋 |
| `/checkout.html` | 结账预览 |
| `/tarot.html` | 塔罗牌阵 |
| `/zodiac.html` | 星座命盘 |
| `/iching.html` | 易经六爻 |
| `/ghost-fibers` | 动态背景预览 |

所有新增前台页面应沿用首页页面结构、JellyRadio 导航和现有动效，不另建风格不同的导航栏。

## 当前接入状态与上线前待办

- Medusa v2 后端与前台网关已建立；前台可通过 Medusa Store API 读取商品，并为购物袋功能提供接入基础。
- 当前目录中的商品为预览商品，库存为零或不可售；不能据此接受真实订单。
- 创建目标市场的 Medusa Region，并确定币种、销售渠道和商品价格。
- 配置真实库存、配送区域与费率。配送费率目前按此前决定暂不配置；未配置时结账应保持拦截。
- 选择并配置支付服务商，完成订单、退款、税费、邮件通知及异常处理流程。
- 配置正式域名、HTTPS、生产数据库/Redis、密钥管理、备份、监控和部署流水线。
- 完成桌面端交易流程验收、安全检查及上线前测试。移动端目前暂缓。

## 环境文件与安全

- 前台本地配置：项目根目录 `.env.local`，模板为 `.env.example`。
- Medusa 本地配置：`medusa-platform/apps/backend/.env`，模板为 `medusa-platform/apps/backend/.env.template`。
- 环境文件、数据库密码、管理员密码、JWT/Cookie 密钥和私钥不得提交到仓库。提交前检查 `git status`，并确认忽略规则生效。
- `.env.example` 和 `.env.template` 仅用于说明配置项；示例密钥不能用于部署。

## 许可

Medusa 后端模板保留其自身的 MIT 许可文件。ORBITAL 前台素材与其他项目代码的授权应以各自来源和仓库声明为准。
