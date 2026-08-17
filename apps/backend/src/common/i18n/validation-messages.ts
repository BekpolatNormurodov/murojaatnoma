import type { SupportedLang } from './lang.util';
import type { FlattenedValidationError } from './validation-exception.types';

/**
 * Localized labels for property names that commonly show up in
 * `class-validator` errors across the DTOs in this backend. Anything not
 * listed here falls back to the raw property name (see
 * `localizeFieldName`), so this map only needs to cover the common cases —
 * it does not need to be exhaustive.
 */
const FIELD_LABELS: Record<string, Record<SupportedLang, string>> = {
  username: { uz: 'Foydalanuvchi nomi', ru: 'Имя пользователя' },
  login: { uz: 'Login', ru: 'Логин' },
  password: { uz: 'Parol', ru: 'Пароль' },
  phone: { uz: 'Telefon raqami', ru: 'Номер телефона' },
  applicantPhone: { uz: 'Ariza beruvchi telefon raqami', ru: 'Номер телефона заявителя' },
  citizenPhone: { uz: 'Fuqaro telefon raqami', ru: 'Номер телефона гражданина' },
  email: { uz: 'Elektron pochta', ru: 'Электронная почта' },
  code: { uz: 'Kod', ru: 'Код' },
  title: { uz: 'Sarlavha', ru: 'Заголовок' },
  name: { uz: 'Nomi', ru: 'Название' },
  fullName: { uz: "To'liq ism", ru: 'Полное имя' },
  applicantFullName: { uz: "Ariza beruvchining to'liq ismi", ru: 'Полное имя заявителя' },
  citizenName: { uz: 'Fuqaro ismi', ru: 'Имя гражданина' },
  description: { uz: 'Tavsif', ru: 'Описание' },
  note: { uz: 'Izoh', ru: 'Примечание' },
  reason: { uz: 'Sabab', ru: 'Причина' },
  feedback: { uz: 'Fikr-mulohaza', ru: 'Отзыв' },
  comment: { uz: 'Izoh', ru: 'Комментарий' },
  subject: { uz: 'Mavzu', ru: 'Тема' },
  text: { uz: 'Matn', ru: 'Текст' },
  body: { uz: 'Matn', ru: 'Текст сообщения' },
  category: { uz: 'Kategoriya', ru: 'Категория' },
  categories: { uz: 'Kategoriyalar', ru: 'Категории' },
  status: { uz: 'Holat', ru: 'Статус' },
  role: { uz: 'Rol', ru: 'Роль' },
  address: { uz: 'Manzil', ru: 'Адрес' },
  region: { uz: 'Viloyat', ru: 'Область' },
  district: { uz: 'Tuman', ru: 'Район' },
  districtId: { uz: 'Tuman', ru: 'Район' },
  location: { uz: 'Joylashuv', ru: 'Местоположение' },
  latitude: { uz: 'Kenglik (latitude)', ru: 'Широта' },
  longitude: { uz: "Uzunlik (longitude)", ru: 'Долгота' },
  lat: { uz: 'Kenglik (lat)', ru: 'Широта (lat)' },
  lng: { uz: 'Uzunlik (lng)', ru: 'Долгота (lng)' },
  accuracy: { uz: 'Aniqlik', ru: 'Точность' },
  url: { uz: 'Havola (URL)', ru: 'Ссылка (URL)' },
  attachmentUrl: { uz: 'Ilova havolasi', ru: 'Ссылка на вложение' },
  avatarUrl: { uz: 'Profil rasmi havolasi', ru: 'Ссылка на аватар' },
  photo: { uz: 'Rasm', ru: 'Фото' },
  photos: { uz: 'Rasmlar', ru: 'Фотографии' },
  citizenPhoto: { uz: 'Fuqaro rasmi', ru: 'Фото гражданина' },
  fileName: { uz: 'Fayl nomi', ru: 'Имя файла' },
  fileSize: { uz: 'Fayl hajmi', ru: 'Размер файла' },
  mimeType: { uz: 'Fayl turi', ru: 'Тип файла' },
  date: { uz: 'Sana', ru: 'Дата' },
  startAt: { uz: 'Boshlanish vaqti', ru: 'Время начала' },
  expiresAt: { uz: 'Amal qilish muddati', ru: 'Срок действия' },
  hiredAt: { uz: 'Ishga qabul qilingan sana', ru: 'Дата приёма на работу' },
  checkInTime: { uz: 'Kelgan vaqti', ru: 'Время прихода' },
  checkOutTime: { uz: 'Ketgan vaqti', ru: 'Время ухода' },
  month: { uz: 'Oy', ru: 'Месяц' },
  year: { uz: 'Yil', ru: 'Год' },
  position: { uz: 'Lavozim', ru: 'Должность' },
  department: { uz: "Bo'lim", ru: 'Отдел' },
  assignedDepartmentId: { uz: "Biriktirilgan bo'lim", ru: 'Назначенный отдел' },
  assignedEmployeeId: { uz: 'Biriktirilgan xodim', ru: 'Назначенный сотрудник' },
  assignedWorkerId: { uz: 'Biriktirilgan ishchi', ru: 'Назначенный работник' },
  employeeId: { uz: 'Xodim', ru: 'Сотрудник' },
  senderId: { uz: 'Yuboruvchi', ru: 'Отправитель' },
  senderName: { uz: 'Yuboruvchi nomi', ru: 'Имя отправителя' },
  salary: { uz: 'Ish haqi', ru: 'Заработная плата' },
  bonus: { uz: 'Bonus', ru: 'Бонус' },
  points: { uz: 'Ballar', ru: 'Баллы' },
  rating: { uz: 'Reyting', ru: 'Рейтинг' },
  priority: { uz: 'Muhimlik darajasi', ru: 'Приоритет' },
  severity: { uz: "Og'irlik darajasi", ru: 'Серьёзность' },
  verified: { uz: 'Tasdiqlangan', ru: 'Подтверждён' },
  notificationsOn: { uz: 'Bildirishnomalar', ru: 'Уведомления' },
  refreshToken: { uz: 'Refresh token', ru: 'Refresh-токен' },
  accessToken: { uz: 'Access token', ru: 'Access-токен' },
  query: { uz: "Qidiruv so'rovi", ru: 'Поисковый запрос' },
  search: { uz: 'Qidiruv', ru: 'Поиск' },
  limit: { uz: 'Chegara (limit)', ru: 'Лимит' },
  page: { uz: 'Sahifa', ru: 'Страница' },
  id: { uz: 'Identifikator (ID)', ru: 'Идентификатор (ID)' },
  items: { uz: 'Elementlar', ru: 'Элементы' },
  topics: { uz: 'Mavzular', ru: 'Темы' },
  permissions: { uz: 'Ruxsatlar', ru: 'Права доступа' },
};

