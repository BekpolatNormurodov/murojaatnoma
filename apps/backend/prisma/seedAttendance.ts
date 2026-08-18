/**
 * Standalone demo-data seed for the dashboards (web-admin) and the mobile app.
 *
 * This is INTENTIONALLY separate from `prisma/seed.ts` (owned by another
 * workstream) and is NOT wired into `package.json`'s `prisma.seed` config.
 * Run it manually once DATABASE_URL points at a real Postgres instance and
 * migrations have been applied:
 *
 *   npx ts-node prisma/seed-mobile.ts
 *
 * Fully idempotent: safe to run repeatedly.
 *   - Departments upsert by unique `code`.
 *   - Employees upsert by unique `phone`.
 *   - Today's AttendanceRecords are deleted for the seeded employees and
 *     recreated fresh on every run (keeps "today's roster" realistic no
 *     matter what day the script is executed).
 *   - Applications / ApplicationMessages / ApplicationEvents / Attachments
 *     upsert by deterministic ids ("seed-app-01", "seed-app-01-msg-1", ...).
 *   - Notifications have no natural stable key, so all Notification rows for
 *     the seeded employee ids are deleted and recreated fresh on every run.
 */
import {
  PrismaClient,
  EmployeeRole,
  AttendanceType,
  ApplicationStatus,
  MessageSenderRole,
  ApplicationEventType,
  AttachmentType,
  NotificationType,
} from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Config (hardcoded here on purpose — this script must not depend on files
// owned by other modules; src/common/config/constants.ts has the same
// values as of this writing: LATE_GRACE_MINUTES=5, office ~ 41.3111,69.3402).
// ---------------------------------------------------------------------------
const LATE_GRACE_MINUTES = 5;
const OFFICE_LAT = 41.3111;
const OFFICE_LNG = 69.3402;

const REGION = "Toshkent shahri";
const DISTRICT = "Mirzo Ulug'bek";

// ---------------------------------------------------------------------------
// Date helpers (all local server time — consistent with how the rest of the
// codebase constructs `recordedAt` / `createdAt` Date objects).
// ---------------------------------------------------------------------------
function todayAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfTomorrow(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

function daysAgo(n: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function hoursAfter(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

/** Minutes-late computation, mirroring the attendance module's late-check rule. */
function computeLateness(
  workStartTime: string,
  recordedAt: Date,
  graceMinutes: number,
): { isLate: boolean; lateMinutes: number } {
  const [h, m] = workStartTime.split(':').map((n) => parseInt(n, 10));
  const start = new Date(recordedAt);
  start.setHours(h, m, 0, 0);
  const diffMinutes = Math.round((recordedAt.getTime() - start.getTime()) / 60000);
  const isLate = diffMinutes > graceMinutes;
  return { isLate, lateMinutes: isLate ? diffMinutes : 0 };
}

// ---------------------------------------------------------------------------
// 1) Departments
// ---------------------------------------------------------------------------
const departmentsSeed = [
  { code: 'IJT', name: 'Ijtimoiy masalalar' },
  { code: 'OBD', name: "Obodonlashtirish va kommunal" },
  { code: 'YER', name: 'Yer va qurilish' },
  { code: 'MUR', name: "Murojaatlar bo'limi" },
];

async function seedDepartments(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const dept of departmentsSeed) {
    const row = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name },
      create: { code: dept.code, name: dept.name },
    });
    ids[dept.code] = row.id;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// 2) Employees (EMPLOYEE role). Phones use the +99890111 33xx / 44xx ranges
//    reserved for this seed script (do NOT collide with +9989011122xx).
// ---------------------------------------------------------------------------
interface EmployeeSeed {
  key: string;
  fullName: string;
  phone: string;
  position: string;
  deptCode: string;
  workStartTime: string;
}

const employeesSeed: EmployeeSeed[] = [
  { key: 'aziz', fullName: 'Aziz Karimov', phone: '+998901113301', position: "Bo'lim boshlig'i", deptCode: 'IJT', workStartTime: '09:00' },
  { key: 'malika', fullName: 'Malika Yusupova', phone: '+998901113302', position: 'Bosh mutaxassis', deptCode: 'IJT', workStartTime: '09:00' },
  { key: 'sardor', fullName: 'Sardor Toshkentov', phone: '+998901113303', position: "Bo'lim boshlig'i", deptCode: 'OBD', workStartTime: '08:30' },
  { key: 'nodira', fullName: 'Nodira Rashidova', phone: '+998901113304', position: 'Yetakchi mutaxassis', deptCode: 'OBD', workStartTime: '09:00' },
  { key: 'jasur', fullName: 'Jasur Alimov', phone: '+998901113305', position: "Bo'lim boshlig'i", deptCode: 'YER', workStartTime: '09:00' },
  { key: 'gulnora', fullName: 'Gulnora Sodiqova', phone: '+998901113306', position: 'Mutaxassis', deptCode: 'YER', workStartTime: '08:30' },
  { key: 'bekzod', fullName: 'Bekzod Nortojiyev', phone: '+998901114401', position: "Bo'lim boshlig'i", deptCode: 'MUR', workStartTime: '09:00' },
  { key: 'dilnoza', fullName: 'Dilnoza Xolmatova', phone: '+998901114402', position: 'Mutaxassis', deptCode: 'MUR', workStartTime: '09:00' },
];

interface SeededEmployee {
  id: string;
  workStartTime: string;
}

async function seedEmployees(deptIds: Record<string, string>): Promise<Record<string, SeededEmployee>> {
  const out: Record<string, SeededEmployee> = {};
  for (const e of employeesSeed) {
    const row = await prisma.employee.upsert({
      where: { phone: e.phone },
      update: {
        fullName: e.fullName,
        position: e.position,
        region: REGION,
        district: DISTRICT,
        role: EmployeeRole.EMPLOYEE,
        isActive: true,
        departmentId: deptIds[e.deptCode],
        workStartTime: e.workStartTime,
      },
      create: {
        fullName: e.fullName,
        phone: e.phone,
        position: e.position,
        region: REGION,
        district: DISTRICT,
        role: EmployeeRole.EMPLOYEE,
        isActive: true,
        departmentId: deptIds[e.deptCode],
        workStartTime: e.workStartTime,
      },
    });
    out[e.key] = { id: row.id, workStartTime: row.workStartTime };
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3) Today's attendance roster:
//    5 on-time CHECK_INs, 2 LATE CHECK_INs, 2 also CHECK_OUT, 1 absent.
// ---------------------------------------------------------------------------
interface AttendancePlanEntry {
  key: string;
  absent?: boolean;
  checkIn?: { h: number; m: number; faceScore: number };
  checkOut?: { h: number; m: number; faceScore: number };
  geoDelta?: [number, number];
}

const attendancePlan: AttendancePlanEntry[] = [
  { key: 'aziz', checkIn: { h: 9, m: 2, faceScore: 0.91 }, checkOut: { h: 17, m: 52, faceScore: 0.9 }, geoDelta: [0.0002, -0.0001] },
  { key: 'malika', checkIn: { h: 9, m: 5, faceScore: 0.87 }, geoDelta: [-0.0001, 0.0002] },
  { key: 'sardor', checkIn: { h: 8, m: 27, faceScore: 0.93 }, checkOut: { h: 17, m: 58, faceScore: 0.88 }, geoDelta: [0.0003, 0.0001] },
  { key: 'nodira', checkIn: { h: 9, m: 38, faceScore: 0.84 }, geoDelta: [-0.0002, -0.0002] },
  { key: 'jasur', checkIn: { h: 8, m: 58, faceScore: 0.89 }, geoDelta: [0.0001, 0.0003] },
  { key: 'gulnora', checkIn: { h: 8, m: 31, faceScore: 0.95 }, geoDelta: [-0.0003, 0.0001] },
  { key: 'bekzod', absent: true },
  { key: 'dilnoza', checkIn: { h: 9, m: 42, faceScore: 0.82 }, geoDelta: [0.0002, 0.0002] },
];

async function seedAttendance(employees: Record<string, SeededEmployee>): Promise<number> {
  const employeeIds = attendancePlan
    .filter((p) => !p.absent)
    .map((p) => employees[p.key].id);

  // Idempotency: wipe today's rows for these employees, then recreate.
  await prisma.attendanceRecord.deleteMany({
    where: {
      employeeId: { in: employeeIds },
      recordedAt: { gte: startOfToday(), lt: startOfTomorrow() },
    },
  });

  let count = 0;
  for (const plan of attendancePlan) {
    if (plan.absent || !plan.checkIn || !plan.geoDelta) continue;
    const emp = employees[plan.key];
    const [dLat, dLng] = plan.geoDelta;
    const checkInAt = todayAt(plan.checkIn.h, plan.checkIn.m);
    const { isLate, lateMinutes } = computeLateness(emp.workStartTime, checkInAt, LATE_GRACE_MINUTES);

    await prisma.attendanceRecord.create({
      data: {
        employeeId: emp.id,
        type: AttendanceType.CHECK_IN,
        faceScore: plan.checkIn.faceScore,
        latitude: OFFICE_LAT + dLat,
        longitude: OFFICE_LNG + dLng,
        isValid: true,
        isLate,
        lateMinutes,
        recordedAt: checkInAt,
      },
    });
    count += 1;

    if (plan.checkOut) {
      const checkOutAt = todayAt(plan.checkOut.h, plan.checkOut.m);
      await prisma.attendanceRecord.create({
        data: {
          employeeId: emp.id,
          type: AttendanceType.CHECK_OUT,
          faceScore: plan.checkOut.faceScore,
          latitude: OFFICE_LAT + dLat,
          longitude: OFFICE_LNG + dLng,
          isValid: true,
          isLate: false,
          lateMinutes: 0,
          recordedAt: checkOutAt,
        },
      });
      count += 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// 4) Applications (~12), with messages / events / attachments for a subset.
// ---------------------------------------------------------------------------
interface AppEventSeed {
  idSuffix: string;
  type: ApplicationEventType;
  createdAt: Date;
  fromStatus?: ApplicationStatus;
  toStatus?: ApplicationStatus;
  toEmployeeKey?: string;
  deptCode?: string;
  actorKey?: string;
  note?: string;
}

interface AppMessageSeed {
  idSuffix: string;
  senderRole: MessageSenderRole;
  senderName: string;
  text: string;
  createdAt: Date;
}

interface AppAttachmentSeed {
  idSuffix: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface AppSeed {
  id: string;
  subject: string;
  description: string;
  applicantFullName: string;
  applicantPhone: string;
  status: ApplicationStatus;
  deptCode?: string;
  employeeKey?: string;
  createdAt: Date;
  events: AppEventSeed[];
  messages: AppMessageSeed[];
  attachment?: AppAttachmentSeed;
}

const app01Created = daysAgo(6, 9, 10);
const app02Created = daysAgo(3, 11, 0);
const app03Created = daysAgo(1, 14, 20);
const app04Created = daysAgo(4, 10, 15);
const app05Created = daysAgo(2, 16, 0);
const app06Created = daysAgo(8, 9, 40);
const app07Created = daysAgo(3, 13, 5);
const app08Created = todayAt(8, 10);
const app09Created = daysAgo(1, 9, 50);
const app10Created = daysAgo(7, 10, 0);
const app11Created = daysAgo(5, 15, 30);
const app12Created = daysAgo(6, 12, 0);
const app13Created = daysAgo(2, 10, 30);
const app14Created = daysAgo(4, 9, 0);
const app15Created = daysAgo(1, 11, 15);

const applicationsSeed: AppSeed[] = [
  {
    id: 'seed-app-01',
    subject: "Ko'cha yoritilmayapti",
    description:
      "Ko'chamizda, 12-uy oldida chiroqlar bir necha kundan beri yonmayapti. Kechqurun harakatlanish xavfli bo'lib qoldi.",
    applicantFullName: 'Robiya Nurmatova',
    applicantPhone: '+998933451087',
    status: ApplicationStatus.RESOLVED,
    deptCode: 'OBD',
    employeeKey: 'sardor',
    createdAt: app01Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app01Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app01Created, 2), toEmployeeKey: 'sardor', deptCode: 'OBD', actorKey: 'bekzod', note: "Bo'limga va mas'ul xodimga biriktirildi" },
      { idSuffix: 'evt-3', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(5, 9, 0), fromStatus: ApplicationStatus.NEW, toStatus: ApplicationStatus.IN_PROGRESS, actorKey: 'sardor' },
      { idSuffix: 'evt-4', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(4, 16, 0), fromStatus: ApplicationStatus.IN_PROGRESS, toStatus: ApplicationStatus.RESOLVED, actorKey: 'sardor', note: 'Chiroqlar taʼmirlandi' },
    ],
    messages: [
      { idSuffix: 'msg-1', senderRole: MessageSenderRole.CITIZEN, senderName: 'Robiya Nurmatova', text: 'Assalomu alaykum, koʻcha chiroqlari haligacha ishlamayapti.', createdAt: app01Created },
      { idSuffix: 'msg-2', senderRole: MessageSenderRole.EMPLOYEE, senderName: 'Sardor Toshkentov', text: "Xabaringiz uchun rahmat, ustalar jo'natildi, bugun kuni bilan ta'mirlanadi.", createdAt: daysAgo(5, 9, 30) },
      { idSuffix: 'msg-3', senderRole: MessageSenderRole.EMPLOYEE, senderName: 'Sardor Toshkentov', text: "Chiroqlar ta'mirlandi, muammo bartaraf etildi.", createdAt: daysAgo(4, 16, 5) },
    ],
  },
  {
    id: 'seed-app-02',
    subject: "Yo'lda katta chuqur paydo bo'lgan",
    description: 'Bosh koʻcha markazida asfalt yorilib, chuqur hosil boʻlgan, avtomobillar shikastlanmoqda.',
    applicantFullName: 'Otabek Yusupov',
    applicantPhone: '+998944178823',
    status: ApplicationStatus.IN_PROGRESS,
    deptCode: 'OBD',
    employeeKey: 'nodira',
    createdAt: app02Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app02Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app02Created, 3), toEmployeeKey: 'nodira', deptCode: 'OBD', actorKey: 'bekzod' },
      { idSuffix: 'evt-3', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(2, 10, 0), fromStatus: ApplicationStatus.NEW, toStatus: ApplicationStatus.IN_PROGRESS, actorKey: 'nodira' },
    ],
    messages: [
      { idSuffix: 'msg-1', senderRole: MessageSenderRole.CITIZEN, senderName: 'Otabek Yusupov', text: 'Chuqur tobora kattalashmoqda, iltimos tezroq koʻrib chiqing.', createdAt: app02Created },
      { idSuffix: 'msg-2', senderRole: MessageSenderRole.EMPLOYEE, senderName: 'Nodira Rashidova', text: "Muammo qabul qilindi, ta'mirlash brigadasi rejaga kiritildi.", createdAt: daysAgo(2, 10, 5) },
    ],
    attachment: { idSuffix: 'att-1', fileName: 'chuqurlik.jpg', mimeType: 'image/jpeg', sizeBytes: 245_000 },
  },
  {
    id: 'seed-app-03',
    subject: 'Maishiy chiqindi olib ketilmayapti',
    description: "Hovli oldidagi konteynerlar bir haftadan beri bo'shatilmayapti, atrofda noxush hid tarqalmoqda.",
    applicantFullName: 'Zarina Qodirova',
    applicantPhone: '+998951239987',
    status: ApplicationStatus.NEW,
    createdAt: app03Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app03Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
    ],
    messages: [],
  },
  {
    id: 'seed-app-04',
    subject: 'Yolgʻiz keksa fuqaro uchun ijtimoiy yordam',
    description: "Qo'shnimiz 82 yoshli yolg'iz kampir, unga oziq-ovqat va tibbiy yordam kerak.",
    applicantFullName: 'Sherzod Ergashev',
    applicantPhone: '+998972203456',
    status: ApplicationStatus.IN_PROGRESS,
    deptCode: 'IJT',
    employeeKey: 'aziz',
    createdAt: app04Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app04Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app04Created, 1), toEmployeeKey: 'aziz', deptCode: 'IJT', actorKey: 'bekzod' },
      { idSuffix: 'evt-3', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(3, 9, 0), fromStatus: ApplicationStatus.NEW, toStatus: ApplicationStatus.IN_PROGRESS, actorKey: 'aziz' },
    ],
    messages: [
      { idSuffix: 'msg-1', senderRole: MessageSenderRole.CITIZEN, senderName: 'Sherzod Ergashev', text: 'Qoʻshnimga tez yordam kerak, u yolgʻiz yashaydi.', createdAt: app04Created },
      { idSuffix: 'msg-2', senderRole: MessageSenderRole.EMPLOYEE, senderName: 'Aziz Karimov', text: 'Ijtimoiy xizmat vakili uyga tashrif buyurish uchun yuborildi.', createdAt: daysAgo(3, 9, 20) },
    ],
  },
  {
    id: 'seed-app-05',
    subject: 'Nogironlar aravachasi uchun pandus oʻrnatish',
    description: "Turar-joy bino kirish qismida pandus yo'q, nogironlar aravachasida harakatlanish mumkin emas.",
    applicantFullName: 'Madina Islomova',
    applicantPhone: '+998994455661',
    status: ApplicationStatus.NEW,
    deptCode: 'IJT',
    createdAt: app05Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app05Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app05Created, 5), deptCode: 'IJT', actorKey: 'bekzod', note: "Bo'limga yo'naltirildi" },
    ],
    messages: [],
  },
  {
    id: 'seed-app-06',
    subject: 'Yer uchastkasini rasmiylashtirish soʻrovi',
    description: 'Meros boʻyicha olingan yer uchastkasini rasmiylashtirish uchun hujjatlar taqdim etildi.',
    applicantFullName: "G'ayrat Tursunov",
    applicantPhone: '+998933009911',
    status: ApplicationStatus.RESOLVED,
    deptCode: 'YER',
    employeeKey: 'jasur',
    createdAt: app06Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app06Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app06Created, 2), toEmployeeKey: 'jasur', deptCode: 'YER', actorKey: 'bekzod' },
      { idSuffix: 'evt-3', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(7, 9, 0), fromStatus: ApplicationStatus.NEW, toStatus: ApplicationStatus.IN_PROGRESS, actorKey: 'jasur' },
      { idSuffix: 'evt-4', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(5, 11, 0), fromStatus: ApplicationStatus.IN_PROGRESS, toStatus: ApplicationStatus.RESOLVED, actorKey: 'jasur', note: 'Guvohnoma tayyor' },
    ],
    messages: [
      { idSuffix: 'msg-1', senderRole: MessageSenderRole.CITIZEN, senderName: "G'ayrat Tursunov", text: 'Hujjatlarni qachon topshirsam boʻladi?', createdAt: app06Created },
      { idSuffix: 'msg-2', senderRole: MessageSenderRole.EMPLOYEE, senderName: 'Jasur Alimov', text: "Hujjatlaringiz qabul qilindi, tekshiruvdan o'tdi.", createdAt: daysAgo(7, 9, 15) },
      { idSuffix: 'msg-3', senderRole: MessageSenderRole.EMPLOYEE, senderName: 'Jasur Alimov', text: 'Yer uchastkasi rasmiylashtirildi, guvohnoma tayyor.', createdAt: daysAgo(5, 11, 5) },
    ],
  },
  {
    id: 'seed-app-07',
    subject: 'Noqonuniy qurilish haqida shikoyat',
    description: "Qo'shni hovlida ruxsatnomasiz ikki qavatli qurilish olib borilmoqda.",
    applicantFullName: 'Feruza Abdullayeva',
    applicantPhone: '+998944521098',
    status: ApplicationStatus.IN_PROGRESS,
    deptCode: 'YER',
    employeeKey: 'gulnora',
    createdAt: app07Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app07Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app07Created, 4), toEmployeeKey: 'gulnora', deptCode: 'YER', actorKey: 'bekzod' },
      { idSuffix: 'evt-3', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(2, 9, 30), fromStatus: ApplicationStatus.NEW, toStatus: ApplicationStatus.IN_PROGRESS, actorKey: 'gulnora' },
    ],
    messages: [],
    attachment: { idSuffix: 'att-1', fileName: 'qurilish.jpg', mimeType: 'image/jpeg', sizeBytes: 312_000 },
  },
  {
    id: 'seed-app-08',
    subject: "Suv ta'minoti uzilishi",
    description: "Uch kundan beri mahallada ichimlik suvi kelmayapti, sabab noma'lum.",
    applicantFullName: "Ulug'bek Rahimov",
    applicantPhone: '+998951178822',
    status: ApplicationStatus.NEW,
    createdAt: app08Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app08Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
    ],
    messages: [],
  },
  {
    id: 'seed-app-09',
    subject: "Ma'lumot olish bo'yicha umumiy murojaat",
    description: 'Yer soligʻi boʻyicha imtiyozlar haqida toʻliq maʻlumot olishni soʻrayman.',
    applicantFullName: 'Shahnoza Yoldosheva',
    applicantPhone: '+998972231144',
    status: ApplicationStatus.NEW,
    deptCode: 'MUR',
    createdAt: app09Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app09Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app09Created, 2), deptCode: 'MUR', actorKey: 'bekzod', note: "Bo'limga yo'naltirildi" },
    ],
    messages: [],
  },
  {
    id: 'seed-app-10',
    subject: 'Hovli tozalash ishlari bajarilmadi',
    description: "So'rov bo'yicha hovli tozalash ishlari va'da qilingan sanada bajarilmadi.",
    applicantFullName: 'Davron Nazarov',
    applicantPhone: '+998994009887',
    status: ApplicationStatus.REJECTED,
    deptCode: 'OBD',
    employeeKey: 'sardor',
    createdAt: app10Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app10Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app10Created, 2), toEmployeeKey: 'sardor', deptCode: 'OBD', actorKey: 'bekzod' },
      { idSuffix: 'evt-3', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(6, 9, 0), fromStatus: ApplicationStatus.NEW, toStatus: ApplicationStatus.IN_PROGRESS, actorKey: 'sardor' },
      { idSuffix: 'evt-4', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(5, 14, 0), fromStatus: ApplicationStatus.IN_PROGRESS, toStatus: ApplicationStatus.REJECTED, actorKey: 'sardor', note: "Xususiy mulk chegarasida, vakolat doirasidan tashqarida" },
    ],
    messages: [
      { idSuffix: 'msg-1', senderRole: MessageSenderRole.CITIZEN, senderName: 'Davron Nazarov', text: 'Nega hali tozalanmadi?', createdAt: daysAgo(6, 12, 0) },
      { idSuffix: 'msg-2', senderRole: MessageSenderRole.EMPLOYEE, senderName: 'Sardor Toshkentov', text: "Ko'rib chiqildi, hovli xususiy mulk chegarasida bo'lgani uchun murojaat rad etildi.", createdAt: daysAgo(5, 14, 5) },
    ],
  },
  {
    id: 'seed-app-11',
    subject: 'Bolalar maydonchasi jihozlari buzilgan',
    description: 'Mahalla bolalar maydonchasidagi tebranma qurilmalar shikastlangan, xavfli holatda.',
    applicantFullName: 'Kamola Sattorova',
    applicantPhone: '+998933667788',
    status: ApplicationStatus.REJECTED,
    deptCode: 'OBD',
    createdAt: app11Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app11Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(4, 10, 0), fromStatus: ApplicationStatus.NEW, toStatus: ApplicationStatus.REJECTED, actorKey: 'bekzod', note: "Takroriy murojaat, avval ko'rib chiqilgan" },
    ],
    messages: [],
  },
  {
    id: 'seed-app-12',
    subject: "Ko'p qavatli uy hovlisida axlat yig'ilib qolgan",
    description: 'Uy hovlisida qurilish chiqindilari uzoq vaqtdan beri olib ketilmayapti.',
    applicantFullName: 'Anvar Xamidov',
    applicantPhone: '+998944998877',
    status: ApplicationStatus.RESOLVED,
    deptCode: 'MUR',
    employeeKey: 'dilnoza',
    createdAt: app12Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app12Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app12Created, 2), toEmployeeKey: 'dilnoza', deptCode: 'MUR', actorKey: 'bekzod' },
      { idSuffix: 'evt-3', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(5, 9, 0), fromStatus: ApplicationStatus.NEW, toStatus: ApplicationStatus.IN_PROGRESS, actorKey: 'dilnoza' },
      { idSuffix: 'evt-4', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(3, 15, 0), fromStatus: ApplicationStatus.IN_PROGRESS, toStatus: ApplicationStatus.RESOLVED, actorKey: 'dilnoza' },
    ],
    messages: [
      { idSuffix: 'msg-1', senderRole: MessageSenderRole.CITIZEN, senderName: 'Anvar Xamidov', text: 'Qurilish chiqindisi ancha vaqtdan beri turibdi.', createdAt: app12Created },
      { idSuffix: 'msg-2', senderRole: MessageSenderRole.EMPLOYEE, senderName: 'Dilnoza Xolmatova', text: 'Maxsus texnika buyurtma qilindi, chiqindilar olib ketiladi.', createdAt: daysAgo(5, 9, 20) },
      { idSuffix: 'msg-3', senderRole: MessageSenderRole.EMPLOYEE, senderName: 'Dilnoza Xolmatova', text: 'Chiqindilar olib ketildi, hovli tozalandi.', createdAt: daysAgo(3, 15, 10) },
    ],
    attachment: { idSuffix: 'att-1', fileName: 'axlat.jpg', mimeType: 'image/jpeg', sizeBytes: 198_000 },
  },
  // --- Added to make sure every seeded employee has at least one assigned
  //     murojaat (malika and bekzod had none before; nodira gets a second). ---
  {
    id: 'seed-app-13',
    subject: "Ko'p bolali oilaga moddiy yordam ko'rsatish so'ralmoqda",
    description:
      "Mahallamizda yashovchi 6 farzandli oilaning boshlig'i ishsiz qolgan, ijtimoiy yordam zarur.",
    applicantFullName: 'Zilola Ahmedova',
    applicantPhone: '+998901556677',
    status: ApplicationStatus.NEW,
    deptCode: 'IJT',
    employeeKey: 'malika',
    createdAt: app13Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app13Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app13Created, 2), toEmployeeKey: 'malika', deptCode: 'IJT', actorKey: 'bekzod' },
    ],
    messages: [
      { idSuffix: 'msg-1', senderRole: MessageSenderRole.CITIZEN, senderName: 'Zilola Ahmedova', text: "Oilaga yordam qachon ko'rib chiqiladi?", createdAt: app13Created },
    ],
  },
  {
    id: 'seed-app-14',
    subject: 'Murojaatga javob kechikkani haqida shikoyat',
    description: "Ikki hafta oldin yuborilgan murojaatimga hali ham javob kelmadi, holatni tekshirib bering.",
    applicantFullName: 'Sanjar Rustamov',
    applicantPhone: '+998977889900',
    status: ApplicationStatus.IN_PROGRESS,
    deptCode: 'MUR',
    employeeKey: 'bekzod',
    createdAt: app14Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app14Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app14Created, 1), toEmployeeKey: 'bekzod', deptCode: 'MUR', actorKey: 'bekzod', note: "Bo'lim boshlig'i shaxsan ko'rib chiqmoqda" },
      { idSuffix: 'evt-3', type: ApplicationEventType.STATUS_CHANGED, createdAt: daysAgo(3, 10, 0), fromStatus: ApplicationStatus.NEW, toStatus: ApplicationStatus.IN_PROGRESS, actorKey: 'bekzod' },
    ],
    messages: [
      { idSuffix: 'msg-1', senderRole: MessageSenderRole.CITIZEN, senderName: 'Sanjar Rustamov', text: 'Murojaatim yo\'qolib qoldimikan, javob kelmayapti.', createdAt: app14Created },
      { idSuffix: 'msg-2', senderRole: MessageSenderRole.EMPLOYEE, senderName: 'Bekzod Nortojiyev', text: "Uzr so'raymiz, holatingiz qayta ko'rib chiqilmoqda.", createdAt: daysAgo(3, 10, 10) },
    ],
  },
  {
    id: 'seed-app-15',
    subject: 'Bolalar maydonchasi atrofidagi panjara shikastlangan',
    description: "Mahalla bog'chasi yonidagi bolalar maydonchasi panjarasi buzilgan, bolalar uchun xavfli.",
    applicantFullName: 'Nilufar Qosimova',
    applicantPhone: '+998935566778',
    status: ApplicationStatus.NEW,
    deptCode: 'OBD',
    employeeKey: 'nodira',
    createdAt: app15Created,
    events: [
      { idSuffix: 'evt-1', type: ApplicationEventType.CREATED, createdAt: app15Created, toStatus: ApplicationStatus.NEW, note: "Fuqaro tomonidan yuborildi" },
      { idSuffix: 'evt-2', type: ApplicationEventType.ASSIGNED, createdAt: hoursAfter(app15Created, 2), toEmployeeKey: 'nodira', deptCode: 'OBD', actorKey: 'bekzod' },
    ],
    messages: [
      { idSuffix: 'msg-1', senderRole: MessageSenderRole.CITIZEN, senderName: 'Nilufar Qosimova', text: "Panjara tuzatilmasa, bolalar jarohat olishi mumkin.", createdAt: app15Created },
    ],
  },
];

