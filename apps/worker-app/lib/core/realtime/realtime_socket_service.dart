import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

/// Server -> client eventlari uchun broadcast controller turi (JSON
/// payload). Faqat qator uzunligini qisqartirish uchun ichki taxallus.
typedef _EventController = StreamController<Map<String, dynamic>>;

/// Jonli chat + 1:1 WebRTC qo'ng'iroqlar uchun Socket.IO transporti
/// ustidagi yupqa qatlam.
///
/// Kontrakt (`docs/superpowers/specs/2026-08-18-realtime-chat-calls-contract.md`):
/// backend gateway, web-admin va worker-app AYNAN shu event nomlari +
/// payloadlarga qarab quriladi. Ulanish manzili — [AppConfig.apiBaseUrl]
/// ORIGINi (`/api` prefiksi kesib tashlangan), masalan
/// `https://murojaatnoma.uz/api` -> `https://murojaatnoma.uz`. JWT token
/// `SharedPreferences` ichidan ([AuthInterceptor.tokenKey] = `auth_token`)
/// o'qiladi va handshake `auth: { token }` orqali yuboriladi (server
/// xodim identifikatorini shu JWT'dan oladi).
///
/// **AUTH POYGASI (muhim):** gateway socket identifikatorini ASINXRON
/// aniqlaydi va auth tugamasidan oldingi emitlarni TASHLAB YUBORADI; auth
/// yakunida BIR MARTA `presence:snapshot` emit qiladi — bu "tayyor"
/// signali. Shuning uchun BARCHA `call:*` client->server emitlari
/// (`inviteCall`/`acceptCall`/...) `presence:snapshot`ga qadar buferlanadi
/// va tayyor bo'lgach yuboriladi ([_runWhenReady]). Chat emitlari xona
/// (`chat:join`)dan keyin yuborilgani uchun bu poygaga tushmaydi.
class RealtimeSocketService {
  RealtimeSocketService(this._prefs);

  final SharedPreferences _prefs;

  io.Socket? _socket;

  // ---- Server -> client eventlari uchun broadcast oqimlari (CHAT) ----
  final _chatMessage = _EventController.broadcast();
  final _chatRead = _EventController.broadcast();
  final _chatTyping = _EventController.broadcast();
  final _presenceUpdate = _EventController.broadcast();
  final _chatConversation = _EventController.broadcast();
  final _chatMessageDeleted = _EventController.broadcast();
  final _chatMessageEdited = _EventController.broadcast();

  // ---- Server -> client eventlari uchun broadcast oqimlari (CALL) ----
  final _callIncoming = _EventController.broadcast();
  final _callAccepted = _EventController.broadcast();
  final _callRejected = _EventController.broadcast();
  final _callCancelled = _EventController.broadcast();
  final _callBusy = _EventController.broadcast();
  final _callMissed = _EventController.broadcast();
  final _callSdp = _EventController.broadcast();
  final _callIce = _EventController.broadcast();
  final _callEnded = _EventController.broadcast();

  // ---- Server -> client eventlari uchun broadcast oqimlari (GURUH) ----
  final _meetingIncoming = _EventController.broadcast();
  final _meetingJoined = _EventController.broadcast();
  final _meetingLeft = _EventController.broadcast();
  final _meetingSdp = _EventController.broadcast();
  final _meetingIce = _EventController.broadcast();
  final _meetingMedia = _EventController.broadcast();
  final _meetingEnded = _EventController.broadcast();

  /// `presence:snapshot` — auth yakunlandi ("tayyor") signali. Payload
  /// e'tiborga olinmaydi; faqat "socket endi emit qabul qiladi" degani.
  final _presenceSnapshot = StreamController<void>.broadcast();

  /// Auth tayyor bo'lguncha buferlangan `call:*` emitlari — `presence:snapshot`
  /// kelganda tartib bilan yuboriladi.
  final List<void Function()> _pendingCallEmits = [];

  /// Auth yakunlanganmi (`presence:snapshot` kelganmi). Har `connect()`da
  /// `false`ga qaytadi.
  bool _ready = false;

  // ---- CHAT oqimlari ----

  /// `chat:message` — `{ conversationId, message: ChatMessage }`.
  Stream<Map<String, dynamic>> get chatMessage => _chatMessage.stream;

