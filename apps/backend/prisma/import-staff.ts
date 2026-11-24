/* eslint-disable no-console */
/**
 * Import the district staff roster (xodimlar) from a folder that is NOT in git:
 *
 *   <dir>/staff.json      [{ order, fullName, position, department, curator?,
 *                            phone, username, staffRole, permissions[], photoFile? }]
 *   <dir>/photos/*.jpg    portraits referenced by `photoFile`
 *
 * The folder holds real phone numbers, so it is copied to the server next to
 * the stack and never committed (the repo is public).
 *
 * For each person (idempotent — matched by username, then phone):
 *   - photo  -> UPLOADS_DIR/staff/<file>, avatarUrl = PUBLIC_BASE_URL/uploads/staff/<file>
 *   - Employee: name, position, department (found or created), real phone,
 *     worker-app username; a NEW random password only when the row has none
 *     (a re-run never resets a password someone already uses)
 *   - Staff row (web-admin "Xodimlar" RBAC) with role + module permissions
 *
 * New passwords are written to <dir>/credentials.tsv (mode 600) — never printed.
 *
 * Run inside the backend container:
 *   STAFF_IMPORT_DIR=/tmp/staff-import node -r ts-node/register prisma/import-staff.ts
 * Add --archive-others to move active employees NOT in the roster to the archive.
 */
import { EmployeeRole, ModuleKey, Prisma, PrismaClient, StaffRole, StaffStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface RosterEntry {
  order: number;
  fullName: string;
  position: string;
  department: string | null;
  curator?: string | null;
  phone: string | null;
  username: string;
  staffRole: keyof typeof StaffRole;
  permissions: string[];
  photoFile: string | null;
}

const REGION = 'Toshkent shahri';
const DISTRICT = 'Mirzo Ulug‘bek';
const prisma = new PrismaClient();

/** 10 chars, no look-alikes (0/O, 1/l/I) — easy to dictate over the phone. */
function newPassword(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += abc[randomInt(abc.length)];
  return s;
}

function avatarColorFor(seed: string): string {
  const palette = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04', '#dc2626'];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

async function departmentId(name: string | null, cache: Map<string, string>): Promise<string | null> {
  const clean = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const key = clean.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const found = await prisma.department.findFirst({
    where: { name: { equals: clean, mode: 'insensitive' } },
    select: { id: true },
  });
  const id =
    found?.id ??
    (
      await prisma.department.create({
        data: {
          name: clean,
          code: `${key.normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'bolim'}-${Date.now().toString(36)}`,
        },
      })
    ).id;
  cache.set(key, id);
  return id;
}

async function main(): Promise<void> {
  const dir = process.env.STAFF_IMPORT_DIR ?? '/tmp/staff-import';
  const rosterPath = join(dir, 'staff.json');
  if (!existsSync(rosterPath)) throw new Error(`staff.json not found in ${dir}`);
  const roster = JSON.parse(readFileSync(rosterPath, 'utf-8')) as RosterEntry[];

  const uploadsDir = process.env.UPLOADS_DIR ?? '/app/uploads';
  const base = (process.env.PUBLIC_BASE_URL ?? 'https://murojaatnoma.uz').replace(/\/+$/, '');
  const staffUploads = join(uploadsDir, 'staff');
  mkdirSync(staffUploads, { recursive: true });
  chmodSync(staffUploads, 0o755);

  const depts = new Map<string, string>();
  const issued: string[] = [];
  const keep = new Set<string>();

  for (const p of roster) {
    let avatarUrl: string | null = null;
    if (p.photoFile) {
      const src = join(dir, 'photos', p.photoFile);
      if (existsSync(src)) {
        const dest = join(staffUploads, p.photoFile);
        copyFileSync(src, dest);
        // World-readable: the gateway nginx serves /uploads/ as a different user.
        chmodSync(dest, 0o644);
        avatarUrl = `${base}/uploads/staff/${p.photoFile}`;
      } else {
        console.warn(`  ! photo missing: ${p.photoFile}`);
      }
    }
    const departmentIdValue = await departmentId(p.department, depts);
    const phone = p.phone ?? `+99800${String(p.order).padStart(7, '0')}`;

    const existing = await prisma.employee.findFirst({
      where: { OR: [{ username: p.username }, { phone }] },
      select: { id: true, username: true, passwordHash: true, avatarUrl: true },
    });

    let password: string | null = null;
    if (!existing?.passwordHash) {
      password = newPassword();
    }
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

    const common = {
      fullName: p.fullName,
      position: p.position,
      region: REGION,
      district: DISTRICT,
      role: EmployeeRole.EMPLOYEE,
      isActive: true,
      archivedAt: null,
      archiveReason: null,
      departmentId: departmentIdValue,
    };

    let employeeId: string;
    try {
      if (existing) {
        const updated = await prisma.employee.update({
          where: { id: existing.id },
          data: {
            ...common,
            phone,
            username: existing.username ?? p.username,
            // Keep a photo the admin uploaded later; set ours only when empty.
            ...(avatarUrl && !existing.avatarUrl ? { avatarUrl } : {}),
            ...(passwordHash ? { passwordHash } : {}),
          },
        });
        employeeId = updated.id;
      } else {
        const created = await prisma.employee.create({
          data: { ...common, phone, username: p.username, avatarUrl, passwordHash },
        });
        employeeId = created.id;
      }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        console.error(`  ✗ ${p.username}: unique clash on ${String(e.meta?.target)} — skipped`);
        continue;
      }
      throw e;
    }
    keep.add(employeeId);

    const permissions = p.permissions.filter((m): m is ModuleKey => m in ModuleKey) as ModuleKey[];
    const staffData = {
      name: p.fullName,
      photo: avatarUrl ?? '',
      avatarColor: avatarColorFor(p.username),
      role: StaffRole[p.staffRole] ?? StaffRole.operator,
      position: p.position,
      department: p.department ?? DISTRICT,
      email: `${p.username}@murojaatnoma.uz`,
      phone,
      login: p.username,
      status: StaffStatus.active,
      permissions,
      schedule: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] } as unknown as object,
      twoFactor: false,
    };
    const staffId = `staff-${p.username}`;
    await prisma.staff.upsert({
      where: { id: staffId },
      update: staffData,
      create: { id: staffId, createdAt: new Date(), ...staffData },
    });

    if (password) issued.push(`${p.username}\t${password}\t${p.fullName}\t${p.position}`);
    console.log(
      `  ✓ ${String(p.order).padStart(2)} ${p.username.padEnd(14)} ${(p.department ?? '').padEnd(20)} ${avatarUrl ? 'foto' : '—   '} ${p.fullName}`,
    );
  }

  if (process.argv.includes('--archive-others')) {
    const res = await prisma.employee.updateMany({
      where: { isActive: true, id: { notIn: [...keep] } },
      data: { isActive: false, archivedAt: new Date(), archiveReason: 'Yangi ro‘yxatda yo‘q (import)' },
    });
    console.log(`\nArchived ${res.count} employee(s) not in the roster.`);
  }

  if (issued.length > 0) {
    const out = join(dir, 'credentials.tsv');
    writeFileSync(out, `username\tparol\tF.I.Sh.\tlavozim\n${issued.join('\n')}\n`, { mode: 0o600 });
    chmodSync(out, 0o600);
    console.log(`\n${issued.length} new login(s) written to ${out} (mode 600).`);
  }
  console.log(`\nImported ${keep.size}/${roster.length} employees.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