async function seedApplications(
  deptIds: Record<string, string>,
  employees: Record<string, SeededEmployee>,
): Promise<{ apps: number; messages: number; events: number; attachments: number }> {
  let appCount = 0;
  let msgCount = 0;
  let evtCount = 0;
  let attCount = 0;

  for (const app of applicationsSeed) {
    const assignedDepartmentId = app.deptCode ? deptIds[app.deptCode] : null;
    const assignedEmployeeId = app.employeeKey ? employees[app.employeeKey].id : null;

    await prisma.application.upsert({
      where: { id: app.id },
      update: {
        subject: app.subject,
        description: app.description,
        applicantFullName: app.applicantFullName,
        applicantPhone: app.applicantPhone,
        region: REGION,
        district: DISTRICT,
        status: app.status,
        assignedEmployeeId,
        assignedDepartmentId,
      },
      create: {
        id: app.id,
        subject: app.subject,
        description: app.description,
        applicantFullName: app.applicantFullName,
        applicantPhone: app.applicantPhone,
        region: REGION,
        district: DISTRICT,
        status: app.status,
        assignedEmployeeId,
        assignedDepartmentId,
        createdAt: app.createdAt,
      },
    });
    appCount += 1;

    for (const msg of app.messages) {
      const msgId = `${app.id}-${msg.idSuffix}`;
      await prisma.applicationMessage.upsert({
        where: { id: msgId },
        update: {
          senderRole: msg.senderRole,
          senderName: msg.senderName,
          text: msg.text,
        },
        create: {
          id: msgId,
          applicationId: app.id,
          senderRole: msg.senderRole,
          senderName: msg.senderName,
          text: msg.text,
          createdAt: msg.createdAt,
        },
      });
      msgCount += 1;
    }

    for (const evt of app.events) {
      const evtId = `${app.id}-${evt.idSuffix}`;
      const toEmployeeId = evt.toEmployeeKey ? employees[evt.toEmployeeKey].id : null;
      const eventDeptId = evt.deptCode ? deptIds[evt.deptCode] : null;
      const actorEmployeeId = evt.actorKey ? employees[evt.actorKey].id : null;

      await prisma.applicationEvent.upsert({
        where: { id: evtId },
        update: {
          type: evt.type,
          fromStatus: evt.fromStatus,
          toStatus: evt.toStatus,
          toEmployeeId,
          departmentId: eventDeptId,
          actorEmployeeId,
          note: evt.note,
        },
        create: {
          id: evtId,
          applicationId: app.id,
          type: evt.type,
          fromStatus: evt.fromStatus,
          toStatus: evt.toStatus,
          toEmployeeId,
          departmentId: eventDeptId,
          actorEmployeeId,
          note: evt.note,
          createdAt: evt.createdAt,
        },
      });
      evtCount += 1;
    }

    if (app.attachment) {
      const attId = `${app.id}-${app.attachment.idSuffix}`;
      const url = `https://picsum.photos/seed/${attId}/900/600`;
      await prisma.attachment.upsert({
        where: { id: attId },
        update: {
          type: AttachmentType.PHOTO,
          url,
          fileName: app.attachment.fileName,
          mimeType: app.attachment.mimeType,
          sizeBytes: app.attachment.sizeBytes,
        },
        create: {
          id: attId,
          applicationId: app.id,
          type: AttachmentType.PHOTO,
          url,
          fileName: app.attachment.fileName,
          mimeType: app.attachment.mimeType,
          sizeBytes: app.attachment.sizeBytes,
        },
      });
      attCount += 1;
    }
  }

  return { apps: appCount, messages: msgCount, events: evtCount, attachments: attCount };
}