  /// `chat:read` — `{ conversationId, readerId }`.
  Stream<Map<String, dynamic>> get chatRead => _chatRead.stream;

  /// `chat:typing` — `{ conversationId, userId, isTyping }`.
  Stream<Map<String, dynamic>> get chatTyping => _chatTyping.stream;

  /// `presence:update` — `{ userId, online, lastSeen }`.
  Stream<Map<String, dynamic>> get presenceUpdate => _presenceUpdate.stream;

  /// `chat:conversation` — `{ conversationId, action }` (archived/cleared/…).
  Stream<Map<String, dynamic>> get chatConversation => _chatConversation.stream;

  /// `chat:message:deleted` — `{ conversationId, messageId }`.
  Stream<Map<String, dynamic>> get chatMessageDeleted =>
      _chatMessageDeleted.stream;

  /// `chat:message:edited` — `{ conversationId, message }` (carries editedAt).
  Stream<Map<String, dynamic>> get chatMessageEdited =>
      _chatMessageEdited.stream;

  // ---- CALL oqimlari ----

  /// `call:incoming` — `{ callId, from: { id, name, avatar? }, media }`.
  Stream<Map<String, dynamic>> get callIncoming => _callIncoming.stream;

  /// `call:accepted` — `{ callId }` (chaqiruvchi endi offer yasaydi).
  Stream<Map<String, dynamic>> get callAccepted => _callAccepted.stream;

  /// `call:rejected` — `{ callId }`.
  Stream<Map<String, dynamic>> get callRejected => _callRejected.stream;

  /// `call:cancelled` — `{ callId }` (chaqiruvchi javobdan oldin bekor qildi).
  Stream<Map<String, dynamic>> get callCancelled => _callCancelled.stream;

  /// `call:busy` — `{ callId }` (chaqirilayotgan xodim boshqa qo'ng'iroqda).
  Stream<Map<String, dynamic>> get callBusy => _callBusy.stream;

  /// `call:missed` — `{ callId }` (~35s javobsiz).
  Stream<Map<String, dynamic>> get callMissed => _callMissed.stream;

  /// `call:sdp` — `{ callId, description: { sdp, type } }`.
  Stream<Map<String, dynamic>> get callSdp => _callSdp.stream;

  /// `call:ice` — `{ callId, candidate: {candidate, sdpMid, sdpMLineIndex} }`.
  Stream<Map<String, dynamic>> get callIce => _callIce.stream;

  /// `call:ended` — `{ callId, durationSec }`.
  Stream<Map<String, dynamic>> get callEnded => _callEnded.stream;

  // ---- GURUH qo'ng'irog'i (yig'ilish, mesh) oqimlari ----

  /// `meeting:incoming` — `{ meetingId, title, media, host, count }`.
  Stream<Map<String, dynamic>> get meetingIncoming => _meetingIncoming.stream;

  /// `meeting:participant-joined` — `{ meetingId, participant }`.
  Stream<Map<String, dynamic>> get meetingJoined => _meetingJoined.stream;

  /// `meeting:participant-left` — `{ meetingId, userId }`.
  Stream<Map<String, dynamic>> get meetingLeft => _meetingLeft.stream;

  /// `meeting:sdp` — `{ meetingId, fromUserId, description }`.
  Stream<Map<String, dynamic>> get meetingSdp => _meetingSdp.stream;

  /// `meeting:ice` — `{ meetingId, fromUserId, candidate }`.
  Stream<Map<String, dynamic>> get meetingIce => _meetingIce.stream;

  /// `meeting:media` — `{ meetingId, userId, audio, video }`.
  Stream<Map<String, dynamic>> get meetingMedia => _meetingMedia.stream;

  /// `meeting:ended` — `{ meetingId, durationSec }`.
  Stream<Map<String, dynamic>> get meetingEnded => _meetingEnded.stream;

  /// `presence:snapshot` (auth tayyor) signal oqimi — chaqiruvchilar
  /// tayyorlikni kutishi uchun.
  Stream<void> get onReady => _presenceSnapshot.stream;

  /// Auth yakunlanganmi (emitlar darhol ketadimi).
  bool get isReady => _ready;

