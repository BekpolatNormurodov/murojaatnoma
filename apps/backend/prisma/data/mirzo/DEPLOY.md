# Mirzo seed — server deploy runbook

Verified locally: schema applies via the container's `prisma db push` on boot;
`prisma/data/mirzo` (photos + employees.json + seed-mirzo.ts) ships inside the
image (`Dockerfile: COPY --from=build /app/prisma ./prisma`); the seed compiles
and runs under `ts-node` with NO tsconfig needed.

## 0. Prereqs on the server
- VPN up (`ssh book@192.168.200.12` reachable).
- The repo checkout on the server contains this commit
  (`feat(hokimiyat): real Mirzo Ulug'bek staff ...`).

## 1. Unique passwords (IMPORTANT)
`prisma/data/mirzo/passwords.json` is **gitignored** — it does NOT arrive via
git. Without it the seed falls back to `MIRZO_DEFAULT_PASSWORD` (one shared
password) instead of the unique per-employee ones. To ship the unique passwords,
copy the local file into the server checkout **before building the image**:

```bash
# from the local machine (this repo):
scp apps/backend/prisma/data/mirzo/passwords.json \
    book@192.168.200.12:<repo>/apps/backend/prisma/data/mirzo/passwords.json
```

(Skip this step to intentionally use one default password for everyone.)

## 2. Build + start (schema auto-syncs)
```bash
# on the server, in the compose dir:
docker compose build backend
docker compose up -d backend
# container CMD runs: npx prisma db push --skip-generate --accept-data-loss
# -> creates the new columns/tables (Employee.assignedMahallaCodes,
#    lastInsideAssignedZone, EmployeeLocation.insideAssignedZone,
#    employee_salaries) additively. No data loss (all additive).
```

## 3. Run the Mirzo staff seed (idempotent)
```bash
docker compose exec backend node -r ts-node/register prisma/seed-mirzo.ts
```
Prints the login list (username + password) at the end. Env honored:
`UPLOADS_DIR` (default /app/uploads), `PUBLIC_BASE_URL`
(default https://murojaatnoma.uz), `OFFICE_LATITUDE/LONGITUDE`,
`GEOFENCE_RADIUS_M`, `MIRZO_DEFAULT_PASSWORD`.

Re-running is safe: employees are matched by username (phone-safe), Staff by
`mirzo-<username>`, salary only created when missing (never clobbers edits).

## 4. Deploy web-admin
Rebuild + serve `apps/web-admin` (Oyliklar + Nazorat pages, territory-assign
modal). Same as any other web-admin deploy.

## 5. Verify
```bash
# staff seeded + photos served:
curl -s https://murojaatnoma.uz/api/staff | head
curl -sI https://murojaatnoma.uz/uploads/mirzo/gulyamov.jpeg   # 200

# oversight fusion (needs an admin bearer token):
curl -s -H "Authorization: Bearer <admin>" https://murojaatnoma.uz/api/oversight | head
```
- worker-app: log in with a username + its password (from the seed printout).
- web-admin: **Nazorat** page lists all 29 with face/keldi-ketdi/hudud/oylik;
  **Oyliklar** page shows per-role starting salary for the current month.
- Assign a mahalla to someone in Nazorat -> their live location then flags
  in/out of their territory.
