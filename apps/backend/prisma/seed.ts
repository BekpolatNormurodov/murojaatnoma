/**
 * Comprehensive, idempotent seed for the web-admin admin domain.
 *
 * This is a SELF-CONTAINED port of the web-admin mock generators
 * (apps/web-admin/src/shared/data/mock.ts). It is intentionally NOT importing
 * that file: the backend runtime container only ships apps/backend (see the
 * Dockerfile — web-admin source is not present at runtime), so every generator,
 * constant and Uzbek string is reproduced here verbatim. Same deterministic RNG
 * seed (20260612) + same generation order => the DB ends up with the same rich,
 * realistic data the mock produces (11 districts, 14 workers, 64 murojaat,
 * 22 cameras, 66 utility rows, 12 utility/finance months, 26 documents,
 * 10 staff, 6 deputies, 18 complaints, 10 meetings, 8 news, 35 app-users,
 * 6 notifications).
 *
 * Idempotency: every row is written with upsert() keyed by its stable id, so a
 * re-run updates in place and never duplicates.
 *
 * Dry-run: `SEED_DRY_RUN=1 ts-node --transpile-only prisma/seed.ts` builds all
 * data and prints counts WITHOUT touching the database (useful with no DB).
 *
 * NOTE: the endpoints these rows back are @Public() for this TEST deployment;
 * auth-gating is a later config step.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, EmployeeRole } from '@prisma/client';

/* ============================================================
   Deterministik tasodifiy generator (mulberry32)
   ============================================================ */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260612);
const rnd = () => rng();
const randInt = (min: number, max: number) =>
  Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

type LatLng = [number, number];

interface District {
  id: string;
  name: string;
  center: LatLng;
  polygon: LatLng[];
  color: string;
  population: number;
  households: number;
  areaKm2: number;
}

