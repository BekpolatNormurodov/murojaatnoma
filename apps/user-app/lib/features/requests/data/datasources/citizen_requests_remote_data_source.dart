import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:user_app/core/mock/mock_citizen_requests.dart';
import 'package:user_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/entities/request_message.dart';

/// Fuqaro arizalari/shikoyatlari (+ ular mavzusidagi xabarlar/thread) uchun
/// masofaviy ma'lumot manbai.
abstract class CitizenRequestsRemoteDataSource {
  Future<List<CitizenRequest>> list({
    RequestKind? kind,
    RequestStatus? status,
    String? query,
  });

  Future<CitizenRequest> getById(String id);

  Future<CitizenRequest> submit(CitizenRequest draft);

  /// Bitta murojaat mavzusidagi barcha xabarlarni (fuqaro savollari + xodim
  /// javoblari) xronologik tartibda oladi.
  Future<List<RequestMessage>> getMessages(String requestId);

  /// Murojaat mavzusiga fuqaro nomidan yangi xabar yozadi.
  Future<RequestMessage> sendMessage(String requestId, String text);
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_citizen_requests.dart`dagi
/// xotiradagi ro'yxat bilan ishlaydi.
class CitizenRequestsRemoteDataSourceMockImpl
    implements CitizenRequestsRemoteDataSource {
  @override
  Future<List<CitizenRequest>> list({
    RequestKind? kind,
    RequestStatus? status,
    String? query,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var result = List<CitizenRequest>.of(mockCitizenRequests);
    if (kind != null) {
      result = result.where((r) => r.kind == kind).toList();
    }
    if (status != null) {
      result = result.where((r) => r.status == status).toList();
    }
    final normalizedQuery = query?.trim().toLowerCase();
    if (normalizedQuery != null && normalizedQuery.isNotEmpty) {
      result = result
          .where(
            (r) =>
                r.title.toLowerCase().contains(normalizedQuery) ||
                r.body.toLowerCase().contains(normalizedQuery) ||
                r.category.toLowerCase().contains(normalizedQuery),
          )
          .toList();
    }
    return List.unmodifiable(result);
  }

  @override
  Future<CitizenRequest> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockCitizenRequests.indexWhere((r) => r.id == id);
    if (index == -1) throw ServerException('Murojaat topilmadi: $id');
    return mockCitizenRequests[index];
  }

  @override
  Future<CitizenRequest> submit(CitizenRequest draft) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));

    if (draft.title.trim().isEmpty ||
        draft.body.trim().isEmpty ||
        draft.category.trim().isEmpty) {
      throw ServerException("Barcha majburiy maydonlarni to'ldiring");
    }

    final created = CitizenRequest(
      id: 'CR-${DateTime.now().millisecondsSinceEpoch}',
      kind: draft.kind,
      category: draft.category,
      title: draft.title.trim(),
      body: draft.body.trim(),
      status: RequestStatus.yuborilgan,
      createdAt: DateTime.now().toIso8601String(),
      attachments: draft.attachments,
    );
    mockCitizenRequests.insert(0, created);
    return created;
  }

  @override
  Future<List<RequestMessage>> getMessages(String requestId) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final existing = mockCitizenRequestMessages[requestId];
    if (existing != null) return List.unmodifiable(existing);

    // Birinchi chaqiruv — mavjud bo'lsa eski `response` maydonidan
    // boshlang'ich thread'ni tuzib, keyingi safar uchun xotirada saqlaydi.
    final index = mockCitizenRequests.indexWhere((r) => r.id == requestId);
    final seeded = index == -1
        ? <RequestMessage>[]
        : seedMockMessagesFor(mockCitizenRequests[index]);
    mockCitizenRequestMessages[requestId] = seeded;
    return List.unmodifiable(seeded);
  }

  @override
  Future<RequestMessage> sendMessage(String requestId, String text) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final trimmed = text.trim();
    if (trimmed.isEmpty) {
      throw ServerException('Xabar matnini kiriting');
    }

    final message = RequestMessage(
      id: 'MSG-${DateTime.now().millisecondsSinceEpoch}',
      senderRole: RequestMessageSenderRole.citizen,
      senderName: 'Siz',
      text: trimmed,
      createdAt: DateTime.now().toIso8601String(),
    );
    mockCitizenRequestMessages.putIfAbsent(requestId, () => []).add(message);
    return message;
  }
}

/// `RequestKind`/`RequestStatus` — backendning `Application` modelida
/// mos ravishda hech qanday/`ApplicationStatus` maydoni bilan ifodalanadi.
/// Backendda `kind`/`category` maydonlari YO'Q — shu tufayli ular `subject`
/// maydoni ichiga qavariq (bracket) prefiks sifatida kodlanadi:
/// `"[ARIZA|Kommunal xizmat] Sarlavha matni"`. Bu formatda kelmagan
/// (masalan boshqa kanaldan yaratilgan) murojaatlar ham xavfsiz —
/// [_decodeSubject] standart qiymatlarga (ariza/bo'sh kategoriya) tushadi,
/// hech qachon qulamaydi.
const Map<RequestKind, String> _kindTags = {
  RequestKind.ariza: 'ARIZA',
  RequestKind.shikoyat: 'SHIKOYAT',
};

final RegExp _subjectPattern = RegExp(
  r'^\[(ARIZA|SHIKOYAT)\|([^\]]*)\]\s*(.*)$',
  dotAll: true,
);

String _encodeSubject({
  required RequestKind kind,
  required String category,
  required String title,
}) {
  final tag = _kindTags[kind] ?? _kindTags[RequestKind.ariza]!;
  // `[`/`]`/`|` kategoriya ichida bo'lsa kodlash formatini buzadi — shu
  // uchtasi bo'sh joyga almashtiriladi (kamdan-kam holat, lekin xavfsizlik
  // uchun).
  final safeCategory = category.trim().replaceAll(RegExp(r'[\[\]|]'), ' ');
  return '[$tag|$safeCategory] ${title.trim()}';
}

({RequestKind kind, String category, String title}) _decodeSubject(
  String subject,
) {
  final match = _subjectPattern.firstMatch(subject);
  if (match == null) {
    return (kind: RequestKind.ariza, category: '', title: subject);
  }
  final kind = match.group(1) == 'SHIKOYAT'
      ? RequestKind.shikoyat
      : RequestKind.ariza;
  final category = (match.group(2) ?? '').trim();
  final title = (match.group(3) ?? '').trim();
  return (
    kind: kind,
    category: category,
    title: title.isEmpty ? subject : title,
  );
}

RequestStatus _statusFromApi(String? raw) => switch (raw) {
  'NEW' => RequestStatus.yuborilgan,
  'IN_PROGRESS' => RequestStatus.korilmoqda,
  'RESOLVED' => RequestStatus.javobBerildi,
  'REJECTED' => RequestStatus.yopildi,
  // Noma'lum/bo'sh qiymat — eng xavfsiz standart ("yangi yuborilgan").
  _ => RequestStatus.yuborilgan,
};

String _statusToApi(RequestStatus status) => switch (status) {
  RequestStatus.yuborilgan => 'NEW',
  RequestStatus.korilmoqda => 'IN_PROGRESS',
  RequestStatus.javobBerildi => 'RESOLVED',
  RequestStatus.yopildi => 'REJECTED',
};

/// Telefon raqamlarini solishtirish/serverga yuborish uchun bo'sh joy va
/// boshqa bo'lmaydigan belgilarni tozalaydi (`+`dan boshqa) — masalan
/// `PhoneInputPage` "`+998 901234567`" (oraliq bo'shliq bilan) uzatadi,
/// backend esa qat'iy E.164 (bo'shliqsiz) formatni talab qiladi.
String _normalizePhone(String raw) =>
    raw.replaceAll(RegExp('[^0-9+]'), '').trim();

/// Backendning `Application` JSON'ini `CitizenRequest` domen entity'siga
/// o'giradi. Har bir maydon himoyalangan (`as String?` + fallback) — server
/// javobi kutilmagan shaklda bo'lsa ham qulamaydi.
CitizenRequest _requestFromApplicationJson(Map<String, dynamic> json) {
  final decoded = _decodeSubject(json['subject'] as String? ?? '');
  return CitizenRequest(
    id: json['id'] as String? ?? '',
    kind: decoded.kind,
    category: decoded.category,
    title: decoded.title,
    body: json['description'] as String? ?? '',
    status: _statusFromApi(json['status'] as String?),
    createdAt: json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
    // `attachments` ataylab berilmaydi (standart `const []` ga tushadi) —
    // backendda bitta "rasmiy javob" maydoni yo'q, javoblar endi to'liq
    // xabarlar (thread) orqali keladi (qarang: `getMessages`).
  );
}

/// `DioException`dan foydalanuvchiga ko'rsatsa bo'ladigan xabarni ajratib
/// oladi — backend (`NestJS`) standart xatolik shakli
/// `{statusCode, message, error}` bo'lib, `message` string YOKI
/// (`class-validator`dan) string ro'yxati bo'lishi mumkin.
String _extractErrorMessage(DioException e) {
  final data = e.response?.data;
  if (data is Map<String, dynamic>) {
    final message = data['message'];
    if (message is String && message.isNotEmpty) return message;
    if (message is List && message.isNotEmpty) {
      return message.map((m) => m.toString()).join('\n');
    }
  }
  return e.message ?? 'Server xatosi';
}

/// Real backend implementatsiyasi — `POST/GET https://murojaatnoma.uz/api
/// /applications*` orqali ishlaydi.
///
/// `AuthRepository`/`RegistrationRepository`ga bog'liq — chunki
/// `/applications` (POST) va `/applications/:id/messages` (POST)
/// `applicantFullName`/`applicantPhone`/`senderName`ni talab qiladi, bular
/// esa `CitizenRequest`/`RequestMessage` domenida emas (fuqaroning o'zi
/// haqidagi ma'lumot), balki joriy sessiya (`AuthRepository.currentSession`)
/// va ro'yxatdan o'tish profilida (`RegistrationRepository.getProfile`)
/// saqlanadi — bu ikkalasi ham `/applications/submit`/`/register`
/// bosqichlaridan keyin allaqachon to'ldirilgan bo'ladi (qarang:
/// `redirect_policy.dart`: `/applications/*` faqat `registered == true`
/// bo'lgandan keyin ochiladi).
class CitizenRequestsApiImpl implements CitizenRequestsRemoteDataSource {
  CitizenRequestsApiImpl(
    this._client, {
    required AuthRepository authRepository,
    required RegistrationRepository registrationRepository,
  }) : _authRepository = authRepository,
       _registrationRepository = registrationRepository;

