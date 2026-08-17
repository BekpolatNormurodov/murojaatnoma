import 'package:equatable/equatable.dart';

/// Xabar turi. `roundVideo` — Telegram uslubidagi doiraviy video xabar.
enum MessageType { text, image, file, voice, roundVideo, sticker }

/// Xabarning yetkazilish holati.
enum MessageStatus { yuborilmoqda, yuborildi, yetkazildi, oqildi }

/// Xabarga biriktirilgan media/fayl (rasm/fayl/ovozli/doiraviy video).
class ChatAttachment extends Equatable {
  const ChatAttachment({
    required this.kind,
    required this.path,
    this.name,
    this.durationMs,
    this.sizeBytes,
  });

  factory ChatAttachment.fromJson(Map<String, dynamic> json) {
    return ChatAttachment(
      kind: MessageType.values.byName(json['kind'] as String),
      path: json['path'] as String,
      name: json['name'] as String?,
      durationMs: (json['duration_ms'] as num?)?.toInt(),
      sizeBytes: (json['size_bytes'] as num?)?.toInt(),
    );
  }

  final MessageType kind;
  final String path;
  final String? name;

  /// Ovozli xabar / doiraviy video davomiyligi (millisekundlarda) —
  /// [MessageType.voice]/[MessageType.roundVideo] uchun mazmunli.
  final int? durationMs;

  /// Fayl hajmi (baytlarda) — ma'lum bo'lmasa `null`.
  final int? sizeBytes;

  @override
  List<Object?> get props => [kind, path, name, durationMs, sizeBytes];

  Map<String, dynamic> toJson() => {
    'kind': kind.name,
    'path': path,
    'name': name,
    'duration_ms': durationMs,
    'size_bytes': sizeBytes,
  };
}

/// Bitta chat xabari — matn, media (rasm/fayl/ovoz/doiraviy video) yoki
/// stiker bo'lishi mumkin.
class Message extends Equatable {
  const Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    required this.isMine,
    required this.type,
    required this.createdAt,
    required this.status,
    this.text,
    this.attachment,
    this.stickerId,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      conversationId: json['conversation_id'] as String,
      senderId: json['sender_id'] as String,
      senderName: json['sender_name'] as String,
      isMine: json['is_mine'] as bool,
      type: MessageType.values.byName(json['type'] as String),
      text: json['text'] as String?,
      attachment: json['attachment'] == null
          ? null
          : ChatAttachment.fromJson(json['attachment'] as Map<String, dynamic>),
      stickerId: json['sticker_id'] as String?,
      createdAt: json['created_at'] as String,
      status: MessageStatus.values.byName(json['status'] as String),
    );
  }

  final String id;
  final String conversationId;
  final String senderId;
  final String senderName;

  /// `true` bo'lsa — joriy (login qilingan) xodim tomonidan yuborilgan.
  final bool isMine;
  final MessageType type;

  /// Matnli xabar tanasi — media/stiker xabarlarda `null` bo'lishi mumkin.
  final String? text;

  /// Biriktirilgan media — faqat media turdagi xabarlarda mazmunli.
  final ChatAttachment? attachment;

  /// Stiker identifikatori — faqat [MessageType.sticker] uchun.
  final String? stickerId;
  final String createdAt;
  final MessageStatus status;

  @override
  List<Object?> get props => [
    id,
    conversationId,
    senderId,
    senderName,
    isMine,
    type,
    text,
    attachment,
    stickerId,
    createdAt,
    status,
  ];

  Map<String, dynamic> toJson() => {
    'id': id,
    'conversation_id': conversationId,
    'sender_id': senderId,
    'sender_name': senderName,
    'is_mine': isMine,
    'type': type.name,
    'text': text,
    'attachment': attachment?.toJson(),
    'sticker_id': stickerId,
    'created_at': createdAt,
    'status': status.name,
  };
}