function pointInPolygon(lat: number, lng: number, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0];
    const xi = poly[i][1];
    const yj = poly[j][0];
    const xj = poly[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function randomPointInDistrict(d: District): LatLng {
  for (let i = 0; i < 16; i++) {
    const lat = d.center[0] + (rnd() - 0.5) * 0.032;
    const lng = d.center[1] + (rnd() - 0.5) * 0.044;
    if (pointInPolygon(lat, lng, d.polygon)) return [lat, lng];
  }
  return [d.center[0], d.center[1]];
}

/* ============================================================
   Toshkent tumanlari (11)
   ============================================================ */
const DISTRICTS: District[] = [
  { id: 'olmazor', name: 'Olmazor', center: [41.353, 69.224], color: '#10b981', population: 352000, households: 103500, areaKm2: 36.3, polygon: [[41.398, 69.205], [41.395, 69.255], [41.362, 69.262], [41.338, 69.244], [41.33, 69.208], [41.358, 69.185], [41.382, 69.188]] },
  { id: 'yunusobod', name: 'Yunusobod', center: [41.367, 69.292], color: '#3b82f6', population: 291000, households: 85600, areaKm2: 38.5, polygon: [[41.397, 69.262], [41.402, 69.318], [41.372, 69.332], [41.345, 69.312], [41.342, 69.266], [41.366, 69.256]] },
  { id: 'mirzo', name: "Mirzo Ulug'bek", center: [41.33, 69.348], color: '#a855f7', population: 324000, households: 95300, areaKm2: 42.1, polygon: [[41.388, 69.332], [41.382, 69.398], [41.328, 69.408], [41.298, 69.378], [41.306, 69.335], [41.346, 69.314], [41.372, 69.33]] },
  { id: 'uchtepa', name: 'Uchtepa', center: [41.302, 69.178], color: '#06b6d4', population: 248000, households: 72900, areaKm2: 31.8, polygon: [[41.336, 69.15], [41.34, 69.205], [41.305, 69.216], [41.272, 69.198], [41.268, 69.15], [41.3, 69.138]] },
  { id: 'shayxontohur', name: 'Shayxontohur', center: [41.319, 69.234], color: '#ec4899', population: 281000, households: 82600, areaKm2: 26.7, polygon: [[41.338, 69.21], [41.343, 69.256], [41.312, 69.268], [41.292, 69.248], [41.298, 69.212], [41.32, 69.2]] },
  { id: 'yakkasaroy', name: 'Yakkasaroy', center: [41.288, 69.262], color: '#f59e0b', population: 121000, households: 35600, areaKm2: 11.9, polygon: [[41.308, 69.25], [41.31, 69.286], [41.282, 69.296], [41.266, 69.274], [41.27, 69.246], [41.29, 69.238]] },
  { id: 'mirobod', name: 'Mirobod', center: [41.296, 69.298], color: '#0ea5e9', population: 152000, households: 44700, areaKm2: 16.4, polygon: [[41.318, 69.286], [41.32, 69.322], [41.29, 69.332], [41.272, 69.308], [41.278, 69.282], [41.3, 69.274]] },
  { id: 'yashnobod', name: 'Yashnobod', center: [41.284, 69.342], color: '#8b5cf6', population: 274000, households: 80600, areaKm2: 36.9, polygon: [[41.306, 69.326], [41.31, 69.372], [41.275, 69.382], [41.25, 69.356], [41.258, 69.322], [41.286, 69.314]] },
  { id: 'chilonzor', name: 'Chilonzor', center: [41.273, 69.204], color: '#22c55e', population: 243000, households: 71500, areaKm2: 29.3, polygon: [[41.302, 69.182], [41.305, 69.232], [41.272, 69.244], [41.244, 69.224], [41.248, 69.18], [41.278, 69.166]] },
  { id: 'sergeli', name: 'Sergeli', center: [41.228, 69.222], color: '#eab308', population: 361000, households: 106200, areaKm2: 82.4, polygon: [[41.256, 69.196], [41.26, 69.252], [41.222, 69.266], [41.188, 69.242], [41.196, 69.194], [41.228, 69.178]] },
  { id: 'bektemir', name: 'Bektemir', center: [41.206, 69.342], color: '#f43f5e', population: 92000, households: 27100, areaKm2: 25.6, polygon: [[41.244, 69.312], [41.25, 69.372], [41.208, 69.386], [41.176, 69.358], [41.186, 69.31], [41.218, 69.298]] },
];

const HOME_DISTRICT_ID = 'mirzo';
const HOME_DISTRICT: District =
  DISTRICTS.find((d) => d.id === HOME_DISTRICT_ID) ?? DISTRICTS[0];
const regions = DISTRICTS.map((d) => d.name);

type RequestCategory = 'kommunal' | 'yol' | 'suv' | 'elektr' | 'tozalik' | 'obodonlashtirish';
type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave';

interface AttendanceDay {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  hours: number;
  insideGeofence: boolean;
  selfConfirmed: boolean;
  confirmedAt: string | null;
}

/* ============================================================
   Davomat generatori
   ============================================================ */
function buildAttendance(today: 'working' | 'finished' | 'absent') {
  const days: AttendanceDay[] = [];
  let present = 0;
  let onTime = 0;
  let workdays = 0;
  let totalHours = 0;

  for (let d = 0; d < 21; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const iso = date.toISOString().slice(0, 10);
    const dow = date.getDay();
    const weekend = dow === 0;

    let status: AttendanceStatus;
    if (weekend) {
      status = 'leave';
    } else if (d === 0) {
      status = today === 'absent' ? 'absent' : rnd() > 0.85 ? 'late' : 'present';
    } else {
      const roll = rnd();
      status = roll > 0.94 ? 'absent' : roll > 0.82 ? 'late' : 'present';
    }

    let checkIn: string | null = null;
    let checkOut: string | null = null;
    let hours = 0;
    let selfConfirmed = false;
    let confirmedAt: string | null = null;
    let insideGeofence = true;

    if (status === 'present' || status === 'late') {
      workdays += 1;
      present += 1;
      if (status === 'present') onTime += 1;
      const ciH = status === 'late' ? 9 : 8;
      const ciM = status === 'late' ? randInt(2, 58) : randInt(0, 55);
      checkIn = `${pad(ciH)}:${pad(ciM)}`;
      insideGeofence = rnd() > 0.12;
      selfConfirmed = rnd() > 0.07;
      if (selfConfirmed) {
        const cM = Math.min(ciM + randInt(1, 6), 59);
        confirmedAt = `${pad(ciH)}:${pad(cM)}`;
      }
      if (d === 0 && today === 'working') {
        checkOut = null;
        hours = 0;
      } else {
        const coH = randInt(17, 18);
        const coM = randInt(8, 56);
        checkOut = `${pad(coH)}:${pad(coM)}`;
        hours = Math.round(((coH * 60 + coM - (ciH * 60 + ciM)) / 60) * 10) / 10;
        totalHours += hours;
      }
    } else if (status === 'absent') {
      if (d !== 0) workdays += 1;
    }

    days.push({ date: iso, checkIn, checkOut, status, hours, insideGeofence, selfConfirmed, confirmedAt });
  }

  const t = days[0];
  return {
    attendance: days,
    checkInTime: t.checkIn,
    checkOutTime: t.checkOut,
    todayConfirmed: t.selfConfirmed,
    attendanceRate: Math.round((present / Math.max(workdays, 1)) * 100),
    onTimeRate: Math.round((onTime / Math.max(present, 1)) * 100),
    monthlyHours: Math.round(totalHours * 1.45),
  };
}

function buildWorkerDocs(seed: number) {
  const base: { name: string; type: string }[] = [
    { name: 'Passport nusxasi', type: 'passport' },
    { name: 'Mehnat shartnomasi', type: 'contract' },
    { name: 'Malaka sertifikati', type: 'certificate' },
    { name: 'Haydovchilik guvohnomasi', type: 'license' },
    { name: "Tibbiy ko'rik xulosasi", type: 'medical' },
  ];
  return base.map((b, i) => {
    const roll = (seed + i) % 10;
    const status = roll > 8 ? 'expired' : roll > 6 ? 'expiring' : 'valid';
    const up = new Date();
    up.setMonth(up.getMonth() - randInt(2, 22));
    const ex = new Date();
    ex.setMonth(ex.getMonth() + (status === 'expired' ? -1 : randInt(1, 18)));
    return {
      id: `doc-${seed}-${i}`,
      name: b.name,
      type: b.type,
      status,
      uploadedAt: up.toISOString(),
      expiresAt: b.type === 'passport' ? undefined : ex.toISOString(),
    };
  });
}

/* ============================================================
   Ishchilar (Workers) — 14 ta
   ============================================================ */
const WORKER_SEED: {
  name: string; photo: string; color: string; position: string;
  districtId: string; spec: RequestCategory[]; status: string;
  rating: number; vehicle: string | null;
}[] = [
  { name: 'Akmal Karimov', photo: 'https://randomuser.me/api/portraits/men/32.jpg', color: '#10b981', position: "Avariya brigadasi boshlig'i", districtId: 'chilonzor', spec: ['kommunal', 'suv'], status: 'on_task', rating: 4.8, vehicle: 'GAZ-3302 · 01 A 234 BC' },
  { name: 'Dilnoza Yusupova', photo: 'https://randomuser.me/api/portraits/women/44.jpg', color: '#3b82f6', position: 'Obodonlashtirish ustasi', districtId: 'yunusobod', spec: ['obodonlashtirish', 'tozalik'], status: 'online', rating: 4.6, vehicle: null },
  { name: 'Sardor Aliyev', photo: 'https://randomuser.me/api/portraits/men/45.jpg', color: '#f59e0b', position: 'Elektromontyor', districtId: 'mirzo', spec: ['elektr'], status: 'on_task', rating: 4.2, vehicle: 'Chevrolet Damas · 01 B 815 KX' },
  { name: 'Nodira Rashidova', photo: 'https://randomuser.me/api/portraits/women/68.jpg', color: '#a855f7', position: 'Hudud nazoratchisi', districtId: 'shayxontohur', spec: ['tozalik', 'obodonlashtirish'], status: 'offline', rating: 4.9, vehicle: null },
  { name: 'Jasur Tursunov', photo: 'https://randomuser.me/api/portraits/men/12.jpg', color: '#ef4444', position: 'Santexnik usta', districtId: 'sergeli', spec: ['suv', 'kommunal'], status: 'on_task', rating: 4.4, vehicle: 'GAZ-3302 · 01 C 102 MN' },
  { name: 'Madina Olimova', photo: 'https://randomuser.me/api/portraits/women/65.jpg', color: '#06b6d4', position: "Yo'l xizmati mutaxassisi", districtId: 'yakkasaroy', spec: ['yol'], status: 'online', rating: 4.7, vehicle: null },
  { name: 'Bobur Saidov', photo: 'https://randomuser.me/api/portraits/men/76.jpg', color: '#0ea5e9', position: 'Dala mutaxassisi', districtId: 'olmazor', spec: ['kommunal', 'elektr'], status: 'break', rating: 4.5, vehicle: 'Chevrolet Damas · 01 D 447 PR' },
  { name: 'Zarina Halimova', photo: 'https://randomuser.me/api/portraits/women/12.jpg', color: '#8b5cf6', position: 'Tozalik xizmati nazoratchisi', districtId: 'uchtepa', spec: ['tozalik'], status: 'on_task', rating: 4.3, vehicle: null },
  { name: 'Otabek Nazarov', photo: 'https://randomuser.me/api/portraits/men/22.jpg', color: '#22c55e', position: 'Katta usta', districtId: 'mirobod', spec: ['yol', 'obodonlashtirish'], status: 'online', rating: 4.85, vehicle: 'GAZ-3302 · 01 E 901 TX' },
  { name: 'Gulbahor Karimova', photo: 'https://randomuser.me/api/portraits/women/33.jpg', color: '#ec4899', position: "Suv ta'minoti mutaxassisi", districtId: 'yashnobod', spec: ['suv'], status: 'online', rating: 4.65, vehicle: null },
  { name: 'Sherzod Mirzaev', photo: 'https://randomuser.me/api/portraits/men/55.jpg', color: '#f43f5e', position: 'Elektr tarmoq ustasi', districtId: 'bektemir', spec: ['elektr', 'kommunal'], status: 'offline', rating: 4.1, vehicle: 'Chevrolet Damas · 01 F 318 QQ' },
  { name: 'Malika Yusupova', photo: 'https://randomuser.me/api/portraits/women/21.jpg', color: '#14b8a6', position: 'Obodonlashtirish brigadasi', districtId: 'chilonzor', spec: ['obodonlashtirish', 'tozalik'], status: 'on_task', rating: 4.55, vehicle: null },
  { name: "Ulug'bek Tashpulatov", photo: 'https://randomuser.me/api/portraits/men/85.jpg', color: '#eab308', position: "Yo'l-ko'prik ustasi", districtId: 'yunusobod', spec: ['yol'], status: 'online', rating: 4.72, vehicle: 'GAZ-3302 · 01 G 555 AB' },
  { name: 'Sevinch Abdullayeva', photo: 'https://randomuser.me/api/portraits/women/90.jpg', color: '#6366f1', position: 'Hudud koordinatori', districtId: 'mirzo', spec: ['kommunal', 'suv', 'elektr'], status: 'online', rating: 4.9, vehicle: null },
];

const WORKERS = WORKER_SEED.map((s, i) => {
  const district = HOME_DISTRICT;
  const forceOutside = i % 6 === 4;
  const latSpread = forceOutside ? 0.05 : 0.024;
  const lat = district.center[0] + (rnd() - 0.5) * latSpread;
  const lngJitter = (rnd() - 0.5) * 0.036;
  const lng = forceOutside ? district.center[1] + 0.066 : district.center[1] + lngJitter;
  const insideRegion = pointInPolygon(lat, lng, district.polygon);

  const todayMode =
    s.status === 'offline' ? (rnd() > 0.25 ? 'finished' : 'absent') : 'working';
  const att = buildAttendance(todayMode as any);

  const hired = new Date();
  hired.setMonth(hired.getMonth() - randInt(8, 60));

  return {
    id: `w${i + 1}`,
    name: s.name,
    photo: s.photo,
    avatarColor: s.color,
    position: s.position,
    region: district.name,
    districtId: district.id,
    phone: `+998 ${pick(['90', '91', '93', '94', '97', '99'])} ${randInt(100, 999)} ${pad(randInt(0, 99))} ${pad(randInt(0, 99))}`,
    email: `${s.name.toLowerCase().replace(/[^a-z]/g, '.').replace(/\.+/g, '.')}@hokimiyat.uz`,
    specialization: s.spec,
    status: s.status,
    insideRegion,
    rating: s.rating,
    points: 600 + randInt(0, 18) * 55 + Math.round(s.rating * 110),
    completedTasks: randInt(64, 214),
    activeTasks: s.status === 'offline' ? 0 : randInt(0, 5),
    lat,
    lng,
    hiredAt: hired.toISOString(),
    ...att,
    salary: randInt(38, 62) * 100000,
    bonus: randInt(0, 18) * 50000,
    vehicle: s.vehicle,
    documents: buildWorkerDocs(i + 3),
  };
});

/* ============================================================
   Murojaatlar (Requests) — 64 ta
   ============================================================ */
const TITLES: Record<RequestCategory, string[]> = {
  kommunal: ['Issiqlik kelmayapti', 'Lift ishlamayapti', 'Подъезд yoritilmagan', 'Tom oqyapti', "Eshik dovog'i buzilgan"],
  yol: ["Yo'lda chuqur paydo bo'ldi", 'Svetofor ishlamayapti', "Yo'l belgisi yo'q", "Piyodalar o'tish joyi o'chgan", 'Bordyur buzilgan'],
  suv: ['Ichimlik suvi kelmayapti', 'Quvur yorilgan', 'Hovli suv bosgan', 'Suv bosimi past', 'Kanalizatsiya tiqilgan'],
  elektr: ["Elektr o'chib qoldi", 'Sim uzilgan', 'Transformator nosoz', "Ko'cha chiroqlari o'chgan", 'Hisoblagich buzilgan'],
  tozalik: ['Axlat olib ketilmagan', "Konteyner to'lib ketgan", 'Hudud ifloslangan', 'Stixiyali axlatxona', 'Konteyner singan'],
  obodonlashtirish: ['Skameyka singan', 'Daraxt qulagan', 'Bolalar maydonchasi buzuq', 'Park yoritilmagan', 'Gulzor parvarishsiz'],
};

const ADDRESSES = ['1-mavze, 12-uy', "Bunyodkor shoh ko'chasi 24", 'Mustaqillik mahallasi 7', "Navoiy ko'chasi 105", "Bobur ko'chasi 56", 'Amir Temur xiyoboni 3', 'Yangihayot MFY 18-uy', 'Guliston mavzesi 41', "Qatortol ko'chasi 88", 'Olmazor MFY 9-uy'];

const CITIZENS: { name: string; gender: 'men' | 'women'; n: number }[] = [
  { name: "Olim Yo'ldoshev", gender: 'men', n: 11 },
  { name: 'Gulnora Aliyeva', gender: 'women', n: 24 },
  { name: 'Bekzod Qodirov', gender: 'men', n: 36 },
  { name: 'Sevara Nazarova', gender: 'women', n: 47 },
  { name: 'Rustam Ibragimov', gender: 'men', n: 51 },
  { name: 'Kamola Saidova', gender: 'women', n: 58 },
  { name: 'Aziz Mahmudov', gender: 'men', n: 64 },
  { name: 'Feruza Tosheva', gender: 'women', n: 72 },
  { name: 'Shuhrat Ergashev', gender: 'men', n: 78 },
  { name: 'Nigora Komilova', gender: 'women', n: 81 },
  { name: 'Davron Sobirov', gender: 'men', n: 91 },
  { name: 'Dilfuza Rasulova', gender: 'women', n: 9 },
];

const REQUEST_PHOTOS = [
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&q=70',
  'https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=400&q=70',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=70',
];

const categories = Object.keys(TITLES) as RequestCategory[];
const statuses = ['new', 'in_progress', 'resolved', 'resolved', 'rejected'];

const REQUESTS = Array.from({ length: 64 }).map((_, i) => {
  const category = pick(categories);
  const status = pick(statuses);
  const district = pick(DISTRICTS);
  const citizen = pick(CITIZENS);
  const daysAgo =
    status === 'new' ? randInt(0, 5) : status === 'in_progress' ? randInt(2, 30) : randInt(0, 45);
  const created = new Date();
  created.setDate(created.getDate() - daysAgo);
  created.setHours(randInt(7, 21), randInt(0, 59));

  const resolved = status === 'resolved' || status === 'rejected';
  const responseHours = resolved ? randInt(1, 72) : null;
  const resolvedAt = resolved
    ? new Date(created.getTime() + (responseHours ?? 0) * 3600_000).toISOString()
    : null;
  const [lat, lng] = randomPointInDistrict(district);
  const districtWorkers = WORKERS.filter((w) => w.districtId === district.id);
  const assignedWorkerId =
    status === 'new' ? null : (districtWorkers.length ? pick(districtWorkers) : pick(WORKERS)).id;

  return {
    id: `R-${1000 + i}`,
    title: pick(TITLES[category]),
    description:
      "Fuqaro tomonidan yuborilgan murojaat. Hokimiyat mas'ul xodimi tomonidan ko'rib chiqilmoqda va tegishli brigadaga biriktirildi.",
    category,
    status,
    region: district.name,
    districtId: district.id,
    address: `${district.name}, ${pick(ADDRESSES)}`,
    citizenName: citizen.name,
    citizenPhone: `+998 ${pick(['90', '91', '93', '97', '99'])} ${randInt(100, 999)} ${pad(randInt(0, 99))} ${pad(randInt(0, 99))}`,
    citizenPhoto: `https://randomuser.me/api/portraits/${citizen.gender}/${citizen.n}.jpg`,
    createdAt: created.toISOString(),
    resolvedAt,
    assignedWorkerId,
    priority: pick(['low', 'medium', 'high', 'medium']),
    lat,
    lng,
    photos: rnd() > 0.4 ? REQUEST_PHOTOS.slice(0, randInt(1, 3)) : [],
    responseHours,
    feedback: status === 'resolved' ? randInt(3, 5) : null,
    cost: resolved ? randInt(2, 48) * 50000 : 0,
  };
});

/* ============================================================
   Kameralar (CCTV) — 22 ta
   ============================================================ */
const CAM_TYPES = ['fixed', 'ptz', 'anpr', 'thermal'];
const CAM_PLACES = ['chorrahasi', 'bekati', 'maydoni', 'kirish darvozasi', "markaziy ko'chasi", 'bozori', 'parki', "ko'prigi"];

const CAMERAS = Array.from({ length: 22 }).map((_, i) => {
  const district = DISTRICTS[i % DISTRICTS.length];
  const [lat, lng] = randomPointInDistrict(district);
  const roll = rnd();
  const status = roll > 0.88 ? 'offline' : roll > 0.8 ? 'maintenance' : 'online';
  const installed = new Date();
  installed.setMonth(installed.getMonth() - randInt(3, 40));
  const online = status === 'online';
  return {
    id: `CAM-${pad(i + 1)}`,
    name: `${district.name} ${pick(CAM_PLACES)}`,
    region: district.name,
    districtId: district.id,
    type: pick(CAM_TYPES),
    status,
    lat,
    lng,
    resolution: pick(['4K', '1080p', '1080p', '2K']),
    recording: online,
    uptime: online ? 95 + Math.round(rnd() * 49) / 10 : randInt(40, 88),
    detections24h: online ? randInt(8, 420) : 0,
    lastEvent: online
      ? `${randInt(1, 59)} daqiqa oldin`
      : status === 'maintenance'
        ? 'Texnik xizmatda'
        : 'Aloqa uzilgan',
    installedAt: installed.toISOString(),
  };
});

/* ============================================================
   Kommunal to'lovlar — tuman × tur (66)
   ============================================================ */
const UTILITY_TYPES = ['suv', 'gaz', 'elektr', 'issiqlik', 'tozalik', 'internet'] as const;
const PERIOD = '2026-05';

const UTILITY_PAYMENTS = DISTRICTS.flatMap((d) =>
  UTILITY_TYPES.map((type) => {
    const perHousehold: Record<string, number> = { suv: 38000, gaz: 62000, elektr: 74000, issiqlik: 52000, tozalik: 18000, internet: 45000 };
    const coverage = type === 'internet' ? 0.62 : type === 'issiqlik' ? 0.78 : 0.96;
    const households = Math.round(d.households * coverage);
    const charged = households * perHousehold[type];
    const rate = 82 + rnd() * 16;
    const collected = Math.round((charged * rate) / 100);
    return {
      id: `${d.id}-${type}`,
      type,
      region: d.name,
      districtId: d.id,
      period: PERIOD,
      charged,
      collected,
      debt: charged - collected,
      households,
      collectionRate: Math.round(rate * 10) / 10,
    };
  }),
);

const MONTHS = ['Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek', 'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn'];

const UTILITY_MONTHLY = MONTHS.map((month, i) => {
  const heatSeason = [0.2, 0.3, 0.6, 0.9, 1.3, 1.6, 1.7, 1.5, 1.0, 0.5, 0.25, 0.15][i];
  return {
    month,
    suv: randInt(2400, 3200) * 1_000_000,
    gaz: Math.round((randInt(3200, 4400) + heatSeason * 600) * 1_000_000),
    elektr: randInt(4200, 5600) * 1_000_000,
    issiqlik: Math.round((900 + heatSeason * 2600) * 1_000_000),
    tozalik: randInt(900, 1300) * 1_000_000,
    internet: randInt(1600, 2200) * 1_000_000,
  };
});

/* ============================================================
   Moliya / aylanma (12)
   ============================================================ */
const FINANCE_MONTHLY = MONTHS.map((month) => {
  const budget = randInt(19, 26) * 1_000_000_000;
  const spent = Math.round(budget * (0.78 + rnd() * 0.17));
  const collected = randInt(13, 21) * 1_000_000_000;
  return { month, budget, spent, collected, turnover: spent + collected };
});

/* ============================================================
   Hujjatlar (26)
   ============================================================ */
const DOC_TYPES = ['qaror', 'buyruq', 'hisobot', 'shartnoma', 'ariza', 'dalolatnoma'];
const DOC_STATUS = ['draft', 'review', 'signed', 'signed', 'archived'];
const DOC_TITLES: Record<string, string[]> = {
  qaror: ["Obodonlashtirish bo'yicha qaror", "Byudjet taqsimoti to'g'risida qaror", "Yangi kameralar o'rnatish qarori"],
  buyruq: ["Xodimlarni rag'batlantirish buyrug'i", "Navbatchilik jadvali buyrug'i", 'Tozalik tadbiri buyrug\'i'],
  hisobot: ['Oylik murojaatlar hisoboti', "Kommunal to'lovlar hisoboti", 'Davomat tahlili hisoboti', 'Kvartal moliyaviy hisobot'],
  shartnoma: ["Ta'minot shartnomasi", 'Pudrat ishlari shartnomasi', 'Texnik xizmat shartnomasi'],
  ariza: ['Fuqaro arizasi (suv)', 'Korxona arizasi', 'Mahalla arizasi'],
  dalolatnoma: ['Bajarilgan ishlar dalolatnomasi', 'Avariya dalolatnomasi', 'Tekshiruv dalolatnomasi'],
};
const DOC_AUTHORS = ['A. Hokimov', 'D. Yusupova', 'S. Alimov', 'N. Karimova', 'B. Rustamov', 'M. Tosheva'];
const DOC_CODE: Record<string, string> = { qaror: 'QR', buyruq: 'BY', hisobot: 'HS', shartnoma: 'SH', ariza: 'AR', dalolatnoma: 'DL' };

const DOCUMENTS = Array.from({ length: 26 }).map((_, i) => {
  const type = pick(DOC_TYPES);
  const created = new Date();
  created.setDate(created.getDate() - randInt(0, 120));
  return {
    id: `D-${i + 1}`,
    code: `${DOC_CODE[type]}-2026/${pad(randInt(10, 320))}`,
    title: pick(DOC_TITLES[type]),
    type,
    status: pick(DOC_STATUS),
    author: pick(DOC_AUTHORS),
    region: pick(['Barcha tumanlar', ...regions]),
    createdAt: created.toISOString(),
    sizeKb: randInt(64, 4800),
    pages: randInt(1, 32),
  };
});

/* ---- RNG alignment: mock consumes rng for REGION_STATS + HOURLY_ACTIVITY
   here (aggregates we don't persist). Reproduce the draws in the same order so
   the staff/deputy/complaint/etc. data downstream lines up with the mock. ---- */
for (const _d of DISTRICTS) {
  randInt(18, 42);
  randInt(14, 30);
}
for (let h = 0; h < 24; h++) rnd();

/* ============================================================
   Xodimlar (Staff) — 10 ta
   ============================================================ */
const ALL_MODULES = ['dashboard', 'requests', 'map', 'workers', 'attendance', 'staff', 'cameras', 'finance', 'analytics', 'documents', 'news', 'settings'];
const ROLE_DEFAULTS: Record<string, string[]> = {
  hokim: [...ALL_MODULES],
  hokim_yordamchisi: ['dashboard', 'requests', 'map', 'workers', 'attendance', 'cameras', 'finance', 'analytics', 'documents', 'news'],
  bolim_boshligi: ['dashboard', 'requests', 'workers', 'attendance', 'documents', 'analytics'],
  operator: ['dashboard', 'requests', 'map', 'news'],
  nazoratchi: ['dashboard', 'map', 'cameras', 'attendance'],
  ishchi: ['dashboard', 'requests'],
};
const ROLE_RANK: Record<string, number> = { hokim: 1, hokim_yordamchisi: 2, bolim_boshligi: 3, operator: 4, nazoratchi: 4, ishchi: 5 };

function buildSchedule(role: string) {
  if (role === 'nazoratchi') return { start: '08:00', end: '20:00', days: [1, 2, 3, 4, 5, 6] };
  if (role === 'ishchi') return { start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5, 6] };
  return { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };
}

