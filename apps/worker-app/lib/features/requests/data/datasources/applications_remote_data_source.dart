import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/mock/mock_applications.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';

/// Fuqarolar murojaatlari (arizalar) uchun masofaviy ma'lumot manbai.
abstract class ApplicationsRemoteDataSource {
  Future<List<Application>> list({
    bool assignedOnly = false,
    ApplicationStatus? status,
    String? query,
  });

  Future<Application> getById(String id);

  Future<Application> respond(String id, ApplicationResponse response);

  Future<Application> rate(String id, int points);
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_applications.dart`dagi
/// xotiradagi ro'yxat bilan ishlaydi.
class ApplicationsRemoteDataSourceMockImpl
    implements ApplicationsRemoteDataSource {
  @override
  Future<List<Application>> list({
    bool assignedOnly = false,
    ApplicationStatus? status,
    String? query,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var result = List<Application>.of(mockApplications);
    if (assignedOnly) {
      result = result.where((a) => a.assignedToMe).toList();
    }
    if (status != null) {
      result = result.where((a) => a.status == status).toList();
    }
    final normalizedQuery = query?.trim().toLowerCase();
    if (normalizedQuery != null && normalizedQuery.isNotEmpty) {
      result = result
          .where(
            (a) =>
                a.title.toLowerCase().contains(normalizedQuery) ||
                a.description.toLowerCase().contains(normalizedQuery) ||
                a.category.toLowerCase().contains(normalizedQuery),
          )
          .toList();
    }
    return List.unmodifiable(result);
  }

  @override
  Future<Application> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockApplications.indexWhere((a) => a.id == id);
    if (index == -1) throw ServerException('Ariza topilmadi: $id');
    return mockApplications[index];
  }

  @override
  Future<Application> respond(String id, ApplicationResponse response) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final index = mockApplications.indexWhere((a) => a.id == id);
    if (index == -1) throw ServerException('Ariza topilmadi: $id');
    final updated = _withUpdate(
      mockApplications[index],
      status: ApplicationStatus.javobBerildi,
      response: response,
    );
    mockApplications[index] = updated;
    return updated;
  }

  @override
  Future<Application> rate(String id, int points) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockApplications.indexWhere((a) => a.id == id);
    if (index == -1) throw ServerException('Ariza topilmadi: $id');
    final updated = _withUpdate(mockApplications[index], points: points);
    mockApplications[index] = updated;
    return updated;
  }
}

/// Mavjud [Application]dan ba'zi maydonlarini almashtirib, yangisini
/// yaratadi. `respond`/`rate` mock mutatsiyalari uchun ichki yordamchi —
/// domen entitisi (`Application`) o'zida ochiq `copyWith` olib
/// yurmasligi uchun shu yerda (data qatlamida) xususiy saqlangan.
Application _withUpdate(
  Application source, {
  ApplicationStatus? status,
  int? points,
  ApplicationResponse? response,
}) {
  return Application(
    id: source.id,
    title: source.title,
    description: source.description,
    category: source.category,
    status: status ?? source.status,
    priority: source.priority,
    createdAt: source.createdAt,
    deadline: source.deadline,
    assignedToMe: source.assignedToMe,
    points: points ?? source.points,
    attachments: source.attachments,
    response: response ?? source.response,
    citizenName: source.citizenName,
    citizenPhone: source.citizenPhone,
  );
}

/// Real backend implementatsiyasi — [DioClient] orqali,
/// `murojaatnoma.uz`dagi `applications` moduliga ulanadi.
///
/// Backend `Application` (Prisma) satri mobil [Application] entitisidan
/// bir qancha jihatdan farq qiladi — barcha moslashtirish shu faylning
/// pastidagi xususiy funksiyalarda (`_adapt*`) izohlangan:
/// - maydon nomlari camelCase (`subject`, `applicantFullName`, ...),
///   mobil esa snake_case (`title`, `citizen_name`, ...) kutadi;
/// - `GET /applications` sahifalangan konvertda (`{data,total,page,limit}`)
///   qaytadi, mobil esa yalang'och ro'yxat kutadi;
/// - backendda `category`, `priority`, `points` (ball) va `deadline`
///   maydonlari UMUMAN YO'Q — standart qiymatlar qo'yiladi;
/// - `assigned_to_me` backendda yo'q — `assignedEmployeeId`ni joriy
///   xodim ID'i (`SharedPreferences`dagi sessiya) bilan solishtirib
///   hisoblanadi;
/// - `attachments`/`response` `Application` satrida emas, alohida
///   `/attachments` va `/messages` sub-resurslarida saqlanadi.
class ApplicationsRemoteDataSourceApiImpl
    implements ApplicationsRemoteDataSource {
  ApplicationsRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  /// Sessiya `AuthRepositoryImpl` tomonidan shu kalit ostida
  /// (`worker_session`, `AuthSessionModel.toJson()`) saqlanadi — bu yerda
  /// faqat `worker_id`ni o'qish uchun ishlatiladi (joriy xodimga
  /// biriktirilganligini — `assigned_to_me` — hisoblash uchun).
  static const _sessionPrefsKey = 'worker_session';

  Future<String?> _currentEmployeeId() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_sessionPrefsKey);
    if (raw == null) return null;
    try {
      final session = jsonDecode(raw) as Map<String, dynamic>;
      return session['worker_id'] as String?;
    } on Object {
      return null;
    }
  }

  /// Sub-resurs ro'yxatini BEST-EFFORT o'qiydi — xato bo'lsa (masalan
  /// bo'sh/404/vaqtinchalik nosozlik) bo'sh ro'yxat qaytaradi va
  /// chaqiruvchini (ariza tafsiloti) yiqitmaydi.
  Future<List<dynamic>> _bestEffortList(String path) async {
    try {
      final resp = await _client.dio.get<List<dynamic>>(path);
      return resp.data ?? const [];
    } on Object {
      return const [];
    }
  }

  @override
  Future<List<Application>> list({
    bool assignedOnly = false,
    ApplicationStatus? status,
    String? query,
  }) async {
    try {
      final apiStatus = status == null ? null : _statusToApi(status);
      final currentEmployeeId = await _currentEmployeeId();
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/applications',
        queryParameters: {
          // Backendda "sahifa" tushunchasi bor, mobil esa yalang'och
          // ro'yxat kutadi — shuning uchun bitta katta sahifa so'raladi
          // (`limit: 100`) va natija to'liq ro'yxat sifatida qaytariladi.
          'page': 1,
          'limit': 100,
          // `yopildi` holatining backendda analogi yo'q (`_statusToApi`
          // `null` qaytaradi) — bunday holda filtr faqat mijoz tomonda
          // (pastda) qo'llaniladi, chunki serverga yuborsa bo'lmaydi.
          if (apiStatus != null) 'status': apiStatus,
        },
      );
      final envelope = response.data ?? const <String, dynamic>{};
      final rows = (envelope['data'] as List<dynamic>?) ?? const [];

      var result = rows
          .map(
            (e) => Application.fromJson(
              _adaptApplicationJson(
                e as Map<String, dynamic>,
                currentEmployeeId: currentEmployeeId,
              ),
            ),
          )
          .toList();

      // Backend `/applications`da `assigned_only`/erkin qidiruv
      // parametrlarini QO'LLAB-QUVVATLAMAYDI (`ListApplicationsQueryDto`da
      // faqat `page`/`limit`/`status` bor) — shuning uchun bu filtrlar
      // mijoz tomonda qo'llaniladi. `status` ham (backendda mos kelmagan
      // qiymat — `yopildi` — uchun) ikkinchi marta shu yerda tekshiriladi.
      if (assignedOnly) {
        result = result.where((a) => a.assignedToMe).toList();
      }
      if (status != null) {
        result = result.where((a) => a.status == status).toList();
      }
      final normalizedQuery = query?.trim().toLowerCase();
      if (normalizedQuery != null && normalizedQuery.isNotEmpty) {
        result = result
            .where(
              (a) =>
                  a.title.toLowerCase().contains(normalizedQuery) ||
                  a.description.toLowerCase().contains(normalizedQuery) ||
                  a.category.toLowerCase().contains(normalizedQuery),
            )
            .toList();
      }
      return result;
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Application> getById(String id) async {
    try {
      final currentEmployeeId = await _currentEmployeeId();
      // Asosiy ariza — MAJBURIY. Biriktirmalar (`/attachments`) va xabarlar
      // (`/messages`) sub-resurslari BEST-EFFORT: biri xato bersa (bo'sh/404/
      // vaqtincha nosozlik) ham ariza tafsiloti baribir ko'rsatiladi. Avval
      // uchtasi `Future.wait`da edi — sub-resurslardan biri yiqilsa, allaqachon
      // muvaffaqiyatli yuklangan arizani ham yo'qotib, butun ekran xato berardi.
      final applicationResp = await _client.dio.get<Map<String, dynamic>>(
        '/applications/$id',
      );
      final applicationJson =
          applicationResp.data ?? const <String, dynamic>{};
      final attachmentsJson = await _bestEffortList(
        '/applications/$id/attachments',
      );
      final messagesJson = await _bestEffortList('/applications/$id/messages');

      return Application.fromJson(
        _adaptApplicationJson(
          applicationJson,
          currentEmployeeId: currentEmployeeId,
          attachments: attachmentsJson
              .map((e) => _adaptAttachmentJson(e as Map<String, dynamic>))
              .toList(),
          response: _adaptResponseFromMessages(messagesJson),
        ),
      );
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Application> respond(String id, ApplicationResponse response) async {
    try {
      // Backendda javob yozish `POST /applications/:id/reply`
      // (`ReplyApplicationDto: {text, attachmentUrl?}`) orqali amalga
      // oshadi va yaratilgan XABARni qaytaradi (yangilangan `Application`
      // emas) — shuning uchun javobdan so'ng pastda `getById` bilan
      // to'liq murojaat qayta o'qiladi.
      //
      // MUHIM CHEKLOV: mobil ilovada biriktirmalar (`AttachmentRef.path`)
      // — bu qurilmadagi MAHALLIY fayl yo'li (masalan `image_picker`dan),
      // backend esa faqat ALLAQACHON joylashtirilgan URL qabul qiladi
      // (`@IsUrl()`) va hozircha bu loyihada mahalliy faylni yuklab URL
      // olish (CDN upload) oqimi YO'Q. Shu sabab, faqat `http(s)://` bilan
      // boshlanadigan (ya'ni haqiqatda URL bo'lgan) birinchi biriktirma
      // yuboriladi — qolgan/mahalliy biriktirmalar jim tashlab
      // ketiladi (quyidagi hisobotga qarang).
      final urlAttachments = response.attachments.where(
        (a) => a.path.startsWith('http'),
      );
      final firstUrlAttachment = urlAttachments.isEmpty
          ? null
          : urlAttachments.first;

