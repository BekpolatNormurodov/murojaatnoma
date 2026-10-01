import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/mock/mock_chat.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';

/// The admin↔employee "chat" module conversation ids (backend `chat` module),
/// distinct from the `/applications` (murojaat) task-threads. The group thread
/// and the caller's own admin DM are served by the employee-scoped
/// `/chat/my/conversations*` endpoints.
const String _kGroupId = 'group-all';
const String _kDmPrefix = 'dm-emp-';
bool _isChatModuleId(String id) => id == _kGroupId || id.startsWith(_kDmPrefix);

/// Xabarlar (chat) moduli uchun masofaviy ma'lumot manbai.
abstract class ChatRemoteDataSource {
  Future<List<Conversation>> conversations({
    ConversationType? type,
    String? query,
  });

  Future<List<Message>> messages(String conversationId);

  Future<Message> sendMessage({
    required String conversationId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  });
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_chat.dart`dagi xotiradagi
/// ro'yxatlar bilan ishlaydi.
class ChatRemoteDataSourceMockImpl implements ChatRemoteDataSource {
  @override
  Future<List<Conversation>> conversations({
    ConversationType? type,
    String? query,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var result = List<Conversation>.of(mockConversations);
    if (type != null) {
      result = result.where((c) => c.type == type).toList();
    }
    final normalizedQuery = query?.trim().toLowerCase();
    if (normalizedQuery != null && normalizedQuery.isNotEmpty) {
      result = result
          .where((c) => c.title.toLowerCase().contains(normalizedQuery))
          .toList();
    }
    return List.unmodifiable(result);
  }

  @override
  Future<List<Message>> messages(String conversationId) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final exists = mockConversations.any((c) => c.id == conversationId);
    if (!exists) throw ServerException('Suhbat topilmadi: $conversationId');

    return List.unmodifiable(
      mockMessages.where((m) => m.conversationId == conversationId),
    );
  }

  @override
  Future<Message> sendMessage({
    required String conversationId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final index = mockConversations.indexWhere((c) => c.id == conversationId);
    if (index == -1) {
      throw ServerException('Suhbat topilmadi: $conversationId');
    }

    final now = DateTime.now().toIso8601String();
    final message = Message(
      id: 'MSG-${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      senderId: 'me',
      senderName: 'Siz',
      isMine: true,
      type: type,
      text: text,
      attachment: attachment,
      stickerId: stickerId,
      createdAt: now,
      status: MessageStatus.yuborildi,
    );
    mockMessages.add(message);
    mockConversations[index] = _withUpdate(
      mockConversations[index],
      lastMessagePreview: _previewFor(type: type, text: text),
      lastMessageAt: now,
    );

    return message;
  }
}

/// Xabar turiga qarab ro'yxatda ko'rsatiladigan qisqa "oxirgi xabar"
/// matnini hosil qiladi.
String _previewFor({required MessageType type, String? text}) {
  return switch (type) {
    MessageType.text => text ?? '',
    MessageType.image => 'Rasm',
    MessageType.file => 'Fayl',
    MessageType.voice => 'Ovozli xabar',
    MessageType.roundVideo => 'Video xabar',
    MessageType.sticker => 'Stiker',
    MessageType.call => "Qo'ng'iroq",
  };
}

/// Mavjud [Conversation]dan ba'zi maydonlarini almashtirib, yangisini
/// yaratadi. `sendMessage` mock mutatsiyasi uchun ichki yordamchi —
/// domen entitisi (`Conversation`) o'zida ochiq `copyWith` olib
/// yurmasligi uchun shu yerda (data qatlamida) xususiy saqlangan.
Conversation _withUpdate(
  Conversation source, {
  String? lastMessagePreview,
  String? lastMessageAt,
}) {
  return Conversation(
    id: source.id,
    type: source.type,
    title: source.title,
    avatarUrl: source.avatarUrl,
    participants: source.participants,
    lastMessagePreview: lastMessagePreview ?? source.lastMessagePreview,
    lastMessageAt: lastMessageAt ?? source.lastMessageAt,
    unreadCount: source.unreadCount,
  );
}

/// Real backend implementatsiyasi — [DioClient] orqali.
///
/// MUHIM: real backendda alohida "chat/suhbat" resursi yo'q — u faqat
/// `/applications/:id/messages` orqali bitta murojaat (ariza) ostidagi
/// xabarlar tarixini beradi (`apps/backend/src/modules/applications`,
/// `ApplicationsController.addMessage`/`findMessages`). Shu sababli bu
/// yerda "suhbat" (conversation) tushunchasi bitta murojaatga (Application)
/// mos keladi:
///  - [messages]/[sendMessage] — to'g'ridan-to'g'ri `/applications/:id/messages`.
///  - [conversations] — backendda mustaqil "suhbatlar ro'yxati" endpoint'i
///    yo'qligi sababli `GET /applications` (murojaatlar ro'yxati) natijasi
///    "suhbatlar ro'yxati" sifatida moslashtiriladi (pastdagi
///    `_conversationFromApplication`ga qarang).
class ChatRemoteDataSourceApiImpl implements ChatRemoteDataSource {
  ChatRemoteDataSourceApiImpl(this._client, this._prefs);

  final DioClient _client;

  /// Used only to decode the current employee id (JWT `sub`) so `isMine` is
  /// correct for admin-chat history (the group thread has many senders).
  final SharedPreferences _prefs;

  /// Current employee id from the stored JWT `sub`, or null if unavailable.
  String? _currentEmployeeId() {
    try {
      final token = _prefs.getString(AuthInterceptor.tokenKey);
      if (token == null || token.isEmpty) return null;
      final parts = token.split('.');
      if (parts.length != 3) return null;
      var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      while (payload.length % 4 != 0) {
        payload += '=';
      }
      final map = jsonDecode(utf8.decode(base64.decode(payload)))
          as Map<String, dynamic>;
      return map['sub'] as String?;
    } on Object {
      return null;
    }
  }

  /// Bitta so'rovda so'raladigan maksimal sahifa hajmi (backendda
  /// `PaginationQueryDto.limit` maksimumi — 100).
  static const int _pageLimit = 100;

  /// `GET /applications` sahifalanishi cheksiz aylanib qolmasligi uchun
  /// qo'yilgan xavfsizlik chegarasi (max ~1000 ta murojaat).
  static const int _maxPages = 10;

  @override
  Future<List<Conversation>> conversations({
    ConversationType? type,
    String? query,
  }) async {
    try {
      // Backendda "suhbatlar" uchun alohida endpoint yo'q — murojaatlar
      // ro'yxatini (`GET /applications`, natija {data,total,page,limit}
      // ko'rinishida sahifalangan) sahifama-sahifa yig'ib, har birini bitta
      // "suhbat"ga aylantiramiz. Server matn bo'yicha qidiruvni (`query`)
      // qo'llab-quvvatlamagani va `type` maydoni umuman yo'qligi uchun
      // ikkalasi ham shu yerda — mijoz tomonida — filtrlanadi.
      final applications = <Map<String, dynamic>>[];
      var page = 1;
      while (page <= _maxPages) {
        final response = await _client.dio.get<Map<String, dynamic>>(
          '/applications',
          queryParameters: {'page': page, 'limit': _pageLimit},
        );
        final body = response.data ?? const {};
        final pageItems = (body['data'] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>();
        applications.addAll(pageItems);

        final total = (body['total'] as num?)?.toInt() ?? applications.length;
        if (applications.length >= total || pageItems.isEmpty) break;
        page++;
      }

      var result = applications.map(_conversationFromApplication).toList();

      // Ma'muriyat (admin) suhbatlarini ham qo'shamiz: xodimning o'z DM'i
      // (`dm-emp-<self>`) + Umumiy chat (`group-all`) — employee-scoped
      // `GET /chat/my/conversations` orqali. Bu murojaat (Application)
      // tizimidan ALOHIDA backend "chat" modulidan keladi. Xatolik bo'lsa
      // (masalan eski backend) — jim o'tkazib yuboramiz, murojaatlar ro'yxati
      // baribir ko'rinadi.
      try {
        final adminConvos = await _client.dio.get<List<dynamic>>(
          '/chat/my/conversations',
        );
        final adminList = (adminConvos.data ?? const [])
            .cast<Map<String, dynamic>>()
            .map(_conversationFromChat)
            .toList();
        // Ma'muriyat suhbatlari ro'yxat boshida ko'rinsin.
        result = [...adminList, ...result];
      } on DioException {
        // eski backend / tarmoq — admin suhbatlarsiz davom etamiz.
      }

      // Oxirgi xabar vaqti bo'yicha kamayish tartibida saralaymiz (yangi tepada).
      result.sort((a, b) => b.lastMessageAt.compareTo(a.lastMessageAt));

      if (type != null) {
        result = result.where((c) => c.type == type).toList();
      }
      final normalizedQuery = query?.trim().toLowerCase();
      if (normalizedQuery != null && normalizedQuery.isNotEmpty) {
        result = result
            .where(
              (c) =>
                  c.title.toLowerCase().contains(normalizedQuery) ||
                  (c.lastMessagePreview?.toLowerCase().contains(
                        normalizedQuery,
                      ) ??
                      false),
            )
            .toList();
      }
      return result;
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<List<Message>> messages(String conversationId) async {
    try {
      // Ma'muriyat (admin) suhbati — backend "chat" modulidan; boshqasi
      // (murojaat) — /applications tizimidan.
      if (_isChatModuleId(conversationId)) {
        final response = await _client.dio.get<List<dynamic>>(
          '/chat/my/conversations/$conversationId/messages',
        );
        final data = response.data ?? const [];
        final myId = _currentEmployeeId();
        return data
            .map(
              (e) => _messageFromChat(
                e as Map<String, dynamic>,
                conversationId: conversationId,
                myId: myId,
              ),
            )
            .toList();
      }

      final response = await _client.dio.get<List<dynamic>>(
        '/applications/$conversationId/messages',
      );
      final data = response.data ?? const [];
      return data
          .map(
            (e) => _messageFromApi(
              e as Map<String, dynamic>,
              conversationId: conversationId,
            ),
          )
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Message> sendMessage({
    required String conversationId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) async {
    try {
      // Backend `CreateMessageDto`si faqat { senderRole, senderName?, text,
      // attachmentUrl? } maydonlarini qabul qiladi — ovozli/doiraviy video/
      // stiker xabar turlari va lokal fayl biriktirmalari uchun mos
      // maydon yo'q. Shu sababli:
      //  - `senderRole` doim `EMPLOYEE` (worker-app — xodim tomoni);
      //  - `text` bo'sh bo'lishi mumkin emasligi sababli (backendda
      //    `@MinLength(1)`), matnsiz (media/stiker) xabarlar uchun
      //    o'rniga qisqa izoh yuboriladi;
      //  - `attachmentUrl` faqat haqiqiy `http(s)` URL bo'lsa yuboriladi —
      //    stiker ID va lokal fayl yo'li (hali serverga yuklanmagan)
      //    backendga umuman yuborilmaydi (mos endpoint yo'q).
      final attachmentUrl = attachment?.path;
      final isRemoteUrl =
          attachmentUrl != null &&
          (attachmentUrl.startsWith('http://') ||
              attachmentUrl.startsWith('https://'));

      // Ma'muriyat (admin) suhbati — backend "chat" moduliga (`/chat/my/...`)
      // yuboriladi; senderId serverda majburan xodimning o'ziga o'rnatiladi.
      // (Real (socket) rejimda yuborish `chat:send` orqali ketadi; bu REST yo'l
      // asosan oflayn/mock zaxira uchun.)
      if (_isChatModuleId(conversationId)) {
        final result = await _client.dio.post<Map<String, dynamic>>(
          '/chat/my/conversations/$conversationId/messages',
          data: {
            'kind': _kindToContract(type),
            'text': (text != null && text.isNotEmpty)
                ? text
                : _fallbackText(type: type, stickerId: stickerId),
            if (isRemoteUrl) 'url': attachmentUrl,
          },
        );
        return _messageFromChat(
          result.data ?? const {},
          conversationId: conversationId,
          myId: _currentEmployeeId(),
        );
      }

      final result = await _client.dio.post<Map<String, dynamic>>(
        '/applications/$conversationId/messages',
        data: {
          'senderRole': 'EMPLOYEE',
          'text': (text != null && text.isNotEmpty)
              ? text
              : _fallbackText(type: type, stickerId: stickerId),
          if (isRemoteUrl) 'attachmentUrl': attachmentUrl,
        },
      );
      return _messageFromApi(
        result.data ?? const {},
        conversationId: conversationId,
      );
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}

/// `GET /applications` elementini (`Application` — murojaat) suhbatlar
/// ro'yxatida ko'rsatiladigan [Conversation]ga aylantiradi.
///
/// Moslashtirish: `title` — arizachining ismi (`applicantFullName`),
/// `lastMessagePreview` — murojaat mavzusi (`subject`, chunki oxirgi
/// xabar matnini olish uchun har bir murojaat uchun alohida so'rov kerak
/// bo'lardi), `lastMessageAt` — `updatedAt` (bo'lmasa `createdAt`),
/// `unreadCount` — backendda kuzatilmagani uchun doim `0`.
Conversation _conversationFromApplication(Map<String, dynamic> json) {
  final applicantName = json['applicantFullName'] as String? ?? 'Fuqaro';
  return Conversation(
    id: json['id'] as String,
    type: ConversationType.shaxsiy,
    title: applicantName,
    participants: 2,
    lastMessagePreview: json['subject'] as String?,
    lastMessageAt:
        (json['updatedAt'] as String?) ??
        (json['createdAt'] as String?) ??
        DateTime.now().toIso8601String(),
    unreadCount: 0,
  );
}

/// Backend "chat" moduli suhbatini (`GET /chat/my/conversations` elementi —
/// `ChatConversationResponse`) suhbatlar ro'yxatidagi [Conversation]ga
/// aylantiradi. `group-all` — Umumiy chat (guruh), qolgani — Ma'muriyat bilan
/// shaxsiy DM. Sarlavha xodim nuqtai nazaridan qo'yiladi (backend title xodim
/// ismini saqlaydi — bu yerda "Ma'muriyat"ga almashtiriladi).
Conversation _conversationFromChat(Map<String, dynamic> json) {
  final id = json['id'] as String;
  final isGroup = id == _kGroupId;
  final last = json['lastMessage'] as Map<String, dynamic>?;
  return Conversation(
    id: id,
    type: isGroup ? ConversationType.umumiy : ConversationType.shaxsiy,
    title: isGroup ? 'Umumiy chat' : "Ma'muriyat",
    avatarUrl: json['photo'] as String?,
    participants: isGroup ? 0 : 2,
    lastMessagePreview: last == null ? null : _chatPreview(last),
    lastMessageAt:
        (last?['createdAt'] as String?) ?? DateTime.now().toIso8601String(),
    unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
  );
}

/// "chat" modul xabari (`ChatMessage`) uchun ro'yxatdagi qisqa oxirgi-xabar
/// matni (turiga qarab).
String _chatPreview(Map<String, dynamic> last) {
  final kind = last['kind'] as String?;
  final text = last['text'] as String?;
  return switch (kind) {
    'image' => 'Rasm',
    'file' => 'Fayl',
    'voice' => 'Ovozli xabar',
    'video' => 'Video xabar',
    'call' => "📞 ${text ?? "Qo'ng'iroq"}",
    _ => text ?? '',
  };
}

/// Backend "chat" modul xabarini (`ChatMessage` — `{id, conversationId,
/// senderId, kind, text?, fileName?, fileSize?, url?, durationSec?, status,
/// createdAt}`) domendagi [Message]ga aylantiradi.
///
/// `isMine`: admin xabari `senderId == 'me'` — hech qachon "mening" emas;
/// xodimning o'zi — `senderId == myId`. DM'da `myId` bo'lmasa suhbat ID'sidagi
/// `dm-emp-<id>` qismidan olinadi.
Message _messageFromChat(
  Map<String, dynamic> json, {
  required String conversationId,
  required String? myId,
}) {
  final senderId = json['senderId'] as String? ?? '';
  final type = _chatKindToType(json['kind'] as String?);
  final url = json['url'] as String?;
  final fileName = json['fileName'] as String?;
  final fileSize = (json['fileSize'] as num?)?.toInt();
  final durationSec = (json['durationSec'] as num?)?.toInt();

  final effectiveMyId =
      myId ??
      (conversationId.startsWith(_kDmPrefix)
          ? conversationId.substring(_kDmPrefix.length)
          : null);
  final isMine = effectiveMyId != null
      ? senderId == effectiveMyId
      : senderId != 'me';

  return Message(
    id: json['id'] as String? ?? 'RT-${DateTime.now().microsecondsSinceEpoch}',
    conversationId: json['conversationId'] as String? ?? conversationId,
    senderId: senderId,
    // Server now attaches the sender's real name (group thread: who wrote).
    senderName: isMine
        ? 'Siz'
        : (json['senderName'] as String? ??
              (senderId == 'me' ? "Ma'muriyat" : 'Xodim')),
    isMine: isMine,
    type: type,
    text: json['text'] as String?,
    attachment: url == null
        ? null
        : ChatAttachment(
            kind: type,
            path: url,
            name: fileName,
            durationMs: durationSec == null ? null : durationSec * 1000,
            sizeBytes: fileSize,
          ),
    call: type == MessageType.call && json['meta'] is Map<String, dynamic>
        ? CallInfo.fromJson(json['meta'] as Map<String, dynamic>)
        : null,
    createdAt:
        json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
    status: _chatStatusToStatus(json['status'] as String?),
  );
}

/// "chat" modul `kind` -> ilova [MessageType] (`video` = doiraviy video).
MessageType _chatKindToType(String? kind) {
  return switch (kind) {
    'image' => MessageType.image,
    'file' => MessageType.file,
    'voice' => MessageType.voice,
    'video' => MessageType.roundVideo,
    'call' => MessageType.call,
    _ => MessageType.text,
  };
}

/// Ilova [MessageType] -> "chat" modul kontrakt `kind` (`roundVideo` -> `video`,
/// `sticker` -> `text`).
String _kindToContract(MessageType type) {
  return switch (type) {
    MessageType.image => 'image',
    MessageType.file => 'file',
    MessageType.voice => 'voice',
    MessageType.roundVideo => 'video',
    // `call` rows are server-written only; never sent by a client.
    MessageType.text || MessageType.sticker || MessageType.call => 'text',
  };
}

/// Backend "chat" modul `status` -> ilova [MessageStatus].
MessageStatus _chatStatusToStatus(String? status) {
  return switch (status) {
    'read' => MessageStatus.oqildi,
    'delivered' => MessageStatus.yetkazildi,
    'sending' => MessageStatus.yuborilmoqda,
    _ => MessageStatus.yuborildi,
  };
}

/// Backend `ApplicationMessage`ni (`id, applicationId, senderRole,
/// senderName?, text, attachmentUrl?, createdAt` — camelCase) domendagi
/// [Message]ga aylantiradi. `Message.fromJson` ishlatilmaydi, chunki u
/// mock formatiga (snake_case, `is_mine`, `status` va h.k.) mo'ljallangan.
Message _messageFromApi(
  Map<String, dynamic> json, {
  required String conversationId,
}) {
  final senderRole = json['senderRole'] as String? ?? 'CITIZEN';
  final attachmentUrl = json['attachmentUrl'] as String?;

  return Message(
    id: json['id'] as String,
    conversationId: json['applicationId'] as String? ?? conversationId,
    // Backendda alohida foydalanuvchi ID maydoni yo'q — rol identifikator
    // sifatida ishlatiladi.
    senderId: senderRole.toLowerCase(),
    senderName:
        json['senderName'] as String? ?? _defaultSenderName(senderRole),
    // worker-app — xodim ilovasi, shuning uchun "mening xabarim"
    // EMPLOYEE tomonidan yuborilgan xabar hisoblanadi.
    isMine: senderRole == 'EMPLOYEE',
    type: attachmentUrl == null
        ? MessageType.text
        : _inferAttachmentType(attachmentUrl),
    text: json['text'] as String?,
    attachment: attachmentUrl == null
        ? null
        : ChatAttachment(
            kind: _inferAttachmentType(attachmentUrl),
            path: attachmentUrl,
            name: _fileNameFromUrl(attachmentUrl),
          ),
    // Stikerlar backendda mavjud emas — `stickerId` doim `null` (standart
    // qiymat) qoldiriladi.
    createdAt:
        json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
    // Backend yetkazilish/o'qilganlik holatini kuzatmaydi — serverdan
    // qaytgan xabar allaqachon saqlangani uchun "yuborildi" ishlatiladi.
    status: MessageStatus.yuborildi,
  );
}

/// Rol nomiga qarab standart ko'rsatiladigan ism (`senderName` bo'sh
/// bo'lsa ishlatiladi).
String _defaultSenderName(String senderRole) {
  return switch (senderRole) {
    'EMPLOYEE' => 'Xodim',
    'SYSTEM' => 'Tizim',
    _ => 'Fuqaro',
  };
}

/// Fayl kengaytmasiga qarab biriktirma turini (rasm/ovozli/doiraviy video/
/// oddiy fayl) taxmin qiladi — backend `attachmentUrl` uchun mime-tur ham,
/// asl xabar turini ham bermaydi, faqat manzilning o'zini qaytaradi.
///
/// MUHIM: aynan shu funksiya orqali suhbat tarixi qayta yuklanganda
/// (`GET /applications/:id/messages`) ovozli/doiraviy video xabarlar to'g'ri
/// pufakchaga (`VoiceBubble`/`RoundVideoBubble`) yo'naltiriladi. Faqat
/// rasm/fayl kengaytmalarini bilgan eski versiyada audio/video kengaytmalari
/// "fayl"ga tushib qolardi (yoki `attachmentUrl` yo'q bo'lsa — pastdagi
/// [_messageFromApi]da `MessageType.text`ga), va natijada xabar tanasida
/// yuborishda ishlatilgan [_fallbackText] yorlig'i ("Ovozli xabar" / "Video
/// xabar") harfma-harf matn sifatida ko'rinardi.
MessageType _inferAttachmentType(String url) {
  final lower = url.toLowerCase();
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const audioExtensions = ['.m4a', '.mp3', '.aac', '.wav', '.ogg', '.opus'];
  const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.3gp'];
  if (imageExtensions.any(lower.contains)) return MessageType.image;
  if (audioExtensions.any(lower.contains)) return MessageType.voice;
  if (videoExtensions.any(lower.contains)) return MessageType.roundVideo;
  return MessageType.file;
}

/// URL manzilidan fayl nomini ajratib oladi (muvaffaqiyatsiz bo'lsa
/// `null`).
String? _fileNameFromUrl(String url) {
  try {
    final segments = Uri.parse(url).pathSegments;
    return segments.isEmpty ? null : segments.last;
  } on FormatException {
    return null;
  }
}

/// Backend `text`ni majburiy (`@MinLength(1)`) talab qilgani uchun
/// matnsiz (media/stiker) xabarlar yuborilganda o'rniga yoziladigan
/// qisqa izoh.
String _fallbackText({required MessageType type, String? stickerId}) {
  if (stickerId != null) return 'Stiker';
  return switch (type) {
    MessageType.text => '',
    MessageType.image => 'Rasm',
    MessageType.file => 'Fayl',
    MessageType.voice => 'Ovozli xabar',
    MessageType.roundVideo => 'Video xabar',
    MessageType.sticker => 'Stiker',
    MessageType.call => "Qo'ng'iroq",
  };
}