/** Returns the localized label for a (possibly dotted, e.g. `address.city`) property path. */
export function localizeFieldName(property: string, lang: SupportedLang): string {
  const label = FIELD_LABELS[property];
  if (label) {
    return label[lang];
  }
  // Fall back to the last segment of a dotted/nested path (e.g.
  // `address.city` -> `city`) before giving up and using it verbatim.
  const lastSegment = property.includes('.') ? property.split('.').pop() ?? property : property;
  const nestedLabel = FIELD_LABELS[lastSegment];
  return nestedLabel ? nestedLabel[lang] : property;
}

type MessageBuilder = (field: string, n: string | undefined) => string;

interface MessageTemplate {
  uz: MessageBuilder;
  ru: MessageBuilder;
}

/** Pulls the first number out of class-validator's English message (e.g. the `6` in "...longer than or equal to 6 characters"). */
function extractNumber(englishMessage: string | undefined): string | undefined {
  if (!englishMessage) {
    return undefined;
  }
  const match = englishMessage.match(/-?\d+(\.\d+)?/);
  return match ? match[0] : undefined;
}

/**
 * Localized templates keyed by the `class-validator` constraint name
 * (`ValidationError.constraints`'s keys — e.g. `minLength`, `isEnum`,
 * `whitelistValidation`). Templates that need a numeric parameter (min/max
 * length, min/max value, array size, ...) receive it pre-extracted from the
 * original English message via `extractNumber`.
 */