      await _client.dio.post<Map<String, dynamic>>(
        '/applications/$id/reply',
        data: {
          'text': response.text,
          if (firstUrlAttachment != null)
            'attachmentUrl': firstUrlAttachment.path,
        },
      );

      return await getById(id);
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Application> rate(String id, int points) async {
    // Backend `applications` modulida ball/baho ("rate") tushunchasi
    // UMUMAN YO'Q — na `Application` jadvalida mos maydon, na alohida
    // endpoint bor (`ApplicationsController`da faqat `create`/`findAll`/
    // `findOne`/`updateStatus`/`assign`/`events`/`reply`/`messages`/
    // `attachments` mavjud). Shu sababli bu amal hozircha real backendda
    // qo'llab-quvvatlanmaydi — mock rejimda ishlashda davom etadi.
    // Foydalanuvchiga ichki tafsilot ("real serverda") ko'rsatilmaydi —
    // neytral xabar (idealda bu amal real rejimda UI'dan yashiriladi).
    throw ServerException('Baholash hozircha mavjud emas');
  }
}

/// Backend `Application` (Prisma, camelCase) satrini mobil
/// `Application.fromJson` kutgan (snake_case, to'liq maydonli) shaklga
/// moslashtiradi. Backendda mavjud bo'lmagan maydonlar uchun oqilona
/// standart qiymatlar qo'yiladi:
/// - `category` — backendda umuman yo'q ("Umumiy" bilan to'ldiriladi);
/// - `priority` — backendda umuman yo'q ("o'rta" bilan to'ldiriladi);
/// - `points` — backendda umuman yo'q (`0` bilan to'ldiriladi);
/// - `deadline` — backendda umuman yo'q (`null`).
Map<String, dynamic> _adaptApplicationJson(
  Map<String, dynamic> json, {
  required String? currentEmployeeId,
  List<Map<String, dynamic>> attachments = const [],
  Map<String, dynamic>? response,
}) {
  final assignedEmployeeId = json['assignedEmployeeId'] as String?;
  return {
    'id': json['id'],
    'title': json['subject'],
    'description': json['description'],
    'category': 'Umumiy',
    'status': _statusFromApi(json['status'] as String?),
    'priority': ApplicationPriority.orta.name,
    'created_at': json['createdAt'],
    'deadline': null,
    'assigned_to_me':
        currentEmployeeId != null && assignedEmployeeId == currentEmployeeId,
    'points': 0,
    'attachments': attachments,
    'response': response,
    'citizen_name': json['applicantFullName'],
    'citizen_phone': json['applicantPhone'],
  };
}

