# ORBITAL PostgreSQL 数据库

## 中文

ORBITAL 的业务数据库选用 PostgreSQL 17，当前使用全新数据库 `orbital_catalog`。旧的 `orbital_store` 已删除，不再作为项目数据源。当前迁移只建立商品目录和占卜关联数据，不会创建用户、订单或支付表。

技术表名和字段名使用清晰的英文 `snake_case`，并通过 PostgreSQL `COMMENT ON` 与中文字段内容保证可读性和兼容性。中文直接作为表名会要求大量双引号，容易给 ORM、迁移工具和 API 层带来不必要的不一致。

执行顺序：

```powershell
# DATABASE_URL 应指向 orbital_catalog，例如：
# postgresql://orbital_app:<password>@localhost:5432/orbital_catalog
psql "$env:DATABASE_URL" -f database/001_initial_catalog.sql
psql "$env:DATABASE_URL" -f database/002_seed_visual_catalog.sql
```

本机开发库 `orbital_catalog` 已完成迁移并写入三款视觉基线商品。应用运行时连接仍需在下一阶段 Storefront 服务创建后接入。

不要把真实数据库密码写入仓库。生产环境使用密钥管理服务提供 `DATABASE_URL`。

## English

ORBITAL uses PostgreSQL 17 with a new, clean database named `orbital_catalog`. The old `orbital_store` database has been deleted and is no longer a project data source. The initial migrations create the catalog and its divination relationships only; user, order, and payment tables are intentionally deferred.

Technical table and column identifiers use clear English `snake_case`, while PostgreSQL comments and business content remain bilingual/Chinese-friendly. Quoted Chinese identifiers would reduce compatibility across ORMs, migration tools, and API layers.

Run the migrations in order:

```powershell
# DATABASE_URL must point to orbital_catalog, for example:
# postgresql://orbital_app:<password>@localhost:5432/orbital_catalog
psql "$env:DATABASE_URL" -f database/001_initial_catalog.sql
psql "$env:DATABASE_URL" -f database/002_seed_visual_catalog.sql
```

The local `orbital_catalog` database has been migrated and seeded with the three visual baseline products. Runtime application access will be connected when the Storefront service is rebuilt.

Never commit real database credentials. Production should provide `DATABASE_URL` through a secrets manager.
