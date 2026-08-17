# Deployment infrastructure

Docker Compose stack for the government system: Postgres + NestJS backend +
web-admin SPA, all fronted by a single nginx gateway that terminates TLS.
Single-box deployment — no Kubernetes/Swarm.

## Layout

```
infra/
  docker-compose.yml     # all services
  .env.example           # copy to .env and fill in
  nginx/
    nginx.conf            # main nginx config (gateway)
    conf.d/default.conf   # :80 redirect + :443 TLS + proxy rules
  certs/                  # fullchain.pem / privkey.pem (gitignored, generated)
  scripts/
    gen-selfsigned.sh      # self-signed TLS cert for the bare IP
    bootstrap-server.sh    # one-time Ubuntu Docker install
    deploy.sh              # git pull + build + up on the server
```

## Services & ports

| Service    | Image / build                 | Published to host | Notes                              |
|------------|--------------------------------|--------------------|-------------------------------------|
| postgres   | postgres:16-alpine             | none (internal)    | data in named volume `pgdata`       |
| backend    | build: ../apps/backend         | none (internal)    | NestJS, listens on 3000             |
| web-admin  | build: ../apps/web-admin       | none (internal)    | nginx serving the Vite `dist/` build|
| gateway    | nginx:alpine                   | **80, 443**        | only service exposed to the host    |

Everything sits on one Docker network (`internal`). Only `gateway` publishes
ports; `backend` and `web-admin` are reached only through it.

## Routing / `/api` prefix handling

The gateway proxies:

- `/` → `http://web-admin:80` (the SPA container; it already does its own
  `try_files $uri /index.html` fallback for client-side routing).
- `/api/` → `http://backend:3000/` — **the `/api` prefix is stripped**
  before hitting the backend, because both the `location /api/` match and
  the `proxy_pass` target end in a trailing slash (nginx replaces the
  matched prefix with the proxy target in that case).

  Example: a browser request to `https://<host>/api/users` reaches the
  backend as `GET /users`. The NestJS app should **not** also set a global
  `/api` prefix (`app.setGlobalPrefix('api')`), or requests will 404 against
  a doubled path. If the backend does need to keep that prefix, drop the
  trailing slash from `proxy_pass` in `infra/nginx/conf.d/default.conf`
  instead (`proxy_pass http://backend:3000;`) so `/api` is preserved.

## TLS — self-signed today, Let's Encrypt later

There's no domain yet, so the gateway serves a **self-signed certificate**
for the server's bare IP (`192.168.210.12` by default). Browsers will show
an untrusted-certificate warning during testing — that's expected.

Generate it once (idempotent, safe to re-run):

```bash
infra/scripts/gen-selfsigned.sh
# or with a different IP:
SERVER_IP=203.0.113.10 infra/scripts/gen-selfsigned.sh
```

This writes `infra/certs/fullchain.pem` and `infra/certs/privkey.pem`,
which the gateway mounts read-only.

**When a domain is added**, replace this step with certbot (e.g. the
`certbot/certbot` webroot or standalone flow, or `certbot --nginx` on the
host), point it at the same `infra/certs/fullchain.pem` /
`infra/certs/privkey.pem` paths (or update the two `ssl_certificate*`
directives in `infra/nginx/conf.d/default.conf`), and set up its renewal
cron/systemd timer. No other change to the compose file is required.

## Local test flow (this repo, on your machine)

1. `cp infra/.env.example infra/.env` and fill in real secrets (Postgres
   password, JWT secrets — e.g. `openssl rand -base64 48`).
2. `infra/scripts/gen-selfsigned.sh` (uses the default IP unless you pass
   `SERVER_IP=...`; for pure localhost testing this still works because the
   cert also includes `IP:127.0.0.1` and `DNS:localhost`).
3. `cd infra && docker compose build`
4. `docker compose up -d`
5. `docker compose ps` to confirm all four services are healthy/running.
6. Open `https://localhost/` (accept the self-signed warning) for the SPA,
   and `https://localhost/api/...` for the API.

## Server deploy flow (Ubuntu, IP-only for now)

One-time setup on a fresh server:

```bash
git clone <repo-url> && cd goverment-system
bash infra/scripts/bootstrap-server.sh   # installs Docker + compose plugin
cp infra/.env.example infra/.env         # fill in real secrets
```

Every deploy after that:

```bash
bash infra/scripts/deploy.sh
```

`deploy.sh` does: `git pull` → generates a self-signed cert if
`infra/certs/*.pem` is missing → `docker compose build` →
`docker compose up -d` → `docker compose ps`.

Then browse to `https://<server-ip>/` (port 80 auto-redirects to 443).

## Notes

- `infra/.env` and `infra/certs/*.pem` are gitignored — never commit them.
  Rotate the `.env.example` placeholder secrets before real use.
- Postgres is not published to the host by default. To connect a DB client
  from the host for debugging, temporarily uncomment the `ports:` block
  under the `postgres` service in `docker-compose.yml` (binds to
  `127.0.0.1` only).
- `client_max_body_size` is set to `25m` (gateway) to accommodate
  photo/video uploads; raise it in both `infra/nginx/nginx.conf` and
  `infra/nginx/conf.d/default.conf` if larger uploads are needed.