  /// Socket hozir ulanganmi (chaqiruvchilar mock/oflayn holatda socket
  /// yo'lini o'tkazib yuborishi uchun).
  bool get isConnected => _socket?.connected ?? false;

  /// Socketni ulaydi (idempotent — allaqachon ulangan/ulanayotgan bo'lsa
  /// hech nima qilmaydi). Token topilmasa (login qilinmagan) jim qaytadi.
  ///
  /// `bootstrap()`dagi auth `isAuthenticated` hook'idan chaqiriladi.
  Future<void> connect() async {
    if (_socket != null) return;

    final token = _prefs.getString(AuthInterceptor.tokenKey);
    if (token == null || token.isEmpty) return;

    _ready = false;
    _pendingCallEmits.clear();

    final origin = _resolveOrigin();
    final socket = io.io(
      origin,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );
    _bindEvents(socket);
    _socket = socket;
    socket.connect();
  }

  /// Socketni uzadi va tozalaydi (logout'da chaqiriladi). Broadcast
  /// oqimlari OCHIQ qoladi — keyingi `connect()` ularni qayta ishlatadi.
  void disconnect() {
    final socket = _socket;
    if (socket == null) return;
    _socket = null;
    _ready = false;
    _pendingCallEmits.clear();
    socket
      ..dispose()
      ..close();
  }

  // ---- CHAT: client -> server emitlari ----

  /// `chat:join` — `conv:<conversationId>` xonasiga qo'shiladi.
  void joinConversation(String conversationId) =>
      _socket?.emit('chat:join', {'conversationId': conversationId});

  /// `chat:leave` — xonadan chiqadi.
  void leaveConversation(String conversationId) =>
      _socket?.emit('chat:leave', {'conversationId': conversationId});

  /// `chat:send` — xabar yuboradi (server saqlaydi va `conv:<id>` xonasiga
  /// `chat:message` broadcast qiladi). [kind] ∈ text|image|file|voice|video.
  void sendChat({
    required String conversationId,
    required String kind,
    String? text,
    String? url,
    String? fileName,
    int? fileSize,
    int? durationSec,
  }) {
    _socket?.emit('chat:send', {
      'conversationId': conversationId,
      'kind': kind,
      if (text != null) 'text': text,
      if (url != null) 'url': url,
      if (fileName != null) 'fileName': fileName,
      if (fileSize != null) 'fileSize': fileSize,
      if (durationSec != null) 'durationSec': durationSec,
    });
  }

  /// `chat:read` — suhbatni o'qilgan deb belgilaydi.
  void markRead(String conversationId) =>
      _socket?.emit('chat:read', {'conversationId': conversationId});

  /// `chat:typing` — "yozmoqda" holatini yuboradi (saqlanmaydi).
  void emitTyping(String conversationId, {required bool isTyping}) => _socket
      ?.emit('chat:typing', {
        'conversationId': conversationId,
        'isTyping': isTyping,
      });

  // ---- CALL: client -> server emitlari (auth tayyor bo'lgach) ----

  /// `call:invite` — `{ toUserId, media }`. Server `CallLog` yaratadi va
  /// chaqirilayotgan xodimga `call:incoming` yuboradi; ACK `{ callId }`
  /// qaytaradi. Emit `presence:snapshot`ga qadar buferlanadi — natijada
  /// [Future] `callId` bilan (yoki xatoda `null`) yakunlanadi.
  Future<String?> inviteCall({
    required String toUserId,
    required String media,
    String? conversationId,
  }) {
    final completer = Completer<String?>();
    _runWhenReady(() {
      final socket = _socket;
      if (socket == null) {
        if (!completer.isCompleted) completer.complete(null);
        return;
      }
      socket.emitWithAck(
        'call:invite',
        {
          'toUserId': toUserId,
          'media': media,
          if (conversationId != null) 'conversationId': conversationId,
        },
        ack: (dynamic data) {
          String? callId;
          if (data is Map && data['callId'] is String) {
            callId = data['callId'] as String;
          }
          if (!completer.isCompleted) completer.complete(callId);
        },
      );
    });
    return completer.future;
  }

  /// `call:accept` — chaqirilayotgan xodim qabul qiladi.
  void acceptCall(String callId) =>
      _runWhenReady(() => _socket?.emit('call:accept', {'callId': callId}));

