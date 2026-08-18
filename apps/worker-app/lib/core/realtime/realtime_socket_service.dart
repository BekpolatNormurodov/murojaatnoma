import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

/// Server -> client chat eventlari uchun broadcast controller turi (JSON
/// payload). Faqat qator uzunligini qisqartirish uchun ichki taxallus.
typedef _EventController = StreamController<Map<String, dynamic>>;

/// Jonli chat uchun Socket.IO transporti ustidagi yupqa qatlam.
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
/// MUHIM: qo'ng'iroqlar (WebRTC `call:*`) BU xizmat doirasidan TASHQARIDA —
/// bu klass faqat CHAT eventlari bilan ishlaydi.
class RealtimeSocketService {
  RealtimeSocketService(this._prefs);

  final SharedPreferences _prefs;

  io.Socket? _socket;

  // ---- Server -> client eventlari uchun broadcast oqimlari ----
  final _chatMessage = _EventController.broadcast();
  final _chatRead = _EventController.broadcast();
  final _chatTyping = _EventController.broadcast();
  final _presenceUpdate = _EventController.broadcast();
  final _chatConversation = _EventController.broadcast();
  final _chatMessageDeleted = _EventController.broadcast();
  final _chatMessageEdited = _EventController.broadcast();

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
    socket
      ..dispose()
      ..close();
  }

  // ---- Client -> server emitlari ----

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

  // ---- Ichki ----

  void _bindEvents(io.Socket socket) {
    socket
      ..on('chat:message', (d) => _add(_chatMessage, d))
      ..on('chat:read', (d) => _add(_chatRead, d))
      ..on('chat:typing', (d) => _add(_chatTyping, d))
      ..on('presence:update', (d) => _add(_presenceUpdate, d))
      ..on('chat:conversation', (d) => _add(_chatConversation, d))
      ..on('chat:message:deleted', (d) => _add(_chatMessageDeleted, d))
      ..on('chat:message:edited', (d) => _add(_chatMessageEdited, d))
      ..onConnectError((Object? e) => debugPrint('[socket] connect_error: $e'));
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
