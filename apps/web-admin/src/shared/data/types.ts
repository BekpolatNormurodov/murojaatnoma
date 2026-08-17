/* ============================================================
   Domain tiplari (Types) — Hokimiyat raqamli platforma
   ============================================================ */

export type RequestStatus = "new" | "in_progress" | "resolved" | "rejected";

export type RequestCategory =
  | "kommunal"
  | "yol"
  | "suv"
  | "elektr"
  | "tozalik"
  | "obodonlashtirish";

export type Priority = "low" | "medium" | "high";

/* ------------------------------------------------------------
   Tuman (District) — belgilangan geografik chegara (polygon)
   ------------------------------------------------------------ */
export interface District {
  id: string;
  name: string;
  /** Markaziy koordinata [lat, lng] */
  center: [number, number];
  /** Geografik chegara — yopiq ko'pburchak nuqtalari [lat, lng][] */
  polygon: [number, number][];
  color: string;
  population: number; // aholi soni
  households: number; // xonadonlar
  areaKm2: number; // maydon
}

/* ------------------------------------------------------------
   Hujjat (Worker hujjatlari)
   ------------------------------------------------------------ */
export type WorkerDocType =
  | "passport"
  | "contract"
  | "certificate"
  | "license"
  | "medical";

export interface WorkerDocument {
  id: string;
  name: string;
  type: WorkerDocType;
  status: "valid" | "expiring" | "expired";
  uploadedAt: string; // ISO
  expiresAt?: string; // ISO
}

/* ------------------------------------------------------------
   Davomat (Attendance) — kunlik kelish/ketish va tasdiq
   ------------------------------------------------------------ */
export type AttendanceStatus = "present" | "late" | "absent" | "leave";

export interface AttendanceDay {
  date: string; // ISO date (YYYY-MM-DD)
  checkIn: string | null; // "08:12"
  checkOut: string | null; // "17:45"
  status: AttendanceStatus;
  hours: number; // ishlangan soat
  insideGeofence: boolean; // o'z hududida bo'lganmi
  selfConfirmed: boolean; // o'zini kunlik tasdiqlaganmi
  confirmedAt: string | null; // "08:15"
}

/* ------------------------------------------------------------
   Ishchi (Worker) — kengaytirilgan profil
   ------------------------------------------------------------ */
export type WorkerStatus = "online" | "offline" | "on_task" | "break";

export interface Worker {
  id: string;
  name: string;
  photo: string; // rasm URL
  avatarColor: string;
  position: string; // lavozim
  region: string; // tuman nomi
  districtId: string;
  phone: string;
  email: string;
  specialization: RequestCategory[];
  status: WorkerStatus;
  insideRegion: boolean; // hozir o'z hududidami
  rating: number; // 0..5
  points: number;
  completedTasks: number;
  activeTasks: number;
  lat: number;
  lng: number;

  // Davomat / ish vaqti
  hiredAt: string; // ISO
  checkInTime: string | null; // bugun ishga chiqqan vaqt
  checkOutTime: string | null; // bugun ishdan ketgan vaqt
  todayConfirmed: boolean; // bugun o'zini tasdiqlaganmi
  attendanceRate: number; // % oylik davomat
  onTimeRate: number; // % o'z vaqtida kelish
  monthlyHours: number; // oylik ishlangan soat
  attendance: AttendanceDay[]; // so'nggi kunlar

  // Moliya
  salary: number; // oylik (so'm)
  bonus: number; // bonus (so'm)
  vehicle: string | null; // transport
  documents: WorkerDocument[];
}

/* ------------------------------------------------------------
   Fuqaro murojaati (Citizen Request) — kengaytirilgan
   ------------------------------------------------------------ */
export interface CitizenRequest {
  id: string;
  title: string;
  description: string;
  category: RequestCategory;
  status: RequestStatus;
  region: string;
  districtId: string;
  address: string;
  citizenName: string;
  citizenPhone: string;
  citizenPhoto: string;
  createdAt: string; // ISO
  resolvedAt: string | null; // ISO
  assignedWorkerId: string | null;
  priority: Priority;
  lat: number;
  lng: number;
  photos: string[]; // biriktirilgan rasmlar
  responseHours: number | null; // javob vaqti
  feedback: number | null; // fuqaro bahosi 0..5
  cost: number; // hal qilish xarajati (so'm)
}

/* ------------------------------------------------------------
   Kommunal to'lovlar (Utility / communal payments)
   ------------------------------------------------------------ */