  /// `call:reject` — chaqirilayotgan xodim rad etadi.
  void rejectCall(String callId) =>
      _runWhenReady(() => _socket?.emit('call:reject', {'callId': callId}));

  /// `call:cancel` — chaqiruvchi javobdan oldin bekor qiladi.
  void cancelCall(String callId) =>
      _runWhenReady(() => _socket?.emit('call:cancel', {'callId': callId}));

  /// `call:sdp` — SDP (offer/answer) ni boshqa peerga uzatadi.
  void sendSdp({
    required String callId,
    required Map<String, dynamic> description,
  }) =>
      _runWhenReady(
        () => _socket?.emit('call:sdp', {
          'callId': callId,
          'description': description,
        }),
      );

  /// `call:ice` — ICE nomzodini boshqa peerga uzatadi (trickle).
  void sendIce({
    required String callId,
    required Map<String, dynamic> candidate,
  }) =>
      _runWhenReady(
        () => _socket?.emit('call:ice', {
          'callId': callId,
          'candidate': candidate,
        }),
      );

  /// `call:end` — qo'ng'iroqni tugatadi (har ikki tomon ham chaqira oladi).
  void endCall(String callId) =>
      _runWhenReady(() => _socket?.emit('call:end', {'callId': callId}));

  // ---- GURUH: client -> server emitlari (auth tayyor bo'lgach) ----

  /// `meeting:join` — ACK `{ ok, selfId, participants: [...] }` (yoki
  /// `{ ok: false, error }`). Socket yo'q/javob kelmasa `null`.
  Future<Map<String, dynamic>?> joinMeeting({
    required String meetingId,
    required bool audio,
    required bool video,
  }) => _emitAck('meeting:join', {
    'meetingId': meetingId,
    'audio': audio,
    'video': video,
  });

  /// `meeting:active` — ACK `{ meetings: [...] }` (qo'shilish mumkinlari).
  Future<List<Map<String, dynamic>>> activeMeetings() async {
    final ack = await _emitAck('meeting:active', const <String, dynamic>{});
    final list = ack?['meetings'];
    if (list is! List) return const [];
    return [
      for (final m in list)
        if (m is Map) Map<String, dynamic>.from(m),
    ];
  }

  void leaveMeeting(String meetingId) => _runWhenReady(
    () => _socket?.emit('meeting:leave', {'meetingId': meetingId}),
  );

  void declineMeeting(String meetingId) => _runWhenReady(
    () => _socket?.emit('meeting:decline', {'meetingId': meetingId}),
  );

  void sendMeetingSdp({
    required String meetingId,
    required String toUserId,
    required Map<String, dynamic> description,
  }) => _runWhenReady(
    () => _socket?.emit('meeting:sdp', {
      'meetingId': meetingId,
      'toUserId': toUserId,
      'description': description,
    }),
  );

  void sendMeetingIce({
    required String meetingId,
    required String toUserId,
    required Map<String, dynamic> candidate,
  }) => _runWhenReady(
    () => _socket?.emit('meeting:ice', {
      'meetingId': meetingId,
      'toUserId': toUserId,
      'candidate': candidate,
    }),
  );

  void sendMeetingMedia({
    required String meetingId,
    required bool audio,
    required bool video,
  }) => _runWhenReady(
    () => _socket?.emit('meeting:media', {
      'meetingId': meetingId,
      'audio': audio,
      'video': video,
    }),
  );