const STAFF_SEED: { name: string; photo: string; color: string; role: string; position: string; department: string; status: string }[] = [
  { name: 'Akmal Hokimov', photo: 'https://randomuser.me/api/portraits/men/32.jpg', color: '#7c3aed', role: 'hokim', position: 'Tuman hokimi', department: 'Hokim apparati', status: 'active' },
  { name: "Dilshod Yo'ldoshev", photo: 'https://randomuser.me/api/portraits/men/45.jpg', color: '#2563eb', role: 'hokim_yordamchisi', position: "Hokimning birinchi o'rinbosari", department: 'Hokim apparati', status: 'active' },
  { name: 'Nilufar Karimova', photo: 'https://randomuser.me/api/portraits/women/44.jpg', color: '#3b82f6', role: 'hokim_yordamchisi', position: 'Hokim yordamchisi (ijtimoiy)', department: 'Ijtimoiy soha', status: 'active' },
  { name: 'Sardor Aliyev', photo: 'https://randomuser.me/api/portraits/men/22.jpg', color: '#0891b2', role: 'bolim_boshligi', position: "Obodonlashtirish bo'limi boshlig'i", department: 'Obodonlashtirish', status: 'active' },
  { name: "Gulnora To'xtayeva", photo: 'https://randomuser.me/api/portraits/women/68.jpg', color: '#0d9488', role: 'bolim_boshligi', position: "Moliya bo'limi boshlig'i", department: 'Moliya', status: 'active' },
  { name: 'Jasur Rahimov', photo: 'https://randomuser.me/api/portraits/men/51.jpg', color: '#059669', role: 'operator', position: 'Murojaatlar operatori', department: 'Call-markaz', status: 'active' },
  { name: 'Madina Yusupova', photo: 'https://randomuser.me/api/portraits/women/29.jpg', color: '#16a34a', role: 'operator', position: 'Murojaatlar operatori', department: 'Call-markaz', status: 'active' },
  { name: 'Bekzod Ergashev', photo: 'https://randomuser.me/api/portraits/men/76.jpg', color: '#d97706', role: 'nazoratchi', position: 'Video kuzatuv nazoratchisi', department: 'Monitoring markazi', status: 'active' },
  { name: 'Shahnoza Mirzayeva', photo: 'https://randomuser.me/api/portraits/women/12.jpg', color: '#ea580c', role: 'nazoratchi', position: 'Davomat nazoratchisi', department: "Kadrlar bo'limi", status: 'inactive' },
  { name: 'Otabek Sultonov', photo: 'https://randomuser.me/api/portraits/men/3.jpg', color: '#64748b', role: 'operator', position: "Hujjatlar bo'yicha mutaxassis", department: 'Devonxona', status: 'suspended' },
];

