import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:user_app/features/notifications/data/datasources/notifications_mock_data_source.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';

/// Haqiqiy manba — backend `CitizenNotification` (fuqaroning telefoni
/// bo'yicha): murojaat qabul qilindi, xodim biriktirildi, javob yozildi,
/// hal qilindi / rad etildi (sababi bilan).
class NotificationsApiDataSource implements NotificationsDataSource {
  NotificationsApiDataSource(this._client);

  final DioClient _client;

  @override
  Future<List<NotificationItem>> fetch() async {
    try {
      final res = await _client.dio.get<List<dynamic>>(
        '/notifications/citizen',
      );
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(notificationFromApi)
          .toList();
    } on DioException catch (e) {
      throw ServerException(_message(e));
    }
  }

  @override
  Future<void> markRead(String id) async {
    await _client.dio.patch<void>(
      '/notifications/citizen/${Uri.encodeComponent(id)}/read',
    );
  }

  @override
  Future<void> markAllRead() async {
    await _client.dio.post<void>('/notifications/citizen/read-all');
  }
}

/// Server yozuvi → [NotificationItem]. Turi sarlavhadan aniqlanadi (ikonka
/// va rang uchun) — server matni o'zgarsa ham eng yomoni umumiy ikonka.
NotificationItem notificationFromApi(Map<String, dynamic> json) {
  final title = json['title'] as String? ?? '';
  final t = title.toLowerCase();
  final type = t.contains('rad etildi')
      ? NotificationType.requestRejected
      : t.contains('hal qilindi')
      ? NotificationType.requestResolved
      : t.contains('biriktirildi')
      ? NotificationType.requestAssigned
      : t.contains('qabul qilindi')
      ? NotificationType.requestReceived
      : NotificationType.requestAnswered;
  return NotificationItem(
    id: json['id'] as String? ?? '',
    type: type,
    title: title,
    body: json['body'] as String? ?? '',
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ??
        DateTime.now(),
    read: json['isRead'] as bool? ?? false,
    applicationId: json['applicationId'] as String?,
  );
}

String _message(DioException e) {
  final data = e.response?.data;
  if (data is Map<String, dynamic> && data['message'] is String) {
    return data['message'] as String;
  }
  return switch (e.type) {
    DioExceptionType.connectionError ||
    DioExceptionType.connectionTimeout ||
    DioExceptionType.receiveTimeout => 'Internet aloqasini tekshiring',
    _ => "Bildirishnomalarni yuklab bo'lmadi",
  };
}