export type UtilityType =
  | "suv"
  | "gaz"
  | "elektr"
  | "issiqlik"
  | "tozalik"
  | "internet";

export interface UtilityPayment {
  id: string;
  type: UtilityType;
  region: string;
  districtId: string;
  period: string; // "2026-05"
  charged: number; // hisoblangan (so'm)
  collected: number; // yig'ilgan (so'm)
  debt: number; // qarz (so'm)
  households: number;
  collectionRate: number; // %
}

export interface UtilityMonthly {
  month: string;
  suv: number;
  gaz: number;
  elektr: number;
  issiqlik: number;
  tozalik: number;
  internet: number;
}

/* ------------------------------------------------------------
   Moliya / aylanma (Finance / turnover)
   ------------------------------------------------------------ */
export interface FinanceMonthly {
  month: string;
  budget: number; // byudjet rejasi
  spent: number; // sarflangan
  collected: number; // yig'ilgan
  turnover: number; // aylanma
}

/* ------------------------------------------------------------
   Kuzatuv kameralari (CCTV cameras)
   ------------------------------------------------------------ */
export type CameraType = "fixed" | "ptz" | "anpr" | "thermal";
export type CameraStatus = "online" | "offline" | "maintenance";

export interface Camera {
  id: string;
  name: string;
  region: string;
  districtId: string;
  type: CameraType;
  status: CameraStatus;
  lat: number;
  lng: number;
  resolution: string; // "4K" | "1080p"
  recording: boolean;
  uptime: number; // %
  detections24h: number;
  lastEvent: string | null;
  installedAt: string; // ISO
}

/* ------------------------------------------------------------
   Hujjatlar (Hokimiyat hujjatlari)
   ------------------------------------------------------------ */
export type GovDocType =
  | "qaror"
  | "buyruq"
  | "hisobot"
  | "shartnoma"
  | "ariza"
  | "dalolatnoma";
export type GovDocStatus = "draft" | "review" | "signed" | "archived";

export interface GovDocument {
  id: string;
  code: string; // "QR-2026/118"
  title: string;
  type: GovDocType;
  status: GovDocStatus;
  author: string;
  region: string;
  createdAt: string; // ISO
  sizeKb: number;
  pages: number;
}

/* ------------------------------------------------------------
   Analitika agregatsiyalari
   ------------------------------------------------------------ */
export interface KpiPoint {
  label: string;
  total: number;
  resolved: number;
}

export interface CategorySlice {
  category: RequestCategory;
  value: number;
}

export interface RegionStat {
  region: string;
  requests: number;
  resolved: number;
}

/* ------------------------------------------------------------
   Xodimlar boshqaruvi — rollar, ruxsatlar, login, ish vaqti
   ------------------------------------------------------------ */
/** Tizim modullari — ruxsatlar shu modullarga beriladi */
export type ModuleKey =
  | "dashboard"
  | "requests"
  | "map"
  | "workers"
  | "attendance"
  | "staff"
  | "cameras"
  | "finance"
  | "analytics"
  | "documents"
  | "news"
  | "settings";

/** Tizimdagi rollar (hokimiyat ierarxiyasi) */
export type StaffRole =
  | "hokim"
  | "hokim_yordamchisi"
  | "bolim_boshligi"
  | "operator"
  | "nazoratchi"
  | "ishchi";

export type StaffStatus = "active" | "inactive" | "suspended";

export interface WorkSchedule {
  start: string; // "09:00"
  end: string; // "18:00"
  days: number[]; // 1=Dushanba ... 7=Yakshanba
}

export interface StaffMember {
  id: string;
  name: string;
  photo: string;
  avatarColor: string;
  role: StaffRole;
  position: string; // erkin lavozim matni
  department: string; // bo'lim
  email: string;
  phone: string;
  login: string; // tizimga kirish logini
  status: StaffStatus;
  permissions: ModuleKey[]; // ruxsat berilgan modullar
  schedule: WorkSchedule; // ish vaqti
  lastLogin: string | null; // ISO
  createdAt: string; // ISO
  twoFactor: boolean;
}

/* ------------------------------------------------------------
   Yangiliklar / e'lonlar
   ------------------------------------------------------------ */
export type NewsCategory =
  | "elon"
  | "tadbir"
  | "qaror"
  | "ogohlantirish"
  | "yangilik";
export type NewsStatus = "published" | "draft";

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  category: NewsCategory;
  status: NewsStatus;
  cover: string; // rasm URL
  author: string;
  publishedAt: string; // ISO
  views: number;
  featured: boolean;
}