  /// Ack'li emit — auth tayyorligini kutadi; 10 s ichida javob kelmasa `null`.
  Future<Map<String, dynamic>?> _emitAck(
    String event,
    Map<String, dynamic> body,
  ) {
    final completer = Completer<Map<String, dynamic>?>();
    _runWhenReady(() {
      final socket = _socket;
      if (socket == null) {
        if (!completer.isCompleted) completer.complete(null);
        return;
      }
      socket.emitWithAck(
        event,
        body,
        ack: (dynamic data) {
          if (completer.isCompleted) return;
          completer.complete(
            data is Map ? Map<String, dynamic>.from(data) : null,
          );
        },
      );
    });
    return completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () => null,
    );
  }

  // ---- Ichki ----

  /// [action]ni auth tayyor bo'lsa DARHOL, aks holda `presence:snapshot`
  /// kelguncha buferlab bajaradi (auth poygasidan himoya).
  void _runWhenReady(void Function() action) {
    if (_ready) {
      action();
    } else {
      _pendingCallEmits.add(action);
    }
  }

  void _onReady() {
    if (_ready) return;
    _ready = true;
    final pending = List<void Function()>.from(_pendingCallEmits);
    _pendingCallEmits.clear();
    for (final action in pending) {
      action();
    }
    _presenceSnapshot.add(null);
  }

  void _bindEvents(io.Socket socket) {
    socket
      // CHAT
      ..on('chat:message', (d) => _add(_chatMessage, d))
      ..on('chat:read', (d) => _add(_chatRead, d))
      ..on('chat:typing', (d) => _add(_chatTyping, d))
      ..on('presence:update', (d) => _add(_presenceUpdate, d))
      ..on('chat:conversation', (d) => _add(_chatConversation, d))
      ..on('chat:message:deleted', (d) => _add(_chatMessageDeleted, d))
      ..on('chat:message:edited', (d) => _add(_chatMessageEdited, d))
      // CALL
      ..on('call:incoming', (d) => _add(_callIncoming, d))
      ..on('call:accepted', (d) => _add(_callAccepted, d))
      ..on('call:rejected', (d) => _add(_callRejected, d))
      ..on('call:cancelled', (d) => _add(_callCancelled, d))
      ..on('call:busy', (d) => _add(_callBusy, d))
      ..on('call:missed', (d) => _add(_callMissed, d))
      ..on('call:sdp', (d) => _add(_callSdp, d))
      ..on('call:ice', (d) => _add(_callIce, d))
      ..on('call:ended', (d) => _add(_callEnded, d))
      // GURUH
      ..on('meeting:incoming', (d) => _add(_meetingIncoming, d))
      ..on('meeting:participant-joined', (d) => _add(_meetingJoined, d))
      ..on('meeting:participant-left', (d) => _add(_meetingLeft, d))
      ..on('meeting:sdp', (d) => _add(_meetingSdp, d))
      ..on('meeting:ice', (d) => _add(_meetingIce, d))
      ..on('meeting:media', (d) => _add(_meetingMedia, d))
      ..on('meeting:ended', (d) => _add(_meetingEnded, d))
      // TAYYOR / AUTH
      ..on('presence:snapshot', (_) => _onReady())
      ..on(
        'auth:error',
        (Object? e) => debugPrint('[socket] auth:error: $e'),
      )
      ..onConnectError((Object? e) => debugPrint('[socket] connect_error: $e'))
      ..onDisconnect((_) {
        // Faqat "tayyor emas" deb belgilaymiz. `_pendingCallEmits`ni
        // TOZALAMAYMIZ: socket qisqa uzilib qayta ulanganda (Wi-Fi<->mobil
        // almashuvi) qabul/tugatish (`call:accept`/`call:end`) kabi terminal
        // signallar yo'qolmasligi va `_onReady`da qayta yuborilishi kerak.
        _ready = false;
      });
  }

  /// Socket payload'ini (`dynamic`) xavfsiz `Map<String, dynamic>`ga
  /// aylantirib tegishli oqimga uzatadi — noto'g'ri shakldagi payload jim
  /// tashlab yuboriladi (hech qachon uncaught bo'lmaydi).
  void _add(_EventController controller, Object? data) {
    if (data is Map) {
      controller.add(Map<String, dynamic>.from(data));
    }
  }

  /// [AppConfig.apiBaseUrl]dan Socket.IO ulanish ORIGINini hosil qiladi:
  /// `/api` (yoki boshqa) yo'l qismini tashlab, faqat `scheme://host[:port]`
  /// qoldiradi. Masalan `https://murojaatnoma.uz/api` -> `https://murojaatnoma.uz`.
  String _resolveOrigin() {
    final uri = Uri.parse(AppConfig.apiBaseUrl);
    final buffer = StringBuffer('${uri.scheme}://${uri.host}');
    if (uri.hasPort) buffer.write(':${uri.port}');
    return buffer.toString();
  }
}
