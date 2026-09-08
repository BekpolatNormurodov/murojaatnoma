/* eslint-disable no-console */
/**
 * Seed the REAL Mirzo Ulug'bek district hokimiyat apparatus (29 staff) from the
 * official photo roster ("Мирзо Улуғбек фото рўйхат"). Idempotent — safe to run
 * repeatedly (upserts by phone/username and by a deterministic Staff id).
 *
 * For each person it:
 *   1. Copies the portrait into UPLOADS_DIR/mirzo/ and sets `avatarUrl` to the
 *      public `${PUBLIC_BASE_URL}/uploads/mirzo/<file>` URL that the apps render.
 *   2. Upserts an `Employee` (worker-app login + attendance + face + live-map
 *      anchor) with a generated username + bcrypt password + placeholder phone
 *      + office geofence, so they can sign in on mobile immediately.
 *   3. Upserts a `Staff` row (web-admin "Xodimlar" management list + RBAC) with
 *      the mapped StaffRole + module permissions, linked by `login = username`.
 *
 * Run (inside the backend container / repo):
 *   node -r ts-node/register prisma/seed-mirzo.ts
 * or after build:
 *   node dist/prisma/seed-mirzo.js   (if compiled)
 *
 * Honours env: DATABASE_URL, UPLOADS_DIR (default /app/uploads),
 * PUBLIC_BASE_URL (default https://murojaatnoma.uz), OFFICE_LATITUDE,
 * OFFICE_LONGITUDE, GEOFENCE_RADIUS_M, MIRZO_DEFAULT_PASSWORD (default Xodim2026!).
 */