const TEMPLATES: Record<string, MessageTemplate> = {
  isNotEmpty: {
    uz: (field) => `${field} bo'sh bo'lishi mumkin emas`,
    ru: (field) => `${field} не должно быть пустым`,
  },
  isDefined: {
    uz: (field) => `${field} kiritilishi shart`,
    ru: (field) => `${field} обязателен для заполнения`,
  },
  isString: {
    uz: (field) => `${field} matn (satr) bo'lishi kerak`,
    ru: (field) => `${field} должен быть строкой`,
  },
  isEmail: {
    uz: (field) => `${field} to'g'ri elektron pochta manzili bo'lishi kerak`,
    ru: (field) => `${field} должен быть корректным email-адресом`,
  },
  isEnum: {
    uz: (field) => `${field} uchun noto'g'ri qiymat kiritildi`,
    ru: (field) => `${field} содержит недопустимое значение`,
  },
  isInt: {
    uz: (field) => `${field} butun son bo'lishi kerak`,
    ru: (field) => `${field} должен быть целым числом`,
  },
  isNumber: {
    uz: (field) => `${field} raqam bo'lishi kerak`,
    ru: (field) => `${field} должен быть числом`,
  },
  isPositive: {
    uz: (field) => `${field} musbat son bo'lishi kerak`,
    ru: (field) => `${field} должен быть положительным числом`,
  },
  isBoolean: {
    uz: (field) => `${field} mantiqiy qiymat (true/false) bo'lishi kerak`,
    ru: (field) => `${field} должен быть логическим значением (true/false)`,
  },
  isArray: {
    uz: (field) => `${field} massiv (array) bo'lishi kerak`,
    ru: (field) => `${field} должен быть массивом`,
  },
  arrayMinSize: {
    uz: (field, n) => `${field} kamida ${n ?? ''} ta elementdan iborat bo'lishi kerak`,
    ru: (field, n) => `${field} должен содержать не менее ${n ?? ''} элементов`,
  },
  isDateString: {
    uz: (field) => `${field} to'g'ri sana formatida bo'lishi kerak (ISO 8601)`,
    ru: (field) => `${field} должен быть в формате даты ISO 8601`,
  },
  isISO8601: {
    uz: (field) => `${field} to'g'ri sana formatida bo'lishi kerak (ISO 8601)`,
    ru: (field) => `${field} должен быть в формате даты ISO 8601`,
  },
  min: {
    uz: (field, n) => `${field} qiymati kamida ${n ?? ''} bo'lishi kerak`,
    ru: (field, n) => `${field} должен быть не менее ${n ?? ''}`,
  },
  max: {
    uz: (field, n) => `${field} qiymati ${n ?? ''} dan oshmasligi kerak`,
    ru: (field, n) => `${field} должен быть не более ${n ?? ''}`,
  },
  minLength: {
    uz: (field, n) => `${field} kamida ${n ?? ''} ta belgidan iborat bo'lishi kerak`,
    ru: (field, n) => `${field} должен содержать не менее ${n ?? ''} символов`,
  },
  maxLength: {
    uz: (field, n) => `${field} ko'pi bilan ${n ?? ''} ta belgidan iborat bo'lishi kerak`,
    ru: (field, n) => `${field} должен содержать не более ${n ?? ''} символов`,
  },
  matches: {
    uz: (field) => `${field} noto'g'ri formatda kiritildi`,
    ru: (field) => `${field} указан в неверном формате`,
  },
  isPhoneNumber: {
    uz: (field) => `${field} to'g'ri telefon raqami bo'lishi kerak`,
    ru: (field) => `${field} должен быть корректным номером телефона`,
  },
  isMobilePhone: {
    uz: (field) => `${field} to'g'ri telefon raqami bo'lishi kerak`,
    ru: (field) => `${field} должен быть корректным номером телефона`,
  },
  isLatitude: {
    uz: (field) => `${field} to'g'ri kenglik (latitude) qiymati bo'lishi kerak`,
    ru: (field) => `${field} должен быть корректным значением широты`,
  },
  isLongitude: {
    uz: (field) => `${field} to'g'ri uzunlik (longitude) qiymati bo'lishi kerak`,
    ru: (field) => `${field} должен быть корректным значением долготы`,
  },
  isUUID: {
    uz: (field) => `${field} to'g'ri UUID formatida bo'lishi kerak`,
    ru: (field) => `${field} должен быть в формате UUID`,
  },
  whitelistValidation: {
    uz: (field) => `${field} — ruxsat etilmagan maydon`,
    ru: (field) => `${field} — недопустимое поле`,
  },
};

/** Used when a constraint key has no dedicated template above. */
const FALLBACK_TEMPLATE: MessageTemplate = {
  uz: (field) => `${field} noto'g'ri kiritildi`,
  ru: (field) => `Поле «${field}» заполнено некорректно`,
};

/** Localizes a single constraint failure into the target language. */
export function localizeConstraintMessage(
  property: string,
  constraintKey: string,
  englishMessage: string,
  lang: SupportedLang,
): string {
  const field = localizeFieldName(property, lang);
  const template = TEMPLATES[constraintKey] ?? FALLBACK_TEMPLATE;
  const n = extractNumber(englishMessage);
  return template[lang](field, n);
}

/**
 * Localizes a full list of flattened validation errors (one entry per
 * failing field, each potentially failing several constraints) into the
 * flat `string[]` shape the API contract (and the web-admin client, which
 * joins this array) expects.
 */
export function localizeValidationErrors(
  errors: FlattenedValidationError[],
  lang: SupportedLang,
): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    for (const [constraintKey, englishMessage] of Object.entries(error.constraints)) {
      messages.push(localizeConstraintMessage(error.property, constraintKey, englishMessage, lang));
    }
  }
  return messages;
}
