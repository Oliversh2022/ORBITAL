# ORBITAL Commerce Backend

ORBITAL's commerce backend is built on Medusa v2. The existing storefront remains a separate application; this project is the operational backend and does not change the storefront's visual language.

## Local admin

- Admin: <http://localhost:9000/app>
- Backend API: <http://localhost:9000>
- ORBITAL storefront: <http://localhost:3002>
- Database: the isolated PostgreSQL database `orbital_medusa` (the existing `orbital_catalog` database is not used by this app).
- Admin account: the store owner's email address configured during setup.
- Backend database/runtime config is in `apps/backend/.env`; storefront-to-Medusa settings are in the workspace `.env.local`. Do not commit or share either file.

Start the backend from PowerShell:

```powershell
$node22 = Join-Path $env:LOCALAPPDATA 'Codex\tools\node-v22.23.3\node-v22.23.3-win-x64'
$env:PATH = "$node22;$env:PATH"
Set-Location .\apps\backend
pnpm dev
```

Start the storefront gateway from the repository workspace root with `pnpm dev`. It serves the existing ORBITAL pages on port 3002 and proxies catalog/cart calls to Medusa using the publishable key in `.env.local`.

The three existing ORBITAL products are public preview products so the storefront can read them from Medusa. Their CNY prices, bilingual descriptions, tags, and image paths are read from Medusa; inventory is zero and purchases remain disabled. The storefront's existing layout, navigation, and card interactions are unchanged.

Set the Admin language to 简体中文 under **Settings → Profile → Language**. This affects the signed-in Admin user only; product content and storefront language are configured separately.

## Current integration boundary

The storefront catalog and product details now use a same-origin gateway to Medusa's Store API. Cart endpoints are wired behind that gateway, but Medusa cannot create a cart until a real sales region is selected and `MEDUSA_REGION_ID` is set in `.env.local`. Shipping rates, inventory, payment-provider credentials, and regions are not invented. Until a region and shipping/payment setup are configured, the cart remains an empty preview and checkout is explicitly blocked.
