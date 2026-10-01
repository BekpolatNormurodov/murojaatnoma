import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/realtime/uploads_service.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/domain/usecases/send_message.dart';

/// Yuborilmagan chat xabari (diskda saqlanadi — ilova yopilsa ham yo'qolmaydi).
class OutboxItem {
  const OutboxItem({
    required this.localId,
    required this.conversationId,
    required this.type,
    required this.createdAt,
    this.text,
    this.attachment,
    this.stickerId,
  });

  factory OutboxItem.fromJson(Map<String, dynamic> j) => OutboxItem(
    localId: j['localId'] as String,
    conversationId: j['conversationId'] as String,
    type: MessageType.values.byName(j['type'] as String),
    createdAt: j['createdAt'] as String,
    text: j['text'] as String?,
    attachment: j['attachment'] == null
        ? null
        : ChatAttachment.fromJson(j['attachment'] as Map<String, dynamic>),
    stickerId: j['stickerId'] as String?,
  );

  final String localId;
  final String conversationId;
  final MessageType type;
  final String createdAt;
  final String? text;
  final ChatAttachment? attachment;
  final String? stickerId;

  Map<String, dynamic> toJson() => {
    'localId': localId,
    'conversationId': conversationId,
    'type': type.name,
    'createdAt': createdAt,
    'text': text,
    'attachment': attachment?.toJson(),
    'stickerId': stickerId,
  };

  /// Ro'yxatda ko'rsatish uchun (yuborilmoqda / xato holatida).
  Message toMessage({required String? myId, required MessageStatus status}) =>
      Message(
        id: localId,
        conversationId: conversationId,
        senderId: myId ?? 'me',
        senderName: 'Siz',
        isMine: true,
        type: type,
        text: text,
        attachment: attachment,
        stickerId: stickerId,
        createdAt: createdAt,
        status: status,
      );
}

/// Yetkazish natijasi (UI shu bo'yicha yangilanadi).
class OutboxResult {
  const OutboxResult(this.item, this.sent, this.error);
  final OutboxItem item;

  /// Muvaffaqiyatli bo'lsa — serverdagi xabar.
  final Message? sent;
  final String? error;
}

/// Chat xabarlari uchun "outbox" — sekin/yo'q internetda xabar YO'QOLMAYDI.
///
/// Ilgari: REST xatosida xabar ro'yxatdan o'chirilardi (qayta yozish kerak
/// edi); socket ulanmaganda `emit` jim yutilib, xabar abadiy "yuborilmoqda"
/// bo'lib qolardi. Endi: har xabar REST orqali yuboriladi (Retry +
/// Idempotency-Key bilan); o'tmasa diskka yoziladi, "xato · qayta yuborish"
/// ko'rinadi va internet qaytishi bilan ([NetworkStatus.onReconnect]) yoki
/// ilova qayta ochilganda AVTOMATIK yuboriladi — chat ekrani yopiq bo'lsa ham.
class ChatOutbox {
  ChatOutbox(this._send, this._uploads) {
    _reconnect = NetworkStatus.instance.onReconnect.listen((_) {
      unawaited(flush());
    });
  }

  static const String storageKey = 'chat_outbox_v1';

  final SendMessage _send;
  final UploadsService _uploads;
  late final StreamSubscription<void> _reconnect;
  final _results = StreamController<OutboxResult>.broadcast();
  final Set<String> _inFlight = {};
  bool _flushing = false;

  /// Har bir yetkazish urinishining natijasi.
  Stream<OutboxResult> get results => _results.stream;

  Future<List<OutboxItem>> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(storageKey) ?? const [];
    final out = <OutboxItem>[];
    for (final r in raw) {
      try {
        out.add(OutboxItem.fromJson(jsonDecode(r) as Map<String, dynamic>));
      } on Object {
        // buzilgan yozuv — tashlab yuboramiz
      }
    }
    return out;
  }

  Future<void> _save(List<OutboxItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(storageKey, [
      for (final i in items) jsonEncode(i.toJson()),
    ]);
  }

  Future<void> _put(OutboxItem item) async {
    final items = await _load()
      ..removeWhere((i) => i.localId == item.localId)
      ..add(item);
    await _save(items);
  }

  Future<void> _drop(String localId) async {
    final items = await _load()..removeWhere((i) => i.localId == localId);
    await _save(items);
  }

  /// Shu suhbatning yuborilmagan xabarlari (ekran ochilganda ko'rsatish uchun).
  Future<List<OutboxItem>> pendingFor(String conversationId) async =>
      (await _load()).where((i) => i.conversationId == conversationId).toList();

  /// Bitta urinish. Muvaffaqiyatda diskdan o'chiradi; xatoda diskka yozadi.
  Future<OutboxResult> deliver(OutboxItem item) async {
    if (!_inFlight.add(item.localId)) {
      return OutboxResult(item, null, null); // allaqachon yuborilmoqda
    }
    try {
      var attachment = item.attachment;
      if (attachment != null &&
          !attachment.path.startsWith('http://') &&
          !attachment.path.startsWith('https://')) {
        final file = File(attachment.path);
        if (!file.existsSync()) {
          // Fayl o'chirilgan — qayta urinishning ma'nosi yo'q.
          await _drop(item.localId);
          final r = OutboxResult(item, null, 'Fayl topilmadi');
          _results.add(r);
          return r;
        }
        final uploaded = await _uploads.upload(
          file,
          durationSec: attachment.durationMs == null
              ? null
              : (attachment.durationMs! / 1000).round(),
        );
        attachment = ChatAttachment(
          kind: attachment.kind,
          path: uploaded.url,
          name: uploaded.fileName ?? attachment.name,
          durationMs: attachment.durationMs,
          sizeBytes: uploaded.fileSize ?? attachment.sizeBytes,
        );
      }
      final result = await _send(
        SendMessageParams(
          conversationId: item.conversationId,
          type: item.type,
          text: item.text,
          attachment: attachment,
          stickerId: item.stickerId,
        ),
      );
      final out = await result.fold<Future<OutboxResult>>(
        (failure) async {
          await _put(item);
          return OutboxResult(item, null, failure.message);
        },
        (sent) async {
          await _drop(item.localId);
          return OutboxResult(item, sent, null);
        },
      );
      _results.add(out);
      return out;
    } on Object catch (e) {
      await _put(item);
      final r = OutboxResult(item, null, e is ServerException ? e.message : '$e');
      _results.add(r);
      return r;
    } finally {
      _inFlight.remove(item.localId);
    }
  }

  /// Barcha navbatdagilarni ketma-ket yuboradi (internet qaytganda).
  Future<void> flush() async {
    if (_flushing) return;
    _flushing = true;
    try {
      for (final item in await _load()) {
        final r = await deliver(item);
        if (r.sent == null && NetworkStatus.instance.isOffline) break;
      }
    } finally {
      _flushing = false;
    }
  }

  Future<void> dispose() async {
    await _reconnect.cancel();
    await _results.close();
  }
}