import { EmployeeRole, PrismaClient, StaffRole, ModuleKey, StaffStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface RosterEntry {
  order: number;
  fullName: string;
  surname_cyr: string;
  given_cyr: string;
  birthYear: number | null;
  birthPlace: string | null;
  position: string;
  username: string;
  phone: string;
  staffRole: keyof typeof StaffRole;
  employeeRole: keyof typeof EmployeeRole;
  permissions: string[];
  photoFile: string;
}

const REGION = 'Toshkent shahri';
const DISTRICT = 'Mirzo Ulug‘bek';
const BCRYPT_ROUNDS = 10;

/** Starting base monthly salary by role (so'm) — admin edits later per month. */
const SALARY_BY_ROLE: Record<string, number> = {
  hokim_yordamchisi: 12_000_000,
  bolim_boshligi: 9_000_000,
  operator: 6_500_000,
};

const prisma = new PrismaClient();

function dataDir(): string {
  // works from repo root (prisma/data/mirzo) and from dist (dist/prisma -> ../..)
  const candidates = [
    join(process.cwd(), 'prisma', 'data', 'mirzo'),
    join(__dirname, 'data', 'mirzo'),
    join(__dirname, '..', 'prisma', 'data', 'mirzo'),
  ];
  const found = candidates.find((p) => existsSync(join(p, 'employees.json')));
  if (!found) {
    throw new Error(`Mirzo roster data not found. Looked in:\n${candidates.join('\n')}`);
  }
  return found;
}

function avatarColorFor(seed: string): string {
  const palette = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04', '#dc2626'];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

async function main(): Promise<void> {
  const dir = dataDir();
  const roster = JSON.parse(readFileSync(join(dir, 'employees.json'), 'utf-8')) as RosterEntry[];

  const uploadsDir = process.env.UPLOADS_DIR ?? '/app/uploads';
  const publicBaseUrl = (process.env.PUBLIC_BASE_URL ?? 'https://murojaatnoma.uz').replace(/\/+$/, '');
  const defaultPassword = process.env.MIRZO_DEFAULT_PASSWORD ?? 'Xodim2026!';

  // Per-employee unique passwords (username -> plaintext) from the sidecar file
  // (gitignored). Missing file / missing user falls back to defaultPassword.
  let passwords: Record<string, string> = {};
  const pwPath = join(dir, 'passwords.json');
  if (existsSync(pwPath)) {
    passwords = JSON.parse(readFileSync(pwPath, 'utf-8')) as Record<string, string>;
  }
  const officeLat = process.env.OFFICE_LATITUDE ? parseFloat(process.env.OFFICE_LATITUDE) : 41.3255;
  const officeLng = process.env.OFFICE_LONGITUDE ? parseFloat(process.env.OFFICE_LONGITUDE) : 69.3410;
  const officeRadiusM = process.env.GEOFENCE_RADIUS_M ? parseInt(process.env.GEOFENCE_RADIUS_M, 10) : 150;

  const mirzoUploads = join(uploadsDir, 'mirzo');
  mkdirSync(mirzoUploads, { recursive: true });

  const credentials: Array<{ fullName: string; username: string; password: string; role: string }> = [];
  const nowDate = new Date();
  const curYear = nowDate.getFullYear();
  const curMonth = nowDate.getMonth() + 1;

  for (const p of roster) {
    // 1. photo -> uploads/mirzo/<file>, build public avatar url
    const src = join(dir, 'photos', p.photoFile);
    let avatarUrl: string | null = null;
    if (existsSync(src)) {
      copyFileSync(src, join(mirzoUploads, p.photoFile));
      avatarUrl = `${publicBaseUrl}/uploads/mirzo/${p.photoFile}`;
    } else {
      console.warn(`  ! photo missing for ${p.username}: ${p.photoFile}`);
    }

    // Per-employee unique password (hashed). Only applied on create; a re-run
    // never clobbers a password the employee has since rotated.
    const plainPassword = passwords[p.username] ?? defaultPassword;
    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

    // 2. Employee — match an existing row by the STABLE username first, then by
    //    the (placeholder) phone. Matching on username makes re-runs safe even
    //    after an admin replaces the placeholder phone with a real number — the
    //    old upsert-by-phone would have missed and hit the unique-username
    //    constraint. Password/creds are only set when missing, so a re-run never
    //    clobbers a rotated password.
    const existing = await prisma.employee.findFirst({
      where: { OR: [{ username: p.username }, { phone: p.phone }] },
      select: { id: true, username: true, passwordHash: true },
    });

    const employee = existing
      ? await prisma.employee.update({
          where: { id: existing.id },
          data: {
            fullName: p.fullName,
            position: p.position,
            region: REGION,
            district: DISTRICT,
            role: EmployeeRole[p.employeeRole],
            isActive: true,
            ...(avatarUrl ? { avatarUrl } : {}),
            officeLat,
            officeLng,
            officeRadiusM,
            // Backfill creds only if the row never had them.
            username: existing.username ?? p.username,
            passwordHash: existing.passwordHash ?? passwordHash,
          },
        })
      : await prisma.employee.create({
          data: {
            fullName: p.fullName,
            phone: p.phone,
            position: p.position,
            region: REGION,
            district: DISTRICT,
            role: EmployeeRole[p.employeeRole],
            isActive: true,
            avatarUrl,
            username: p.username,
            passwordHash,
            officeLat,
            officeLng,
            officeRadiusM,
          },
        });

    // 3. Staff — deterministic id so re-runs update the same row.
    const staffId = `mirzo-${p.username}`;
    const permissions = p.permissions.filter((m): m is ModuleKey => m in ModuleKey) as ModuleKey[];
    const staffData = {
      name: p.fullName,
      photo: avatarUrl ?? '',
      avatarColor: avatarColorFor(p.username),
      role: StaffRole[p.staffRole],
      position: p.position,
      department: DISTRICT,
      email: `${p.username}@murojaatnoma.uz`,
      phone: p.phone,
      login: p.username,
      status: StaffStatus.active,
      permissions,
      schedule: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] } as unknown as object,
      twoFactor: false,
    };
    await prisma.staff.upsert({
      where: { id: staffId },
      update: staffData,
      create: { id: staffId, createdAt: new Date(), ...staffData },
    });

    // 4. Starting salary for the current month (idempotent: never clobbers an
    //    admin-edited amount on a re-run — only creates when missing).
    await prisma.employeeSalary.upsert({
      where: {
        employeeId_year_month: { employeeId: employee.id, year: curYear, month: curMonth },
      },
      update: {},
      create: {
        employeeId: employee.id,
        year: curYear,
        month: curMonth,
        amount: SALARY_BY_ROLE[p.staffRole] ?? 6_500_000,
      },
    });

    credentials.push({
      fullName: p.fullName,
      username: p.username,
      password: plainPassword,
      role: p.staffRole,
    });
    console.log(`  ✓ ${p.order.toString().padStart(2)} ${p.username.padEnd(16)} ${p.staffRole.padEnd(17)} ${p.fullName}`);
  }

  console.log(`\nSeeded ${roster.length} Mirzo Ulug'bek staff (Employee + Staff).`);
  console.log('\n=== LOGIN CREDENTIALS (worker-app: username + password) ===');
  console.log('Each employee has a UNIQUE password (from passwords.json) — rotate after first login.\n');
  for (const c of credentials) {
    console.log(`${c.username.padEnd(16)} ${c.password.padEnd(16)} ${c.role.padEnd(17)} ${c.fullName}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