  final DioClient _client;
  final AuthRepository _authRepository;
  final RegistrationRepository _registrationRepository;

  /// Joriy fuqaroning telefon raqamini (normallashtirilgan) qaytaradi —
  /// sessiya topilmasa bo'sh satr (chaqiruvchilar bo'sh satrni "noma'lum"
  /// deb talqin qiladi).
  Future<String> _currentPhone() async {
    final session = await _authRepository.currentSession();
    return _normalizePhone(session?.phone ?? '');
  }

  /// Yuborish/xabar uchun ko'rsatiladigan to'liq ism — avval ro'yxatdan
  /// o'tish profilidan (eng ishonchli manba), keyin sessiya nomidan, oxirida
  /// telefon raqamidan (hech biri bo'lmasa) olinadi.
  Future<String> _currentFullName(String fallbackPhone) async {
    final profileResult = await _registrationRepository.getProfile();
    final profile = profileResult.fold((_) => null, (p) => p);
    final profileName = profile?.fullName.trim();
    if (profileName != null && profileName.isNotEmpty) return profileName;

    final session = await _authRepository.currentSession();
    final sessionName = session?.name.trim();
    if (sessionName != null && sessionName.isNotEmpty) return sessionName;

    return fallbackPhone.isEmpty ? 'Fuqaro' : fallbackPhone;
  }