// ---------------------------------------------------------------------------
// 5) Employee notifications (worker-app "Bildirishnomalar" screen). Keyed by
//    employeeId on the Prisma `Notification` model. ~3-6 per seeded
//    employee, mixing NotificationType values and read/unread state, spread
//    across the last ~week so the list looks lived-in rather than freshly
//    dumped.
// ---------------------------------------------------------------------------
interface NotificationSeed {
  employeeKey: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
}

const notificationsSeed: NotificationSeed[] = [
  // --- aziz (assigned seed-app-04, IN_PROGRESS) ---
  { employeeKey: 'aziz', type: NotificationType.APPLICATION, title: 'Yangi murojaat biriktirildi', body: "\"Yolgʻiz keksa fuqaro uchun ijtimoiy yordam\" mavzusidagi murojaat sizga biriktirildi. Iltimos, ko'rib chiqing.", isRead: true, createdAt: daysAgo(4, 11, 20) },
  { employeeKey: 'aziz', type: NotificationType.ATTENDANCE, title: 'Davomat qayd etildi', body: "Bugungi kelganingiz muvaffaqiyatli qayd etildi. Kun davomida omad!", isRead: false, createdAt: todayAt(9, 3) },
  { employeeKey: 'aziz', type: NotificationType.GENERAL, title: "Apparat yig'ilishi", body: "Ertaga soat 9:00da apparat yig'ilishi bo'lib o'tadi, barcha bo'lim xodimlari qatnashishi so'raladi.", isRead: false, createdAt: daysAgo(1, 18, 0) },

  // --- malika (assigned seed-app-13, NEW) ---
  { employeeKey: 'malika', type: NotificationType.APPLICATION, title: 'Yangi murojaat biriktirildi', body: "\"Ko'p bolali oilaga moddiy yordam ko'rsatish so'ralmoqda\" mavzusidagi murojaat sizga biriktirildi. Iltimos, ko'rib chiqing.", isRead: true, createdAt: daysAgo(2, 12, 35) },
  { employeeKey: 'malika', type: NotificationType.ATTENDANCE, title: 'Davomat qayd etildi', body: "Bugungi kelganingiz muvaffaqiyatli qayd etildi. Kun davomida omad!", isRead: true, createdAt: todayAt(9, 7) },
  { employeeKey: 'malika', type: NotificationType.GENERAL, title: "Apparat yig'ilishi", body: "Ertaga soat 9:00da apparat yig'ilishi bo'lib o'tadi, barcha bo'lim xodimlari qatnashishi so'raladi.", isRead: true, createdAt: daysAgo(1, 18, 0) },

  // --- sardor (assigned seed-app-01 RESOLVED and seed-app-10 REJECTED) ---
  { employeeKey: 'sardor', type: NotificationType.APPLICATION, title: 'Yangi murojaat biriktirildi', body: "\"Ko'cha yoritilmayapti\" mavzusidagi murojaat sizga biriktirildi. Iltimos, ko'rib chiqing.", isRead: true, createdAt: daysAgo(6, 11, 15) },
  { employeeKey: 'sardor', type: NotificationType.APPLICATION, title: 'Murojaat yakunlandi', body: "\"Ko'cha yoritilmayapti\" murojaati muvaffaqiyatli yopildi va hisobotga qo'shildi.", isRead: true, createdAt: daysAgo(4, 16, 10) },
  { employeeKey: 'sardor', type: NotificationType.APPLICATION, title: 'Yangi murojaat biriktirildi', body: "\"Hovli tozalash ishlari bajarilmadi\" mavzusidagi murojaat sizga biriktirildi. Iltimos, ko'rib chiqing.", isRead: true, createdAt: daysAgo(7, 12, 5) },
  { employeeKey: 'sardor', type: NotificationType.APPLICATION, title: 'Murojaat rad etildi', body: "\"Hovli tozalash ishlari bajarilmadi\" murojaati bo'yicha qaror qabul qilindi va rad etildi sifatida yopildi.", isRead: true, createdAt: daysAgo(5, 14, 10) },
  { employeeKey: 'sardor', type: NotificationType.ATTENDANCE, title: 'Davomat qayd etildi', body: "Bugungi kelganingiz muvaffaqiyatli qayd etildi. Kun davomida omad!", isRead: false, createdAt: todayAt(8, 29) },
  { employeeKey: 'sardor', type: NotificationType.GENERAL, title: "Apparat yig'ilishi", body: "Ertaga soat 9:00da apparat yig'ilishi bo'lib o'tadi, barcha bo'lim xodimlari qatnashishi so'raladi.", isRead: false, createdAt: daysAgo(1, 18, 0) },

  // --- nodira (assigned seed-app-02 IN_PROGRESS and seed-app-15 NEW) ---
  { employeeKey: 'nodira', type: NotificationType.APPLICATION, title: 'Yangi murojaat biriktirildi', body: "\"Yo'lda katta chuqur paydo bo'lgan\" mavzusidagi murojaat sizga biriktirildi. Iltimos, ko'rib chiqing.", isRead: true, createdAt: daysAgo(3, 14, 5) },
  { employeeKey: 'nodira', type: NotificationType.APPLICATION, title: 'Yangi murojaat biriktirildi', body: "\"Bolalar maydonchasi atrofidagi panjara shikastlangan\" mavzusidagi murojaat sizga biriktirildi. Iltimos, ko'rib chiqing.", isRead: false, createdAt: daysAgo(1, 13, 20) },
  { employeeKey: 'nodira', type: NotificationType.ATTENDANCE, title: 'Kech qolish qayd etildi', body: "Bugun ish vaqtidan kech keldingiz. Iltimos, davomat tartibiga rioya qiling.", isRead: false, createdAt: todayAt(9, 40) },
  { employeeKey: 'nodira', type: NotificationType.GENERAL, title: "Apparat yig'ilishi", body: "Ertaga soat 9:00da apparat yig'ilishi bo'lib o'tadi, barcha bo'lim xodimlari qatnashishi so'raladi.", isRead: false, createdAt: daysAgo(1, 18, 0) },

  // --- jasur (assigned seed-app-06 RESOLVED) ---
  { employeeKey: 'jasur', type: NotificationType.APPLICATION, title: 'Yangi murojaat biriktirildi', body: "\"Yer uchastkasini rasmiylashtirish so'rovi\" mavzusidagi murojaat sizga biriktirildi. Iltimos, ko'rib chiqing.", isRead: true, createdAt: daysAgo(8, 11, 45) },
  { employeeKey: 'jasur', type: NotificationType.APPLICATION, title: 'Murojaat yakunlandi', body: "\"Yer uchastkasini rasmiylashtirish so'rovi\" murojaati muvaffaqiyatli yopildi va hisobotga qo'shildi.", isRead: true, createdAt: daysAgo(5, 11, 5) },
  { employeeKey: 'jasur', type: NotificationType.ATTENDANCE, title: 'Davomat qayd etildi', body: "Bugungi kelganingiz muvaffaqiyatli qayd etildi. Kun davomida omad!", isRead: true, createdAt: todayAt(9, 0) },
  { employeeKey: 'jasur', type: NotificationType.GENERAL, title: "Apparat yig'ilishi", body: "Ertaga soat 9:00da apparat yig'ilishi bo'lib o'tadi, barcha bo'lim xodimlari qatnashishi so'raladi.", isRead: true, createdAt: daysAgo(1, 18, 0) },

  // --- gulnora (assigned seed-app-07 IN_PROGRESS) ---
  { employeeKey: 'gulnora', type: NotificationType.APPLICATION, title: 'Yangi murojaat biriktirildi', body: "\"Noqonuniy qurilish haqida shikoyat\" mavzusidagi murojaat sizga biriktirildi. Iltimos, ko'rib chiqing.", isRead: true, createdAt: daysAgo(3, 17, 10) },
  { employeeKey: 'gulnora', type: NotificationType.ATTENDANCE, title: 'Davomat qayd etildi', body: "Bugungi kelganingiz muvaffaqiyatli qayd etildi. Kun davomida omad!", isRead: false, createdAt: todayAt(8, 33) },
  { employeeKey: 'gulnora', type: NotificationType.GENERAL, title: "Apparat yig'ilishi", body: "Ertaga soat 9:00da apparat yig'ilishi bo'lib o'tadi, barcha bo'lim xodimlari qatnashishi so'raladi.", isRead: false, createdAt: daysAgo(1, 18, 0) },
  { employeeKey: 'gulnora', type: NotificationType.LOCATION, title: 'Joylashuv tekshiruvi', body: "So'nggi joylashuv ma'lumotingiz eskirgan, ilovada joylashuv xizmatini yoqib qo'ying.", isRead: false, createdAt: todayAt(12, 0) },

  // --- bekzod (assigned seed-app-14 IN_PROGRESS; absent today) ---
  { employeeKey: 'bekzod', type: NotificationType.APPLICATION, title: 'Yangi murojaat biriktirildi', body: "\"Murojaatga javob kechikkani haqida shikoyat\" mavzusidagi murojaat sizga biriktirildi. Iltimos, ko'rib chiqing.", isRead: true, createdAt: daysAgo(4, 10, 5) },
  { employeeKey: 'bekzod', type: NotificationType.ATTENDANCE, title: 'Davomat belgilanmagan', body: "Bugun hali kelganingizni belgilamadingiz. Iltimos, ilova orqali davomatni tasdiqlang.", isRead: false, createdAt: todayAt(10, 0) },
  { employeeKey: 'bekzod', type: NotificationType.GENERAL, title: "Apparat yig'ilishi", body: "Ertaga soat 9:00da apparat yig'ilishi bo'lib o'tadi, barcha bo'lim xodimlari qatnashishi so'raladi.", isRead: false, createdAt: daysAgo(1, 18, 0) },
  { employeeKey: 'bekzod', type: NotificationType.LOCATION, title: 'Joylashuv aniqlanmadi', body: "Bugun joylashuvingiz aniqlanmadi. Ilovada GPS xizmatini tekshirib ko'ring.", isRead: false, createdAt: todayAt(11, 0) },

  // --- dilnoza (assigned seed-app-12 RESOLVED) ---
  { employeeKey: 'dilnoza', type: NotificationType.APPLICATION, title: 'Yangi murojaat biriktirildi', body: "\"Ko'p qavatli uy hovlisida axlat yig'ilib qolgan\" mavzusidagi murojaat sizga biriktirildi. Iltimos, ko'rib chiqing.", isRead: true, createdAt: daysAgo(6, 14, 5) },
  { employeeKey: 'dilnoza', type: NotificationType.APPLICATION, title: 'Murojaat yakunlandi', body: "\"Ko'p qavatli uy hovlisida axlat yig'ilib qolgan\" murojaati muvaffaqiyatli yopildi va hisobotga qo'shildi.", isRead: true, createdAt: daysAgo(3, 15, 5) },
  { employeeKey: 'dilnoza', type: NotificationType.ATTENDANCE, title: 'Kech qolish qayd etildi', body: "Bugun ish vaqtidan kech keldingiz. Iltimos, davomat tartibiga rioya qiling.", isRead: false, createdAt: todayAt(9, 45) },
  { employeeKey: 'dilnoza', type: NotificationType.GENERAL, title: "Apparat yig'ilishi", body: "Ertaga soat 9:00da apparat yig'ilishi bo'lib o'tadi, barcha bo'lim xodimlari qatnashishi so'raladi.", isRead: false, createdAt: daysAgo(1, 18, 0) },
];

