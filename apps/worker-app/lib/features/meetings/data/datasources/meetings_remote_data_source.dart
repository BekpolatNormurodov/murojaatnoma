import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/core/mock/mock_meetings.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';

/// Majlislar (yig'ilishlar) moduli uchun masofaviy ma'lumot manbai.
abstract class MeetingsRemoteDataSource {
  Future<List<Meeting>> list({MeetingStatus? status});

  Future<Meeting> getById(String id);

  Future<Meeting> join(String id);
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_meetings.dart`dagi xotiradagi
/// ro'yxat bilan ishlaydi.
class MeetingsRemoteDataSourceMockImpl implements MeetingsRemoteDataSource {
  @override
  Future<List<Meeting>> list({MeetingStatus? status}) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var result = List<Meeting>.of(mockMeetings);
    if (status != null) {
      result = result.where((m) => m.status == status).toList();
    }
    return List.unmodifiable(result);
  }

  @override
  Future<Meeting> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockMeetings.indexWhere((m) => m.id == id);
    if (index == -1) throw ServerException('Majlis topilmadi: $id');
    return mockMeetings[index];
  }

  @override
  Future<Meeting> join(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockMeetings.indexWhere((m) => m.id == id);
    if (index == -1) throw ServerException('Majlis topilmadi: $id');

    final existing = mockMeetings[index];
    final updated = _withUpdate(
      existing,
      joinUrl: existing.joinUrl ?? 'https://meet.hokimiyat.uz/${existing.id}',
    );
    mockMeetings[index] = updated;
    return updated;
  }
}

/// Mavjud [Meeting]dan ba'zi maydonlarini almashtirib, yangisini yaratadi.
/// `join` mock mutatsiyasi uchun ichki yordamchi — domen entitisi
/// (`Meeting`) o'zida ochiq `copyWith` olib yurmasligi uchun shu yerda
/// (data qatlamida) xususiy saqlangan.
Meeting _withUpdate(Meeting source, {String? joinUrl}) {
  return Meeting(
    id: source.id,
    title: source.title,
    description: source.description,
    startAt: source.startAt,
    durationMin: source.durationMin,
    host: source.host,
    participants: source.participants,
    status: source.status,
    joinUrl: joinUrl ?? source.joinUrl,
  );
}

/// Real backend implementatsiyasi — [DioClient] orqali.
///
/// Backend `Meeting` (Prisma) satri mobil [Meeting] entitisidan bir qancha
/// jihatdan farq qiladi — barcha moslashtirish shu faylning pastidagi
/// xususiy funksiyalarda (`_adapt*`) izohlangan:
/// - `GET /meetings` YALANG'OCH ro'yxat qaytaradi (mobil kutgani bilan mos),
///   lekin har bir elementning maydonlari boshqacha: `startAt`/`durationMin`
///   camelCase (mobil `start_at`/`duration_min` — snake_case — kutadi);
/// - `host`, `description`, `join_url` maydonlari backendda UMUMAN YO'Q —
///   ularning o'rniga mos ravishda `location`, `agenda` (kun tartibi
///   ro'yxati) ishlatiladi, `join_url` esa doim `null`;
/// - `participants` backendda ISHTIROKCHILAR SONI (`int`), mobil esa
///   ism-familiyalar RO'YXATINI (`List<String>`) kutadi — shu son
///   uzunlikdagi bo'sh ro'yxatga aylantiriladi (haqiqiy ismlar backendda
///   saqlanmagani uchun);
/// - `status` backend qiymatlari (`scheduled`/`ongoing`/`done`/`cancelled`)
///   mobil `MeetingStatus` enumiga (`rejalashtirilgan`/`jonli`/`tugagan`)
///   mos kelmaydi — kalit so'zlar bo'yicha moslashtiriladi;
/// - `GET /meetings/:id` va `POST /meetings/:id/join` endpointlari
///   UMUMAN YO'Q (`CatalogController`da faqat `GET/POST /meetings` va
///   `PATCH`/`DELETE /meetings/:id` bor) — pastdagi ikkala metodda ham
///   shunga qarab ishlaydi.
class MeetingsRemoteDataSourceApiImpl implements MeetingsRemoteDataSource {
  MeetingsRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<Meeting>> list({MeetingStatus? status}) async {
    try {
      // Backend `GET /meetings`da HECH QANDAY so'rov parametrini
      // qo'llab-quvvatlamaydi (`findMeetings()` argumentsiz) — shuning
      // uchun `status` filtri serverga yuborilmaydi, natija esa
      // moslashtirilgandan keyin mijoz tomonda filtrlanadi (`applications`
      // moduli bilan bir xil naqsh).
      final response = await _client.dio.get<List<dynamic>>('/meetings');
      final rows = response.data ?? const [];
      var result = rows
          .map(
            (e) =>
                Meeting.fromJson(_adaptMeetingJson(e as Map<String, dynamic>)),
          )
          .toList();
      if (status != null) {
        result = result.where((m) => m.status == status).toList();
      }
      return result;
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Meeting> getById(String id) async {
    try {
      // Backendda `GET /meetings/:id` YO'Q — shuning uchun to'liq ro'yxat
      // olinadi va ID bo'yicha shu yerda (mijoz tomonda) qidiriladi.
      final response = await _client.dio.get<List<dynamic>>('/meetings');
      final rows = response.data ?? const [];
      final index = rows.indexWhere(
        (e) => (e as Map<String, dynamic>)['id'] == id,
      );
      if (index == -1) {
        throw ServerException('Majlis topilmadi');
      }
      final rawMeeting = rows[index] as Map<String, dynamic>;
      return Meeting.fromJson(_adaptMeetingJson(rawMeeting));
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Meeting> join(String id) async {
    // Backendda majlisga "qo'shilish" (`POST /meetings/:id/join`)
    // endpointi HALI ISHLAB CHIQILMAGAN — mobil ilovadagi qo'ng'iroq
    // ekrani (`meeting_call_page.dart`) allaqachon to'liq mahalliy
    // simulyatsiya bo'lgani (haqiqiy `join_url`ga bog'liq emas) uchun,
    // tarmoqqa POST yubormasdan — shunchaki joriy majlis ma'lumotini
    // (`getById` orqali) qayta o'qib qaytaramiz, shunda foydalanuvchi
    // qo'ng'iroqqa xatosiz kira oladi.
    return getById(id);
  }
}

/// Backend `Meeting` (Prisma, camelCase) satrini mobil `Meeting.fromJson`
/// kutgan (snake_case, to'liq maydonli) shaklga moslashtiradi. Backendda
/// mavjud bo'lmagan maydonlar uchun oqilona standart qiymatlar qo'yiladi:
/// - `host` — backendda umuman yo'q (`location` maydoni bilan to'ldiriladi);
/// - `description` — backendda umuman yo'q (`agenda` — kun tartibi
///   ro'yxati — bitta matnga birlashtirilib qo'yiladi, bo'lmasa `null`);
/// - `participants` — backendda ISHTIROKCHILAR SONI (`int`), mobil esa
///   ism-familiyalar ro'yxatini kutadi — shu son uzunlikdagi bo'sh
///   qiymatlar ro'yxatiga aylantiriladi (UI faqat `.length`ni ko'rsatadi,
///   haqiqiy ismlar backendda saqlanmaydi);
/// - `join_url` — backendda umuman yo'q (`null`).
Map<String, dynamic> _adaptMeetingJson(Map<String, dynamic> raw) {
  final participantsCount = (raw['participants'] as num?)?.toInt() ?? 0;
  return {
    'id': raw['id'],
    'title': raw['title'],
    'description': _adaptDescriptionFromAgenda(raw['agenda'] as List<dynamic>?),
    'start_at': raw['startAt'],
    'duration_min': raw['duration_min'] ?? raw['durationMin'] ?? 0,
    'host': raw['location'] as String? ?? '',
    'participants': List<String>.filled(participantsCount, ''),
    'status': _meetingStatusFromApi(raw['status'] as String?),
    'join_url': null,
  };
}

/// `agenda` (kun tartibi bandlari ro'yxati) maydonini mobil `description`
/// (bitta matn) shakliga birlashtiradi — bo'sh yoki yo'q bo'lsa `null`
/// qaytaradi (`meeting_detail_page.dart` bunday holatda o'z standart
/// matnini — "tavsif yo'q" — ko'rsatadi).
String? _adaptDescriptionFromAgenda(List<dynamic>? agenda) {
  if (agenda == null || agenda.isEmpty) return null;
  return agenda.map((e) => e.toString()).join('\n');
}

/// Backend `MeetingStatus` (`scheduled`/`ongoing`/`done`/`cancelled`)
/// qiymatini mobil `MeetingStatus` enum NOMIGA moslashtiradi. Aniq
/// ro'yxatdagidan tashqari qiymatlar ham (masalan kelajakda qo'shilishi
/// mumkin bo'lgan sinonimlar) kalit so'zlar bo'yicha kengroq tutiladi —
/// tanilmagan/`cancelled` qiymat "rejalashtirilgan"ga tushadi (xavfsiz
/// standart — UI'da "qo'shilish" tugmasi ko'rsatiladi, lekin ekran
/// buzilmaydi).
String _meetingStatusFromApi(String? apiStatus) {
  final normalized = (apiStatus ?? '').toLowerCase();
  if (normalized.contains('done') ||
      normalized.contains('end') ||
      normalized.contains('complete') ||
      normalized.contains('tugagan')) {
    return MeetingStatus.tugagan.name;
  }
  if (normalized.contains('live') ||
      normalized.contains('jonli') ||
      normalized.contains('ongoing') ||
      normalized.contains('active')) {
    return MeetingStatus.jonli.name;
  }
  return MeetingStatus.rejalashtirilgan.name;
}