const STAFF = STAFF_SEED.map((s, i) => {
  const created = new Date();
  created.setMonth(created.getMonth() - randInt(6, 48));
  const last = new Date();
  last.setHours(last.getHours() - randInt(0, 72));
  const loginBase = s.name.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');
  return {
    id: `s${i + 1}`,
    name: s.name,
    photo: s.photo,
    avatarColor: s.color,
    role: s.role,
    position: s.position,
    department: s.department,
    email: `${loginBase}@hokimiyat.uz`,
    phone: `+998 ${pick(['90', '91', '93', '97', '99'])} ${randInt(100, 999)} ${pad(randInt(0, 99))} ${pad(randInt(0, 99))}`,
    login: `${loginBase}.${s.role === 'hokim' ? 'admin' : s.role.slice(0, 3)}`,
    status: s.status,
    permissions: [...ROLE_DEFAULTS[s.role]],
    schedule: buildSchedule(s.role),
    lastLogin: s.status === 'suspended' ? null : last.toISOString(),
    createdAt: created.toISOString(),
    twoFactor: ROLE_RANK[s.role] <= 2,
  };
});

/* ============================================================
   Hokim o'rinbosarlari (Deputies) — 6 ta
   ============================================================ */
const DEPUTY_SEED: {
  id: string; name: string; photo: string; color: string; position: string;
  direction: string; shortDirection: string; categories: RequestCategory[];
  topics: string[]; office: string; receptionDay: string;
}[] = [
  { id: 'd1', name: "Dilshod Yo'ldoshev", photo: 'https://randomuser.me/api/portraits/men/45.jpg', color: '#7c3aed', position: "Hokimning birinchi o'rinbosari", direction: "Qurilish, kommunal xo'jalik va energetika", shortDirection: 'Qurilish va kommunal', categories: ['kommunal', 'elektr'], topics: ["Issiqlik ta'minoti", 'Lift va umumiy hududlar', 'Elektr uzilishlari', "Ko'p qavatli uylar"], office: '204-xona', receptionDay: 'Dushanba, 15:00–17:00' },
  { id: 'd2', name: 'Aziz Tursunov', photo: 'https://randomuser.me/api/portraits/men/85.jpg', color: '#06b6d4', position: "Hokim o'rinbosari", direction: "Suv ta'minoti va kanalizatsiya", shortDirection: 'Suv va kanalizatsiya', categories: ['suv'], topics: ['Ichimlik suvi', 'Kanalizatsiya tizimi', 'Suv bosishi', 'Quvur avariyalari'], office: '208-xona', receptionDay: 'Seshanba, 15:00–17:00' },
  { id: 'd3', name: 'Bobur Qodirov', photo: 'https://randomuser.me/api/portraits/men/76.jpg', color: '#f59e0b', position: "Hokim o'rinbosari", direction: "Yo'l-transport infratuzilmasi", shortDirection: "Yo'l va transport", categories: ['yol'], topics: ["Yo'l qoplamasi", "Ko'cha yoritilishi", 'Jamoat transporti', "Yo'laklar"], office: '211-xona', receptionDay: 'Chorshanba, 15:00–17:00' },
  { id: 'd4', name: 'Nilufar Karimova', photo: 'https://randomuser.me/api/portraits/women/44.jpg', color: '#10b981', position: "Hokim o'rinbosari", direction: 'Obodonlashtirish, ekologiya va tozalik', shortDirection: 'Obodonlashtirish', categories: ['obodonlashtirish', 'tozalik'], topics: ['Maishiy chiqindi', "Ko'kalamzorlashtirish", 'Hovli obodonligi', 'Sanitariya'], office: '215-xona', receptionDay: 'Payshanba, 15:00–17:00' },
  { id: 'd5', name: 'Gulnora Saidova', photo: 'https://randomuser.me/api/portraits/women/65.jpg', color: '#ec4899', position: "Hokim o'rinbosari", direction: "Ijtimoiy soha, ta'lim va sog'liqni saqlash", shortDirection: 'Ijtimoiy soha', categories: [], topics: ["Maktab va bog'cha", 'Tibbiy xizmat', 'Ijtimoiy himoya', 'Yoshlar bilan ishlash'], office: '302-xona', receptionDay: 'Juma, 14:00–16:00' },
  { id: 'd6', name: 'Jamshid Rahmonov', photo: 'https://randomuser.me/api/portraits/men/22.jpg', color: '#2563eb', position: "Hokim o'rinbosari", direction: 'Iqtisodiyot, investitsiya va tadbirkorlik', shortDirection: 'Iqtisodiyot va investitsiya', categories: [], topics: ["Tadbirkorlik to'siqlari", 'Bozor va savdo', 'Ijara va yer', 'Investitsiya loyihalari'], office: '305-xona', receptionDay: 'Juma, 16:00–18:00' },
];