/// Backend `Attachment` (Prisma) satrini mobil `AttachmentRef.fromJson`
/// shakliga moslashtiradi. Backendda faqat `PHOTO`/`VIDEO` turlari bor
/// (`file`/`voice` yo'q) va `durationMs` umuman kuzatilmaydi.
Map<String, dynamic> _adaptAttachmentJson(Map<String, dynamic> json) {
  final apiType = json['type'] as String?;
  final url = json['url'] as String?;
  return {
    'type': apiType == 'VIDEO'
        ? AttachmentType.video.name
        : AttachmentType.image.name,
    'path': url,
    'name': (json['fileName'] as String?) ?? url,
    'size_bytes': json['sizeBytes'],
    'duration_ms': null,
  };
}

/// `/applications/:id/messages` ro'yxatidagi ENG SO'NGGI xodim (`EMPLOYEE`)
/// xabarini mobil `ApplicationResponse.fromJson` shakliga moslashtiradi —
/// backendda alohida "javob" (`response`) obyekti yo'q, u chat
/// xabarlaridan (`ApplicationMessage`) hisoblab chiqariladi. Xodim hali
/// javob yozmagan bo'lsa — `null`.
Map<String, dynamic>? _adaptResponseFromMessages(List<dynamic> messages) {
  Map<String, dynamic>? lastEmployeeMessage;
  for (final raw in messages) {
    final message = raw as Map<String, dynamic>;
    if (message['senderRole'] == 'EMPLOYEE') {
      lastEmployeeMessage = message;
    }
  }
  if (lastEmployeeMessage == null) return null;

  final attachmentUrl = lastEmployeeMessage['attachmentUrl'] as String?;
  return {
    'text': lastEmployeeMessage['text'],
    'attachments': attachmentUrl == null
        ? const <Map<String, dynamic>>[]
        : [
            {
              'type': AttachmentType.image.name,
              'path': attachmentUrl,
              'name': attachmentUrl,
              'size_bytes': null,
              'duration_ms': null,
            },
          ],
    'responded_at': lastEmployeeMessage['createdAt'],
  };
}

