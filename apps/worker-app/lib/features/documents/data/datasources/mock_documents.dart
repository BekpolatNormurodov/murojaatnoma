import 'package:worker_app/features/documents/domain/entities/document_item.dart';

/// Hujjatlar moduli uchun xotiradagi soxta (mock) "backend" holati.
///
/// `DocumentsRemoteDataSourceMockImpl` shu ro'yxatni o'qiydi —
/// `AppConfig.useMock` `true` bo'lganda haqiqiy backend o'rnini bosadi.
/// `mock_meetings.dart`/`mock_applications.dart`dagi uslubga o'xshash:
/// modul darajasidagi, `final` bog'lovchi (ro'yxat ma'lumotlari o'zgarmas)
/// — bu yerda hujjatlar tahrirlanmagani uchun mutatsiya shart emas.
///
/// `documents` moduli o'z mock ma'lumotini `lib/core/mock/`ga emas, shu
/// papkaga (feature ichiga) joylashtiradi — vazifa faqat
/// `lib/features/documents/**` ostida qolishi kerak bo'lgani uchun.
final List<DocumentItem> mockDocuments = [
  const DocumentItem(
    id: 'D-1',
    code: 'QR-2026/118',
    title: "Tuman hokimligi tarkibiy tuzilmasini tasdiqlash to'g'risida",
    type: DocumentType.qaror,
    status: DocumentStatus.signed,
    author: 'Sardor Aliyev',
    region: 'Toshkent shahri',
    createdAt: '2026-08-01T09:00:00',
    sizeKb: 842,
    pages: 6,
  ),
  const DocumentItem(
    id: 'D-2',
    code: 'BY-2026/054',
    title: "Yozgi ta'mirlash ishlarini boshlash bo'yicha buyruq",
    type: DocumentType.buyruq,
    status: DocumentStatus.signed,
    author: 'Malika Yusupova',
    region: 'Toshkent shahri',
    createdAt: '2026-07-28T14:30:00',
    sizeKb: 310,
    pages: 2,
  ),
  const DocumentItem(
    id: 'D-3',
    code: 'HS-2026/031',
    title: 'II chorak ijtimoiy-iqtisodiy rivojlanish hisoboti',
    type: DocumentType.hisobot,
    status: DocumentStatus.review,
    author: 'Anvar Qodirov',
    region: 'Samarqand viloyati',
    createdAt: '2026-07-20T11:15:00',
    sizeKb: 2148,
    pages: 24,
  ),
  const DocumentItem(
    id: 'D-4',
    code: 'SH-2026/019',
    title: "Ko'chani asfaltlash bo'yicha pudrat shartnomasi",
    type: DocumentType.shartnoma,
    status: DocumentStatus.draft,
    author: 'Dilshod Rahimov',
    region: "Farg'ona viloyati",
    createdAt: '2026-08-05T10:00:00',
    sizeKb: 156,
    pages: 8,
  ),
  const DocumentItem(
    id: 'D-5',
    code: 'AR-2026/402',
    title: "Ko'chat ekish uchun maydon ajratish arizasi",
    type: DocumentType.ariza,
    status: DocumentStatus.review,
    author: 'Kamola Nurova',
    region: 'Toshkent shahri',
    createdAt: '2026-08-10T08:45:00',
    sizeKb: 64,
    pages: 1,
  ),
  const DocumentItem(
    id: 'D-6',
    code: 'DL-2026/077',
    title: 'Kommunal avariyani bartaraf etish dalolatnomasi',
    type: DocumentType.dalolatnoma,
    status: DocumentStatus.signed,
    author: 'Otabek Sodiqov',
    region: 'Buxoro viloyati',
    createdAt: '2026-07-15T16:20:00',
    sizeKb: 420,
    pages: 3,
  ),
  const DocumentItem(
    id: 'D-7',
    code: 'QR-2025/271',
    title: "O'tgan yilgi bayram tadbirlari to'g'risidagi qaror",
    type: DocumentType.qaror,
    status: DocumentStatus.archived,
    author: 'Sardor Aliyev',
    region: 'Toshkent shahri',
    createdAt: '2025-12-20T09:30:00',
    sizeKb: 512,
    pages: 4,
  ),
  const DocumentItem(
    id: 'D-8',
    code: 'HS-2026/012',
    title: "Yanvar oyi kommunal to'lovlar bo'yicha qisqa hisobot",
    type: DocumentType.hisobot,
    status: DocumentStatus.draft,
    author: 'Zarina Abdullayeva',
    region: 'Namangan viloyati',
    createdAt: '2026-08-14T13:00:00',
    sizeKb: 98,
    pages: 3,
  ),
];