const DEPUTIES = DEPUTY_SEED.map((s) => {
  const loginBase = s.name.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');
  return {
    ...s,
    phone: `+998 ${pick(['90', '91', '93', '97', '99'])} ${randInt(100, 999)} ${pad(randInt(0, 99))} ${pad(randInt(0, 99))}`,
    email: `${loginBase}@hokimiyat.uz`,
  };
});

/* ============================================================
   Shikoyatlar (Complaints) — 18 ta
   ============================================================ */
const COMPLAINTS = Array.from({ length: 18 }).map((_, i) => {
  const deputy = DEPUTIES[i % DEPUTIES.length];
  const topic = pick(deputy.topics);
  const district = rnd() > 0.5 ? HOME_DISTRICT : pick(DISTRICTS);
  const citizen = pick(CITIZENS);
  const severity = pick(['low', 'medium', 'high', 'medium', 'high']);
  const status = pick(['new', 'reviewing', 'reviewing', 'resolved', 'resolved', 'rejected']);
  const daysAgo = randInt(0, 30);
  const created = new Date();
  created.setDate(created.getDate() - daysAgo);
  created.setHours(randInt(8, 19), randInt(0, 59));
  const slaDays = severity === 'high' ? 3 : severity === 'medium' ? 7 : 15;
  const deadline = new Date(created.getTime() + slaDays * 86400_000);
  const done = status === 'resolved' || status === 'rejected';
  const resolvedAt = done
    ? new Date(created.getTime() + randInt(1, slaDays) * 86400_000).toISOString()
    : null;
  return {
    id: `SH-${2000 + i}`,
    title: `${topic} bo'yicha shikoyat`,
    description:
      "Fuqaro avval yuborgan murojaatidan natija bo'lmagani sababli rasmiy shikoyat bilan murojaat qildi. Mas'ul hokim o'rinbosari shaxsiy nazoratiga olindi.",
    topic,
    severity,
    status,
    districtId: district.id,
    region: district.name,
    address: `${district.name}, ${pick(ADDRESSES)}`,
    citizenName: citizen.name,
    citizenPhone: `+998 ${pick(['90', '91', '93', '97', '99'])} ${randInt(100, 999)} ${pad(randInt(0, 99))} ${pad(randInt(0, 99))}`,
    citizenPhoto: `https://randomuser.me/api/portraits/${citizen.gender}/${citizen.n}.jpg`,
    createdAt: created.toISOString(),
    deadlineAt: deadline.toISOString(),
    resolvedAt,
    deputyId: deputy.id,
    isRepeat: rnd() > 0.45,
    escalated: severity === 'high' && rnd() > 0.4,
    responses: done
      ? [{ id: `${2000 + i}-r1`, author: deputy.name, text: "Shikoyatingiz bo'yicha tegishli xizmatlarga ko'rsatma berildi, hududda ko'rik o'tkazilib, kamchilik bartaraf etildi.", createdAt: new Date(created.getTime() + randInt(1, Math.max(2, slaDays)) * 43200_000).toISOString() }]
      : status === 'reviewing'
        ? [{ id: `${2000 + i}-r1`, author: deputy.name, text: "Shikoyat qabul qilindi va ko'rib chiqilmoqda. Mas'ul xodimlar hududga yo'naltirildi.", createdAt: new Date(created.getTime() + randInt(6, 36) * 3600_000).toISOString() }]
        : [],
  };
});