/* ------------------------------------------------------------
   Mobil ilova foydalanuvchilari (App Users) — fuqarolar
   ------------------------------------------------------------ */
export type AppUserStatus = "active" | "inactive" | "blocked";
export type AppUserDevice = "android" | "ios";

/** Kunlik faollik nuqtasi (sparkline / grafik uchun). */
export interface AppUserActivityPoint {
  date: string; // ISO date (YYYY-MM-DD)
  count: number; // o'sha kungi faollik (kirish/murojaat)
}

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  photo: string;
  avatarColor: string;
  region: string; // mahalla (Mirzo Ulug'bek tarkibida)
  districtId: string;
  address: string;
  device: AppUserDevice;
  appVersion: string;
  status: AppUserStatus;
  verified: boolean; // shaxsi tasdiqlangan (ID)
  registeredAt: string; // ISO — ro'yxatdan o'tgan sana
  lastActiveAt: string; // ISO — oxirgi faollik
  requestsCount: number; // jami yuborgan murojaatlar
  resolvedCount: number; // hal qilingan murojaatlar
  avgRating: number; // bergan o'rtacha baho (0..5)
  points: number; // faollik ballari
  notificationsOn: boolean; // push bildirishnomalar yoqilganmi
  activity: AppUserActivityPoint[]; // so'nggi kunlik faollik
}

/* ------------------------------------------------------------
   Bildirishnomalar (Notifications)
   ------------------------------------------------------------ */
export type NotificationType =
  | "request"
  | "worker"
  | "finance"
  | "camera"
  | "system";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string; // ISO
  read: boolean;
  href?: string;
}

/* ------------------------------------------------------------
   Hokim o'rinbosarlari (Deputy governors) — yo'nalishlar
   Har bir o'rinbosar o'z yo'nalishidagi murojaatlarga javob beradi
   ------------------------------------------------------------ */
export interface Deputy {
  id: string;
  name: string;
  photo: string; // rasm URL
  color: string; // yo'nalish rangi (avatar + badge)
  position: string; // "Hokimning birinchi o'rinbosari"
  direction: string; // to'liq yo'nalish nomi
  shortDirection: string; // qisqa yo'nalish
  /** Shu o'rinbosar javob beradigan murojaat yo'nalishlari */
  categories: RequestCategory[];
  /** Ko'rib chiqadigan asosiy masalalar (display) */
  topics: string[];
  phone: string;
  email: string;
  office: string; // kabinet raqami
  receptionDay: string; // fuqarolar qabuli kuni
}

/* ------------------------------------------------------------
   Shikoyatlar (Citizen complaints) — murojaatdan keskinroq
   ------------------------------------------------------------ */
export type ComplaintStatus = "new" | "reviewing" | "resolved" | "rejected";
export type ComplaintSeverity = "low" | "medium" | "high";

/** Shikoyatga yozilgan rasmiy javob (javoblar tarixi uchun). */
export interface ComplaintResponse {
  id: string;
  text: string;
  author: string; // javob bergan mas'ul (hokim o'rinbosari / hokimiyat)
  createdAt: string; // ISO
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  topic: string; // mavzu (deputy yo'nalishiga bog'liq)
  severity: ComplaintSeverity;
  status: ComplaintStatus;
  districtId: string;
  region: string;
  address: string;
  citizenName: string;
  citizenPhone: string;
  citizenPhoto: string;
  createdAt: string; // ISO
  deadlineAt: string; // ISO — javob berish muddati
  resolvedAt: string | null; // ISO
  deputyId: string; // mas'ul hokim o'rinbosari
  isRepeat: boolean; // takroriy shikoyatmi
  escalated: boolean; // yuqoriga ko'tarilganmi
  responses: ComplaintResponse[]; // rasmiy javoblar tarixi
}

/* ------------------------------------------------------------
   Yig'ilishlar (Meetings) — apparat, qabul, shtab, video selektor
   ------------------------------------------------------------ */
export type MeetingType = "apparat" | "qabul" | "shtab" | "video" | "hashar";
export type MeetingStatus = "scheduled" | "ongoing" | "done" | "cancelled";

export interface Meeting {
  id: string;
  title: string;
  type: MeetingType;
  status: MeetingStatus;
  startAt: string; // ISO datetime
  durationMin: number;
  location: string;
  chairDeputyId: string; // raislik qiluvchi hokim o'rinbosari
  agenda: string[]; // kun tartibi
  participants: number; // ishtirokchilar soni
  districtId: string;
}
