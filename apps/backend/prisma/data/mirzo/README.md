# Mirzo Ulug‘bek hokimiyati — real xodimlar seed

Manba: **"Мирзо Улуғбек фото рўйхат.docx"** (rasmiy foto ro'yxat). 29 nafar real
xodim (apparat) + 3 vakant o'rin (seed qilinmaydi).

Har bir xodim uchun seed:
1. Portret rasm → `UPLOADS_DIR/mirzo/<username>.<ext>`, `avatarUrl = ${PUBLIC_BASE_URL}/uploads/mirzo/<file>`.
2. `Employee` (worker-app login + davomat + face + jonli xarita anchor): username + bcrypt parol + placeholder telefon + ofis geofence.
3. `Staff` (web-admin "Xodimlar" ro'yxati + RBAC): StaffRole + module ruxsatlari, `login = username`.

Idempotent — qayta-qayta ishga tushirsa xavfsiz (upsert by phone/username va `mirzo-<username>` Staff id).

## Ishga tushirish (server, backend konteyner ichida)

```bash
# repo root: apps/backend
node -r ts-node/register prisma/seed-mirzo.ts
```

Docker compose bilan:

```bash
docker compose exec backend node -r ts-node/register prisma/seed-mirzo.ts
```

> Eslatma: `prisma/data/mirzo/photos/` konteyner ichida ham bo'lishi kerak
> (image'ga ko'chirilgan yoki volume orqali). Script rasmlarni shu papkadan
> `UPLOADS_DIR/mirzo/` ga ko'chiradi.

## Muhit o'zgaruvchilari (env)

| Env | Default | Izoh |
|---|---|---|
| `DATABASE_URL` | — | Prisma ulanishi (majburiy) |
| `UPLOADS_DIR` | `/app/uploads` | Rasmlar ko'chiriladigan papka |
| `PUBLIC_BASE_URL` | `https://murojaatnoma.uz` | avatarUrl domeni |
| `OFFICE_LATITUDE` / `OFFICE_LONGITUDE` | `41.3255 / 69.3410` | Ofis geofence markazi |
| `GEOFENCE_RADIUS_M` | `150` | Geofence radiusi (m) |
| `MIRZO_DEFAULT_PASSWORD` | `Xodim2026!` | Barcha uchun standart parol |

Ishga tushgach terminal login ma'lumotlarini (username + parol) chop etadi.

## Login

- **worker-app (mobil):** `username` + `Xodim2026!` (har kim keyin o'zgartirsin).
- **web-admin:** xodimlar "Xodimlar" ro'yxatida ko'rinadi (Staff), jonli xarita +
  davomat/keldi-ketdi ma'lumotlari Employee'dan keladi.

## Rol taqsimoti

- `hokim_yordamchisi` — hokim o'rinbosarlari, yordamchi, maslahatchi (8)
- `bolim_boshligi` — bo'lim/boshqarma/guruh boshliqlari, bosh hisobchi, yuristkonsult (8)
- `operator` — bosh/yetakchi mutaxassislar, loyiha menejeri (13)