/* ============================================================
   Yig'ilishlar (Meetings) — 10 ta
   ============================================================ */
const MEETING_TITLES: Record<string, string[]> = {
  apparat: ["Haftalik apparat yig'ilishi", "Oylik yakuniy apparat yig'ilishi"],
  qabul: ['Fuqarolarning ochiq qabuli', 'Sayyor qabul — mahallada'],
  shtab: ['Qishki mavsumga tayyorgarlik shtabi', 'Obodonlashtirish shtabi', 'Favqulodda holatlar shtabi'],
  video: ['Viloyat hokimligi bilan video selektor', 'Tuman rahbarlari video selektori'],
  hashar: ['Umumtuman hasharga tayyorgarlik', "Ko'kalamzorlashtirish tadbiri"],
};
const MEETING_LOCATIONS = ['Hokimiyat katta majlislar zali', "2-qavat yig'ilishlar xonasi", 'Video selektor xonasi', "Mirzo Ulug'bek tumani markaziy maydoni"];
const MEETING_AGENDA_GENERAL = ['Murojaatlar va shikoyatlar tahlili', 'Ijro intizomi va topshiriqlar nazorati', 'Hududlardagi joriy vaziyat', 'Aholi bilan ishlash natijalari'];

const MEETINGS = Array.from({ length: 10 }).map((_, i) => {
  const type = pick(['apparat', 'qabul', 'shtab', 'video', 'hashar']);
  const chair = pick(DEPUTIES);
  const dayOffset = randInt(-6, 9);
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(pick([9, 10, 11, 14, 15, 16]), pick([0, 30]), 0, 0);
  let status: string;
  if (dayOffset < 0) status = rnd() > 0.85 ? 'cancelled' : 'done';
  else if (dayOffset === 0) status = 'ongoing';
  else status = rnd() > 0.9 ? 'cancelled' : 'scheduled';
  const agenda = [pick(chair.topics), ...MEETING_AGENDA_GENERAL].slice(0, randInt(3, 4));
  return {
    id: `YIG-${3000 + i}`,
    title: pick(MEETING_TITLES[type]),
    type,
    status,
    startAt: start.toISOString(),
    durationMin: pick([30, 45, 60, 90]),
    location: type === 'video' ? MEETING_LOCATIONS[2] : pick(MEETING_LOCATIONS),
    chairDeputyId: chair.id,
    agenda,
    participants: randInt(6, 42),
    districtId: HOME_DISTRICT_ID,
  };
});

/* ============================================================
   Yangiliklar (News) — 8 ta
   ============================================================ */
