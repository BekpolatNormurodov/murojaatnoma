/**
 * Optional seed script. Not executed automatically (no DB is provisioned in this
 * skeleton). Run manually with `npm run prisma:seed` once DATABASE_URL points at
 * a real Postgres instance and migrations have been applied.
 */
import { PrismaClient, EmployeeRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const admin = await prisma.employee.upsert({
    where: { phone: '+998900000000' },
    update: {},
    create: {
      fullName: 'Tizim Administratori',
      phone: '+998900000000',
      position: 'Administrator',
      region: 'Toshkent',
      district: 'Yunusobod',
      role: EmployeeRole.ADMIN,
    },
  });

  console.log(`Seeded admin employee: ${admin.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
