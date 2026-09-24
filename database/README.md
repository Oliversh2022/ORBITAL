# ORBITAL PostgreSQL 数据库

## 中文

ORBITAL 的业务数据库选用 PostgreSQL 17，当前使用全新数据库 `orbital_catalog`。旧的 `orbital_store` 已删除，不再作为项目数据源。当前迁移建立商品目录、商品变体、购物袋、库存预占和订单基础结构；支付表、客户地址和联系方式仍未纳入。

技术表名和字段名使用清晰的英文 `snake_case`，并通过 PostgreSQL `COMMENT ON` 与中文字段内容保证可读性和兼容性。中文直接作为表名会要求大量双引号，容易给 ORM、迁移工具和 API 层带来不必要的不一致。

执行顺序：

```powershell
# DATABASE_URL 应指向 orbital_catalog，例如：
# postgresql://orbital_app:<password>@localhost:5432/orbital_catalog
psql "$env:DATABASE_URL" -f database/001_initial_catalog.sql
psql "$env:DATABASE_URL" -f database/002_seed_visual_catalog.sql
psql "$env:DATABASE_URL" -f database/003_commerce_core.sql
psql "$env:DATABASE_URL" -f database/004_seed_commerce_core.sql
psql "$env:DATABASE_URL" -f database/005_commerce_runtime_grants.sql
psql "$env:DATABASE_URL" -f database/006_inventory_reservations.sql
psql "$env:DATABASE_URL" -f database/007_order_foundation.sql
```

`001` 和 `002` 建立并写入商品目录；`003` 到 `006` 是 Commerce Core 的结构、种子、运行权限和库存预占迁移，`007` 建立订单与商品快照表，并允许库存预占关联订单。本机 `orbital_catalog` 已应用全部七组迁移。当前三款预览商品仍以零库存、不可购买状态写入。订单草稿不保存顾客地址、联系方式或支付信息；未配置 `DATABASE_URL` 时应用回退到视觉 JSON 基线。

不要把真实数据库密码写入仓库。生产环境使用密钥管理服务提供 `DATABASE_URL`。

当 `DATABASE_URL` 已配置并完成全部迁移后，服务端会自动使用 PostgreSQL 目录；未配置时继续使用视觉 JSON 基线。可通过 `GET /api/health` 查看当前目录数据源。

## English

ORBITAL uses PostgreSQL 17 with a new, clean database named `orbital_catalog`. The old `orbital_store` database has been deleted and is no longer a project data source. The current migrations create the catalog, product variants, bags, inventory reservations, and a basic order ledger; payment tables and customer address/contact data remain deferred.

Technical table and column identifiers use clear English `snake_case`, while PostgreSQL comments and business content remain bilingual/Chinese-friendly. Quoted Chinese identifiers would reduce compatibility across ORMs, migration tools, and API layers.

Run the migrations in order:

```powershell
# DATABASE_URL must point to orbital_catalog, for example:
# postgresql://orbital_app:<password>@localhost:5432/orbital_catalog
psql "$env:DATABASE_URL" -f database/001_initial_catalog.sql
psql "$env:DATABASE_URL" -f database/002_seed_visual_catalog.sql
psql "$env:DATABASE_URL" -f database/003_commerce_core.sql
psql "$env:DATABASE_URL" -f database/004_seed_commerce_core.sql
psql "$env:DATABASE_URL" -f database/005_commerce_runtime_grants.sql
psql "$env:DATABASE_URL" -f database/006_inventory_reservations.sql
psql "$env:DATABASE_URL" -f database/007_order_foundation.sql
```

Migrations `001` and `002` create and seed the catalog. `003` through `006` add Commerce Core structure, runtime grants, and inventory reservations. `007` adds order and immutable product/price snapshot tables and links reservations to orders; the local `orbital_catalog` has all seven migration groups applied. Draft orders do not store customer contact/address or payment data. The three preview products remain at zero stock and unavailable. Environments without `DATABASE_URL` fall back to the visual JSON baseline.

Never commit real database credentials. Production should provide `DATABASE_URL` through a secrets manager.

When `DATABASE_URL` is configured and all migrations have been applied, the server automatically uses the PostgreSQL catalog; without it, the visual JSON baseline remains active. Use `GET /api/health` to inspect the current catalog source.