const NEWS_SEED: { title: string; excerpt: string; category: string; cover: string; featured?: boolean; status?: string }[] = [
  { title: "Tumanda yangi 12 ta zamonaviy kamera o'rnatildi", excerpt: "Jamoat xavfsizligini ta'minlash maqsadida markaziy ko'chalarda yangi videokuzatuv tizimi ishga tushirildi.", category: 'yangilik', cover: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&q=70', featured: true },
  { title: 'Issiqlik mavsumiga tayyorgarlik yakunlandi', excerpt: "Barcha ko'p qavatli uylarning issiqlik tizimlari sinovdan o'tkazildi va mavsumga tayyor holatga keltirildi.", category: 'elon', cover: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=70' },
  { title: 'Hokim qabuli: shanba kuni fuqarolar bilan uchrashuv', excerpt: "Tuman hokimi navbatdagi ochiq qabulni o'tkazadi. Murojaat qilish uchun oldindan ro'yxatdan o'ting.", category: 'tadbir', cover: 'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=800&q=70', featured: true },
  { title: "Kommunal to'lovlar bo'yicha yangi imtiyozlar joriy etildi", excerpt: "Ko'p bolali oilalar uchun kommunal xizmatlarga 30% gacha chegirma belgilandi.", category: 'qaror', cover: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=70' },
  { title: 'Kuchli shamol haqida ogohlantirish', excerpt: "Ertaga tumanda kuchli shamol kutilmoqda. Aholidan ehtiyot choralarini ko'rish so'raladi.", category: 'ogohlantirish', cover: 'https://images.unsplash.com/photo-1561553543-e4c7b608b98d?w=800&q=70' },
  { title: "Mahallalararo obodonlashtirish tanlovi e'lon qilindi", excerpt: "Eng obod mahalla tanlovi g'oliblari uchun mukofot jamg'armasi ajratildi.", category: 'elon', cover: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=70' },
  { title: 'Yoshlar uchun yangi IT-markaz ochildi', excerpt: 'Tuman markazida yoshlarga bepul dasturlash va dizayn kurslari tashkil etiladi.', category: 'yangilik', cover: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=70' },
  { title: "Suv ta'minoti tizimini modernizatsiya qilish rejasi", excerpt: "Keyingi yil davomida tumanning eski suv quvurlari to'liq yangilanadi.", category: 'qaror', cover: 'https://images.unsplash.com/photo-1583795128727-6ec3642408f8?w=800&q=70', status: 'draft' },
];
const NEWS_AUTHORS = ['Matbuot xizmati', 'Hokim apparati', "Axborot bo'limi", 'N. Karimova'];

const NEWS = NEWS_SEED.map((n, i) => {
  const date = new Date();
  date.setDate(date.getDate() - randInt(0, 40));
  date.setHours(randInt(8, 18), randInt(0, 59));
  return {
    id: `n${i + 1}`,
    title: n.title,
    excerpt: n.excerpt,
    body: `${n.excerpt} ${n.excerpt} Tuman hokimiyati matbuot xizmati ushbu yangilik bo'yicha qo'shimcha ma'lumotlarni rasmiy kanallar orqali e'lon qiladi.`,
    category: n.category,
    status: n.status ?? 'published',
    cover: n.cover,
    author: pick(NEWS_AUTHORS),
    publishedAt: date.toISOString(),
    views: randInt(120, 8400),
    featured: n.featured ?? false,
  };
}).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

/* ============================================================
   Mobil ilova foydalanuvchilari (App Users) — 35 ta
   ============================================================ */
const MIRZO_MAHALLAS = ["Buyuk Ipak Yo'li", 'Qorasuv', "Yalang'och", "Do'mbrobod", 'Tuzel', 'Feruza', 'Universitet', 'Oltintepa', 'Mevazor', 'TTZ-1', 'TTZ-4', "Mirzo Ulug'bek"];
const APP_USER_NAMES = ['Aziza Rahimova', "Jahongir To'xtayev", 'Dilfuza Ergasheva', 'Sardor Qodirov', 'Nigora Yusupova', 'Bekzod Sobirov', 'Maftuna Aliyeva', 'Rustam Bekmurodov', 'Kamola Inoyatova', 'Doniyor Hakimov', 'Sevara Nazarova', 'Aziz Toshpulatov', 'Gulnoza Karimova', "Sherzod Yo'ldoshev", 'Madina Saidova', "Ulug'bek Mirzayev", 'Feruza Abdullayeva', 'Otabek Rasulov', 'Zilola Umarova', 'Jasurbek Tursunov', 'Nodira Ismoilova', 'Sanjar Eshonov', "Malika Yo'ldosheva", 'Akmaljon Zokirov', 'Dilbar Sharipova', "Temur G'aniyev", 'Shahnoza Qosimova', 'Bahodir Yoqubov', 'Lola Mahmudova', 'Sardorbek Olimov', 'Munisa Rajabova', 'Islom Ortiqov', 'Yulduz Hasanova', 'Farrux Sodiqov', 'Nilufar Tojiboyeva', 'Kamronbek Usmonov'];
const APP_VERSIONS = ['3.2.1', '3.2.0', '3.1.4', '3.0.9', '2.9.5'];

function buildUserActivity(days: number, intensity: number) {
  const out: { date: string; count: number }[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const base = rnd() < 0.25 ? 0 : randInt(0, Math.max(1, Math.round(intensity)));
    out.push({ date: date.toISOString().slice(0, 10), count: base });
  }
  return out;
}

const APP_USERS = APP_USER_NAMES.map((name, i) => {
  const gender = /a$|a |Gul|Dil|Nig|Maf|Kam|Sev|Mad|Fer|Zil|Nod|Mal|Sha|Lol|Mun|Yul|Nil|Nilu/.test(name) ? 'women' : 'men';
  const photoNum = 10 + ((i * 7) % 80);
  const regDaysAgo = randInt(5, 760);
  const registeredAt = new Date();
  registeredAt.setDate(registeredAt.getDate() - regDaysAgo);

  const roll = rnd();
  const status = roll > 0.92 ? 'blocked' : roll > 0.7 ? 'inactive' : 'active';

  const lastActive = new Date();
  const lastActiveDaysAgo = status === 'active' ? randInt(0, 3) : status === 'inactive' ? randInt(14, 90) : randInt(30, 160);
  lastActive.setDate(lastActive.getDate() - lastActiveDaysAgo);
  lastActive.setHours(randInt(7, 23), randInt(0, 59));

  const requestsCount = status === 'blocked' ? randInt(1, 4) : randInt(0, 28);
  const resolvedCount = Math.round(requestsCount * (0.45 + rnd() * 0.5));
  const verified = rnd() > 0.28;
  const intensity = status === 'active' ? randInt(2, 6) : 1;

  return {
    id: `au${i + 1}`,
    name,
    phone: `+998 ${pick(['90', '91', '93', '94', '97', '99', '88'])} ${randInt(100, 999)} ${pad(randInt(0, 99))} ${pad(randInt(0, 99))}`,
    photo: `https://randomuser.me/api/portraits/${gender}/${photoNum}.jpg`,
    avatarColor: pick(['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444']),
    region: pick(MIRZO_MAHALLAS),
    districtId: HOME_DISTRICT_ID,
    address: `${pick(MIRZO_MAHALLAS)} MFY, ${randInt(1, 42)}-uy${rnd() > 0.5 ? `, ${randInt(1, 120)}-xonadon` : ''}`,
    device: rnd() > 0.46 ? 'android' : 'ios',
    appVersion: pick(APP_VERSIONS),
    status,
    verified,
    registeredAt: registeredAt.toISOString(),
    lastActiveAt: lastActive.toISOString(),
    requestsCount,
    resolvedCount: Math.min(resolvedCount, requestsCount),
    avgRating: requestsCount > 0 ? Math.round((3.4 + rnd() * 1.6) * 10) / 10 : 0,
    points: requestsCount * randInt(8, 24) + (verified ? 120 : 0) + randInt(0, 180),
    notificationsOn: rnd() > 0.2,
    activity: buildUserActivity(14, intensity),
  };
}).sort((a, b) => +new Date(b.lastActiveAt) - +new Date(a.lastActiveAt));

/* ============================================================
   Bildirishnomalar (Notifications) — 6 ta
   ============================================================ */
const NOTIFICATIONS = ([
  { type: 'request', title: 'Yangi murojaat', message: "Chilonzor 19-mavzeda suv ta'minoti uzilishi qayd etildi.", minsAgo: 4, href: '/requests' },
  { type: 'worker', title: 'Geofence ogohlantirishi', message: 'Sardor Aliyev belgilangan hudud tashqarisida.', minsAgo: 22, href: '/workers' },
  { type: 'finance', title: 'Kommunal hisobot tayyor', message: "May oyi yig'im darajasi 94.2% ni tashkil etdi.", minsAgo: 70, href: '/finance' },
  { type: 'camera', title: 'Kamera oflayn', message: 'Yunusobod-7 kamerasi bilan aloqa uzildi.', minsAgo: 130, read: true, href: '/cameras' },
  { type: 'request', title: 'Murojaat hal qilindi', message: "Yo'l yoritish bo'yicha murojaat yakunlandi.", minsAgo: 240, read: true, href: '/requests' },
  { type: 'system', title: 'Tizim yangilanishi', message: 'Platforma 2.4 versiyasiga yangilandi.', minsAgo: 600, read: true },
] as { type: string; title: string; message: string; minsAgo: number; read?: boolean; href?: string }[]).map((n, i) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n.minsAgo);
  return {
    id: `ntf${i + 1}`,
    type: n.type,
    title: n.title,
    message: n.message,
    createdAt: d.toISOString(),
    read: 'read' in n ? !!n.read : false,
    href: 'href' in n ? n.href : null,
  };
});

/* ============================================================
   Persistence — idempotent upsert by stable id
   ============================================================ */
const DATASETS: Record<string, any[]> = {
  districts: DISTRICTS,
  workers: WORKERS,
  requests: REQUESTS,
  cameras: CAMERAS,
  utilityPayments: UTILITY_PAYMENTS,
  utilityMonthly: UTILITY_MONTHLY,
  financeMonthly: FINANCE_MONTHLY,
  documents: DOCUMENTS,
  staff: STAFF,
  deputies: DEPUTIES,
  complaints: COMPLAINTS,
  meetings: MEETINGS,
  news: NEWS,
  appUsers: APP_USERS,
  notifications: NOTIFICATIONS,
};

function reportCounts(): void {
  for (const [k, v] of Object.entries(DATASETS)) {
    console.log(`  ${k.padEnd(16)} ${v.length}`);
  }
}

// Convert the mock's ISO-string shapes into Prisma inputs (DateTime fields).
const toDistrict = (d: any) => ({
  id: d.id, name: d.name, center: d.center, polygon: d.polygon, color: d.color,
  population: d.population, households: d.households, areaKm2: d.areaKm2,
});
const toWorker = (w: any) => ({ ...w, hiredAt: new Date(w.hiredAt) });
const toRequest = (r: any) => ({
  ...r,
  createdAt: new Date(r.createdAt),
  resolvedAt: r.resolvedAt ? new Date(r.resolvedAt) : null,
});
const toCamera = (c: any) => ({ ...c, installedAt: new Date(c.installedAt) });
const toStaff = (s: any) => ({
  ...s,
  lastLogin: s.lastLogin ? new Date(s.lastLogin) : null,
  createdAt: new Date(s.createdAt),
});
const toComplaint = (c: any) => ({
  ...c,
  createdAt: new Date(c.createdAt),
  deadlineAt: new Date(c.deadlineAt),
  resolvedAt: c.resolvedAt ? new Date(c.resolvedAt) : null,
});
const toAppUser = (u: any) => ({
  ...u,
  registeredAt: new Date(u.registeredAt),
  lastActiveAt: new Date(u.lastActiveAt),
});
const toMeeting = (m: any) => ({ ...m, startAt: new Date(m.startAt) });
const toNews = (n: any) => ({ ...n, publishedAt: new Date(n.publishedAt) });
const toDocument = (d: any) => ({ ...d, createdAt: new Date(d.createdAt) });
const toNotification = (n: any) => ({ ...n, createdAt: new Date(n.createdAt) });

async function upsertAll(model: any, rows: any[], map: (r: any) => any): Promise<void> {
  for (const row of rows) {
    const data = map(row);
    const { id, ...rest } = data;
    await model.upsert({ where: { id }, update: rest, create: data });
  }
}

async function upsertByKey(model: any, rows: any[], key: string): Promise<void> {
  for (const row of rows) {
    const where: any = { [key]: row[key] };
    await model.upsert({ where, update: row, create: row });
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // Keep the original skeleton admin-employee seed (idempotent).
    await prisma.employee.upsert({
      where: { phone: '+998900000000' },
      update: {},
      create: {
        fullName: 'Tizim Administratori',
        phone: '+998900000000',
        position: 'Administrator',
        region: 'Toshkent',
        district: "Mirzo Ulug'bek",
        role: EmployeeRole.ADMIN,
      },
    });

    await upsertAll(prisma.district, DISTRICTS, toDistrict);
    await upsertAll(prisma.worker, WORKERS, toWorker);
    await upsertAll(prisma.citizenRequest, REQUESTS, toRequest);
    await upsertAll(prisma.camera, CAMERAS, toCamera);
    await upsertAll(prisma.utilityPayment, UTILITY_PAYMENTS, (r) => r);
    await upsertByKey(prisma.utilityMonthly, UTILITY_MONTHLY, 'month');
    await upsertByKey(prisma.financeMonthly, FINANCE_MONTHLY, 'month');
    await upsertAll(prisma.govDocument, DOCUMENTS, toDocument);
    await upsertAll(prisma.staff, STAFF, toStaff);
    await upsertAll(prisma.deputy, DEPUTIES, (r) => r);
    await upsertAll(prisma.complaint, COMPLAINTS, toComplaint);
    await upsertAll(prisma.meeting, MEETINGS, toMeeting);
    await upsertAll(prisma.newsItem, NEWS, toNews);
    await upsertAll(prisma.appUser, APP_USERS, toAppUser);
    await upsertAll(prisma.adminNotification, NOTIFICATIONS, toNotification);

    console.log('Seed complete. Row counts:');
    reportCounts();
  } finally {
    await prisma.$disconnect();
  }
}

if (process.env.SEED_DRY_RUN === '1') {
  console.log('DRY RUN — data generated, DB untouched. Row counts:');
  reportCounts();
} else {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