  @override
  Future<List<CitizenRequest>> list({
    RequestKind? kind,
    RequestStatus? status,
    String? query,
  }) async {
    try {
      final phone = await _currentPhone();
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/applications',
        queryParameters: {
          'page': 1,
          // Backendda `limit` maksimal 100 (qat'iy validatsiya) — hozircha
          // sahifalash UI'i yo'q, shuning uchun bitta katta sahifa olinadi.
          'limit': 100,
          if (status != null) 'status': _statusToApi(status),
        },
      );

      // `Paginated<Application>` shakli `{data, total, page, limit}` —
      // `items` ham qo'shimcha ehtiyot chorasi sifatida tekshiriladi (agar
      // backend javob shaklini kelajakda o'zgartirsa ham qulamasligi
      // uchun).
      final body = response.data ?? const <String, dynamic>{};
      final rawList =
          (body['items'] ?? body['data']) as List<dynamic>? ?? const [];

      // `GET /applications` HAR BIR fuqaroning murojaatini qaytaradi
      // (backendda telefon bo'yicha filtr yo'q) — shu tufayli faqat joriy
      // fuqaroning o'ziga tegishlilari (`applicantPhone` mos keladiganlari)
      // ushbu qatlamda ajratib olinadi, aks holda boshqa fuqarolarning
      // murojaatlari "Murojaatlarim"da ko'rinib qolar edi.
      final ownRaw = phone.isEmpty
          ? rawList.whereType<Map<String, dynamic>>()
          : rawList.whereType<Map<String, dynamic>>().where((m) {
              final applicantPhone = _normalizePhone(
                m['applicantPhone'] as String? ?? '',
              );
              return applicantPhone == phone;
            });

      var items = ownRaw.map(_requestFromApplicationJson).toList();

      if (kind != null) {
        items = items.where((r) => r.kind == kind).toList();
      }
      final normalizedQuery = query?.trim().toLowerCase();
      if (normalizedQuery != null && normalizedQuery.isNotEmpty) {
        items = items
            .where(
              (r) =>
                  r.title.toLowerCase().contains(normalizedQuery) ||
                  r.body.toLowerCase().contains(normalizedQuery) ||
                  r.category.toLowerCase().contains(normalizedQuery),
            )
            .toList();
      }
      return items;
    } on DioException catch (e) {
      throw ServerException(_extractErrorMessage(e));
    }
  }

