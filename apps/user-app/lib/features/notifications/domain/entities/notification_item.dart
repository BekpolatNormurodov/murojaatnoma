import 'package:equatable/equatable.dart';

/// Fuqaro ilovasidagi bildirishnoma turlari — har biri o'z ikonkasi/rangiga
/// ega (qarang: `NotificationTile`).
enum NotificationType {
  /// To'lov muvaffaqiyatli amalga oshirilgani haqida xabar.
  paymentSuccess,

  /// To'lov amalga oshmagani haqida xabar.
  paymentFailed,

  /// Yuborilgan murojaatga javob berilgani haqida xabar.
  requestAnswered,

  /// Kommunal xizmat/servis bo'yicha eslatma (masalan qarzdorlik).
  serviceReminder,
}

/// Bitta bildirishnoma yozuvi — ro'yxat sahifasida (`NotificationsPage`)
/// ko'rsatiladi. MOCK manbadan (`NotificationsMockDataSource`) keladi —
/// `title`/`body` shu tufayli ATAYLAB oddiy `String` (l10n emas, qarang:
/// data qatlami hujjati).
class NotificationItem extends Equatable {
  const NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    this.read = false,
  });

  /// Keshdan (`SharedPreferences`/JSON) o'qiladi — `CacheService.getJsonList`
  /// orqali. Buzilgan/kutilmagan shakl bo'lsa `CacheService` o'zi `null`
  /// qaytaradi (bu yerga hech qachon yetib kelmaydi).
  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      type: NotificationType.values.byName(json['type'] as String),
      title: json['title'] as String,
      body: json['body'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      read: json['read'] as bool? ?? false,
    );
  }

  /// `CacheService` kaliti — `NotificationsCubit` cache-then-network
  /// naqshi uchun (oxirgi ko'rsatilgan ro'yxat, o'qilgan-belgilar bilan
  /// birga, ilova qayta ochilganda darhol ko'rsatiladi).
  static const cacheKey = 'cache_notifications_v1';

  final String id;
  final NotificationType type;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool read;

  NotificationItem copyWith({bool? read}) => NotificationItem(
    id: id,
    type: type,
    title: title,
    body: body,
    createdAt: createdAt,
    read: read ?? this.read,
  );

  @override
  List<Object?> get props => [id, type, title, body, createdAt, read];

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type.name,
    'title': title,
    'body': body,
    'created_at': createdAt.toIso8601String(),
    'read': read,
  };
}
