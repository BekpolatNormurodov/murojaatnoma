import 'package:equatable/equatable.dart';

/// Suhbat turi — umumiy (kanal/e'lonlar), shaxsiy (1:1) yoki guruh.
enum ConversationType { umumiy, shaxsiy, guruh }

/// Bitta suhbat (chat) — suhbatlar ro'yxatida ko'rsatiladigan yig'ma
/// ma'lumot (oxirgi xabar, o'qilmagan soni va h.k.).
class Conversation extends Equatable {
  const Conversation({
    required this.id,
    required this.type,
    required this.title,
    required this.participants,
    required this.lastMessageAt,
    required this.unreadCount,
    this.avatarUrl,
    this.lastMessagePreview,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as String,
      type: ConversationType.values.byName(json['type'] as String),
      title: json['title'] as String,
      avatarUrl: json['avatar_url'] as String?,
      participants: (json['participants'] as num).toInt(),
      lastMessagePreview: json['last_message_preview'] as String?,
      lastMessageAt: json['last_message_at'] as String,
      unreadCount: (json['unread_count'] as num).toInt(),
    );
  }

  final String id;
  final ConversationType type;
  final String title;

  /// Suhbat/ishtirokchi rasmi — bo'lmasa `null` (harf-avatar ishlatiladi).
  final String? avatarUrl;

  /// Ishtirokchilar soni (shaxsiy suhbatda odatda 2).
  final int participants;

  /// Oxirgi xabarning qisqa matni (ro'yxatda ko'rsatish uchun).
  final String? lastMessagePreview;

  /// Oxirgi xabar yuborilgan vaqt.
  final String lastMessageAt;

  /// O'qilmagan xabarlar soni.
  final int unreadCount;

  @override
  List<Object?> get props => [
    id,
    type,
    title,
    avatarUrl,
    participants,
    lastMessagePreview,
    lastMessageAt,
    unreadCount,
  ];

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type.name,
    'title': title,
    'avatar_url': avatarUrl,
    'participants': participants,
    'last_message_preview': lastMessagePreview,
    'last_message_at': lastMessageAt,
    'unread_count': unreadCount,
  };
}