  @override
  Future<CitizenRequest> getById(String id) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/applications/$id',
      );
      return _requestFromApplicationJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(_extractErrorMessage(e));
    }
  }

  @override
  Future<CitizenRequest> submit(CitizenRequest draft) async {
    try {
      final phone = await _currentPhone();
      final fullName = await _currentFullName(phone);

      final response = await _client.dio.post<Map<String, dynamic>>(
        '/applications',
        data: {
          'applicantFullName': fullName,
          'applicantPhone': phone,
          'subject': _encodeSubject(
            kind: draft.kind,
            category: draft.category,
            title: draft.title,
          ),
          'description': draft.body,
        },
      );
      return _requestFromApplicationJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(_extractErrorMessage(e));
    }
  }

  @override
  Future<List<RequestMessage>> getMessages(String requestId) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/applications/$requestId/messages',
      );
      final data = response.data ?? const [];
      return data
          .whereType<Map<String, dynamic>>()
          .map(RequestMessage.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ServerException(_extractErrorMessage(e));
    }
  }

  @override
  Future<RequestMessage> sendMessage(String requestId, String text) async {
    try {
      final trimmed = text.trim();
      final phone = await _currentPhone();
      final senderName = await _currentFullName(phone);

      final response = await _client.dio.post<Map<String, dynamic>>(
        '/applications/$requestId/messages',
        data: {
          'senderRole': 'CITIZEN',
          'senderName': senderName,
          'text': trimmed,
        },
      );
      return RequestMessage.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(_extractErrorMessage(e));
    }
  }
}
