# Deploying Quad

Everything runs on **one VPS** with Docker Compose (see `infra/docker-compose.prod.yml`):

```
Internet ──► Caddy (HTTPS, headers) ──┬── /api/* ──► server  (Fastify API + /api/ws live chat)
                                      └── /*     ──► web     (Next.js standalone)
Browsers ──► coturn :3478 (TURN relay for all call video/audio; IPs stay hidden)
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
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp
ufw allow 3478/tcp && ufw allow 3478/udp && ufw allow 49160:49660/udp   # TURN relay for video
ufw enable

git clone https://github.com/<you>/<repo>.git /opt/quad && cd /opt/quad
cp .env.production.example .env.production
nano .env.production   # fill APP_SECRET, POSTGRES_PASSWORD, ADMIN_EMAILS, PUBLIC_IP, TURN_HOST, TURN_SECRET
                       # (and email + R2 settings)
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

## 5. Video calls (TURN)

Every call's media goes through the `coturn` container, so students never see each other's IP address. The API hands each browser short-lived TURN credentials (an HMAC signed with `TURN_SECRET`), so there's no static password to leak.

- **Bandwidth is the main cost.** Calls are capped at about 480p / 500 kbps each way, which is roughly 0.5–1 GB of relay traffic per call-hour. Check it in your provider's dashboard.
- **Ports:** 3478 (UDP and TCP) plus the relay range 49160–49660/udp. That range allows about 250 simultaneous calls; widen `--min-port/--max-port` in the compose file to go higher.
- **Strict campus Wi-Fi** sometimes blocks everything except 443. The fix is TURN over TLS on port 443, which needs a second IP (Caddy already uses 443 on the first one). Add it once students report "Video couldn't connect".
- **Quick test:** open `/chat` in two browsers on different networks (for example phone data and home Wi-Fi) and start a video chat.

## 6. Backups

- The `backup` service writes `/backups/quad-YYYYMMDD-HHMM.dump` daily and deletes dumps older than 14 days. The Privacy Policy promises 14 days, so change both together.
- **Offsite copy (recommended):** create an R2 bucket plus an API token, then set `RCLONE_REMOTE=r2:<bucket>`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_ENDPOINT`.
- **Restore:**

  ```bash
  docker compose -f infra/docker-compose.prod.yml --env-file .env.production exec backup sh -c \
    'pg_restore --clean --if-exists -d quad /backups/quad-YYYYMMDD-HHMM.dump'
  ```

  Test a restore once before launch.

## 7. Updating

```bash
cd /opt/quad && git pull
docker compose -f infra/docker-compose.prod.yml --env-file .env.production up -d --build
```

Migrations run automatically when the server container starts.

## 8. Everyday checks

- Logs: `docker compose -f infra/docker-compose.prod.yml logs -f server`. The hourly `retention cleanup` line shows what was deleted.
- Admin panel: `/admin`. Work the **Reports** queue first (oldest first). Then university requests, domains, approved emails, users and survey results.
- Keep an eye on disk (`df -h`) and bandwidth in your provider's dashboard.