/// Backend `ApplicationStatus` (`NEW`/`IN_PROGRESS`/`RESOLVED`/`REJECTED`)
/// qiymatini mobil `ApplicationStatus` enum nomiga o'giradi.
String _statusFromApi(String? apiStatus) {
  switch (apiStatus) {
    case 'IN_PROGRESS':
      return ApplicationStatus.jarayonda.name;
    case 'RESOLVED':
      return ApplicationStatus.javobBerildi.name;
    case 'REJECTED':
      return ApplicationStatus.rad.name;
    case 'NEW':
    default:
      return ApplicationStatus.yangi.name;
  }
}

/// Mobil `ApplicationStatus`ni backend enumiga o'giradi. `yopildi`ning
/// backendda analogi YO'Q (backendda "yopilgan" alohida holat sifatida
/// mavjud emas — `RESOLVED`/`REJECTED`dan keyin boshqa o'tish yo'q) —
/// shu holatda `null` qaytariladi va chaqiruvchi filtrni faqat mijoz
/// tomonda qo'llaydi.
String? _statusToApi(ApplicationStatus status) {
  switch (status) {
    case ApplicationStatus.yangi:
      return 'NEW';
    case ApplicationStatus.jarayonda:
      return 'IN_PROGRESS';
    case ApplicationStatus.javobBerildi:
      return 'RESOLVED';
    case ApplicationStatus.rad:
      return 'REJECTED';
    case ApplicationStatus.yopildi:
      return null;
  }
}