async function seedNotifications(employees: Record<string, SeededEmployee>): Promise<number> {
  const employeeIds = Object.values(employees).map((e) => e.id);

  // Idempotency: notifications have no natural unique business key, so wipe
  // every notification belonging to these seeded employees and recreate the
  // full set fresh on every run.
  await prisma.notification.deleteMany({
    where: { employeeId: { in: employeeIds } },
  });

  await prisma.notification.createMany({
    data: notificationsSeed.map((n) => ({
      employeeId: employees[n.employeeKey].id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
  });

  return notificationsSeed.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const deptIds = await seedDepartments();
  console.log(`Departments upserted: ${Object.keys(deptIds).length}`);

  const employees = await seedEmployees(deptIds);
  console.log(`Employees upserted: ${Object.keys(employees).length}`);

  const attendanceCount = await seedAttendance(employees);
  console.log(`Attendance records (today) created: ${attendanceCount}`);

  const appStats = await seedApplications(deptIds, employees);
  console.log(
    `Applications upserted: ${appStats.apps} (messages: ${appStats.messages}, events: ${appStats.events}, attachments: ${appStats.attachments})`,
  );

  const notificationCount = await seedNotifications(employees);
  console.log(`Notifications recreated: ${notificationCount}`);

  console.log('Mobile/dashboard demo data seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
