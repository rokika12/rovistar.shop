# Rovistar Production Deployment

This project is a multi-service commerce platform. Deploy the API and database before deploying any frontend so all storefront, dashboard, payment, and upload requests use Rovistar-owned infrastructure.

## Production Hostnames

| Hostname | Service |
| --- | --- |
| `rovistar.shop` and `www.rovistar.shop` | Customer storefront (`Frontend_User`) |
| `admin.rovistar.shop` | Platform admin (`Frontend_Admin`) |
| `dashboard.rovistar.shop` | Shop-owner dashboard (`Frontend_Dashboard_User`) |
| `reseller.rovistar.shop` | Reseller dashboard (`Frontend_Reseller`) |
| `telegram.rovistar.shop` | Telegram Mini App (`Frontend_Telegram_Mini_APP`) |
| `api.rovistar.shop` | FastAPI backend (`Backend_API`) |

## 1. Deploy the Backend

1. In Render, create a Blueprint deployment from this repository's root. The Blueprint in `Backend_API/render.yaml` creates the `rovistar-api` web service and `rovistar-db` PostgreSQL database.
2. Set `DEFAULT_ADMIN_PASSWORD` in Render to a unique password with at least 12 characters. Do not commit it to GitHub.
3. Confirm the health endpoint responds at `/api/health`.
4. Add `api.rovistar.shop` as the service custom domain in Render. Copy the DNS value shown by Render; it is the source of truth for this record.

The Blueprint uses a persistent disk for product uploads, receipts, QR images, and backups. It uses generated application secrets and a managed PostgreSQL database.

## 2. Deploy the Frontends

Create one Netlify site per app. Import this GitHub repository and set each site's base directory as follows:

| Netlify site | Base directory | Build command | Publish directory |
| --- | --- | --- | --- |
| Storefront | `Frontend_User` | `npm run build` | `build` |
| Admin | `Frontend_Admin` | `npm run build` | `build` |
| Dashboard | `Frontend_Dashboard_User` | `npm run build` | `build` |
| Reseller | `Frontend_Reseller` | `npm run build` | `build` |
| Telegram Mini App | `Frontend_Telegram_Mini_APP` | `npm run build` | `build` |

The committed `netlify.toml` files point all web apps at `https://api.rovistar.shop`. Add the matching custom domain from the table above to each Netlify site.

## 3. Move DNS from Google Sites

The current `rovistar.shop` and `www.rovistar.shop` records point to Google Sites. Do not remove them until Render and Netlify have shown their custom-domain verification records.

1. Add each custom domain in its hosting provider first.
2. Copy the exact DNS records from the provider dashboards.
3. In the domain DNS dashboard, replace the Google Sites records with the verified Netlify records for the storefront and the Render record for `api`.
4. Add the Netlify records for `admin`, `dashboard`, `reseller`, and `telegram`.
5. Wait for HTTPS certificates to become active, then test every hostname.

## 4. Go-Live Checks

- Change the seeded admin password immediately after the first login.
- Keep `MINISHOP_SECRET_KEY`, database credentials, ABA credentials, and Telegram tokens only in hosting-provider environment settings.
- Start ABA Pay in sandbox mode, then switch to live credentials only after a successful end-to-end order test.
- Create a test shop, product, customer order, invoice, image upload, admin login, dashboard login, and reseller login.
- Configure scheduled database backups before accepting real orders.
