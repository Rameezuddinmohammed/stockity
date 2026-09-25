# Deploying Quad

Everything runs on **one VPS** with Docker Compose (see `infra/docker-compose.prod.yml`):

```
Internet ──► Caddy (HTTPS, headers) ──┬── /api/* ──► server  (Fastify, runs migrations on start)
                                      └── /*     ──► web     (Next.js standalone)
             server ──► postgres, redis
             backup ──► daily pg_dump, kept 14 days (optional copy to Cloudflare R2)
```

## 1. Get a server

Any Linux VPS with Docker works. Cheap options that fit the $0–6/month plan (PLAN.md §9):

| Option | Cost | Notes |
|---|---|---|
| Oracle Cloud Always Free (Ampere A1) | $0 | Up to 4 ARM cores / 24 GB RAM and 10 TB egress; free capacity can be hard to get in busy regions |
| Hetzner Cloud CAX11 / CX22 | ~€4–6/mo | 20 TB traffic included (EU); very reliable |

Pick a region close to your first campuses. Ubuntu 24.04 is assumed below.

## 2. Prepare it

```bash
# as root on the server
apt update && apt install -y docker.io docker-compose-v2 git ufw
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp && ufw enable
# Phase 2 (video) will also need: ufw allow 3478/udp && ufw allow 5349/tcp && ufw allow 49152:65535/udp

git clone https://github.com/<you>/<repo>.git /opt/quad && cd /opt/quad
cp .env.production.example .env.production
nano .env.production   # fill APP_SECRET, POSTGRES_PASSWORD, ADMIN_EMAILS (and email + R2 settings)
```

## 3. Start it

```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f infra/docker-compose.prod.yml --env-file .env.production exec server \
  node dist/scripts/seed-universities.js            # loads ~10k universities (re-run any time)
```

Open `http://<server-ip>/`. Before you have a domain, keep `DOMAIN=:80` and `APP_ORIGIN=http://<server-ip>`. Session cookies are only marked `Secure` when `APP_ORIGIN` is `https://…`, so sign-in works over plain HTTP for testing. **Don't invite real students until HTTPS is on.**

## 4. When the domain arrives

1. Add the domain to Cloudflare (free plan) and create an `A` record → server IP. Keep the cloud **grey (DNS only)** at first so Caddy can get its certificate. You can turn the proxy on afterwards with SSL mode "Full (strict)".
2. In `.env.production`: `DOMAIN=quad.example`, `APP_ORIGIN=https://quad.example`, `MAIL_FROM=Quad <hello@quad.example>`.
3. Set up email: create a free Resend account, verify the domain (DNS records), then set `MAIL_PROVIDER=resend` and `RESEND_API_KEY`.
4. Fill the placeholders in `apps/web/content/legal/*.md`, get them reviewed, and set `LEGAL_DRAFT = false` in `apps/web/components/legal-page.tsx`.
5. `docker compose ... up -d --build` again. Caddy fetches the HTTPS certificate automatically.

## 5. Backups

- The `backup` service writes `/backups/quad-YYYYMMDD-HHMM.dump` daily and deletes dumps older than 14 days. The Privacy Policy promises 14 days, so change both together.
- **Offsite copy (recommended):** create an R2 bucket plus an API token, then set `RCLONE_REMOTE=r2:<bucket>`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_ENDPOINT`.
- **Restore:**

  ```bash
  docker compose -f infra/docker-compose.prod.yml --env-file .env.production exec backup sh -c \
    'pg_restore --clean --if-exists -d quad /backups/quad-YYYYMMDD-HHMM.dump'
  ```

  Test a restore once before launch.

## 6. Updating

```bash
cd /opt/quad && git pull
docker compose -f infra/docker-compose.prod.yml --env-file .env.production up -d --build
```

Migrations run automatically when the server container starts.

## 7. Everyday checks

- Logs: `docker compose -f infra/docker-compose.prod.yml logs -f server`. The hourly `retention cleanup` line shows what was deleted.
- Admin panel: `/admin` for university requests, domains, approved emails, users and survey results.
- Keep an eye on disk (`df -h`) and bandwidth in your provider's dashboard.
