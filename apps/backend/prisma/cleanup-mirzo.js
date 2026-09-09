/* eslint-disable */
/**
 * Production data cleanup: keep ONLY the super-admin + the 29 real Mirzo Ulug'bek
 * staff (seeded from the photo roster). Removes clearly-mock/demo rows only:
 *   - mock Workers  (w1..wN — the mock-contract "Ishchilar")
 *   - mock Staff    (ids NOT starting with "mirzo-")
 *   - demo Employees (bootstrap seed, phone +99890111220x)
 *   - test Employees (anything NOT in the real Mirzo district)
 *
 * Does NOT touch: the 29 Mirzo employees/staff, AdminUser (super-admin),
 * Applications, AppUsers, or any real citizen data. Prints before/after counts.
 *
 * Run (inside the backend container):
 *   docker compose exec backend node prisma/cleanup-mirzo.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DISTRICT = 'Mirzo Ulug‘bek';

(async () => {
  const before = {
    employees: await prisma.employee.count(),
    staff: await prisma.staff.count(),
    workers: await prisma.worker.count(),
    admins: await prisma.adminUser.count(),
  };
  console.log('BEFORE:', JSON.stringify(before));

  // 1) demo employees (bootstrap seed)
  const demo = await prisma.employee.deleteMany({ where: { phone: { startsWith: '+99890111220' } } });
  // 2) any employee NOT in the real Mirzo district (test/demo accounts)
  const nonMirzo = await prisma.employee.deleteMany({ where: { NOT: { district: DISTRICT } } });
  // 3) all mock Workers (real people are Employees, not Workers)
  const workers = await prisma.worker.deleteMany({});
  // 4) mock Staff (anything the Mirzo seed didn't create)
  const mockStaff = await prisma.staff.deleteMany({ where: { NOT: { id: { startsWith: 'mirzo-' } } } });

  console.log('DELETED:', JSON.stringify({
    demoEmployees: demo.count,
    testEmployees: nonMirzo.count,
    mockWorkers: workers.count,
    mockStaff: mockStaff.count,
  }));

  const after = {
    employees: await prisma.employee.count(),
    staff: await prisma.staff.count(),
    workers: await prisma.worker.count(),
    admins: await prisma.adminUser.count(),
  };
  console.log('AFTER:', JSON.stringify(after));
  console.log(after.employees === 29 && after.workers === 0 && after.admins >= 1
    ? 'OK: super-admin + 29 real staff kept.'
    : 'CHECK: unexpected remaining counts.');

  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
