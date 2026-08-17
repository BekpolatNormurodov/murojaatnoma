import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/features/notifications/data/datasources/notifications_mock_data_source.dart';
import 'package:worker_app/features/notifications/domain/entities/notification_item.dart';

/// Xodim bildirishnomalari uchun masofaviy ma'lumot manbai.
///
/// `ApplicationsRemoteDataSource`/`PointsRemoteDataSource` bilan bir xil
/// naqsh — Mock (backend hozircha faqat qisman) va Api (haqiqiy backend,
/// qarang: `apps/backend/src/modules/notifications`) implementatsiyalari.
abstract class NotificationsRemoteDataSource {
  Future<List<NotificationItem>> list(String employeeId);

  Future<NotificationItem> markRead(String id);
}

/// Mock implementatsiya — [AppConfig.useMock] `true` bo'lganda ishlatiladi.
/// Mavjud `NotificationsMockDataSource`ni (o'zgarishsiz) o'rab oladi —
/// shu tufayli mock oqim aynan avvalgidek ishlashda davom etadi.
class NotificationsRemoteDataSourceMockImpl
    implements NotificationsRemoteDataSource {
  NotificationsRemoteDataSourceMockImpl({NotificationsMockDataSource? source})
    : _source = source ?? NotificationsMockDataSource();

  final NotificationsMockDataSource _source;

  @override
  Future<List<NotificationItem>> list(String employeeId) => _source.fetch();

  /// Mock manba xotirada saqlanmaydi (`fetch()` har safar yangi ro'yxat
  /// qaytaradi) — shuning uchun bu yerda faqat so'ralgan yozuvni topib,
  /// `read: true` bilan qaytaradi; haqiqiy saqlash `NotificationsCubit`
  /// darajasida (holat ichida) amalga oshadi.
  @override
  Future<NotificationItem> markRead(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final items = await _source.fetch();
    final found = items.where((n) => n.id == id).toList();
    if (found.isEmpty) throw ServerException('Bildirishnoma topilmadi: $id');
    return found.first.copyWith(read: true);
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
///
/// Marshrutlar (qarang: `notifications.controller.ts`):
/// - `GET /notifications/employee/:employeeId`
/// - `PATCH /notifications/:id/read`
///
/// **Diqqat**: backend hozircha `GET /notifications` (umumiy ro'yxat) va
/// `GET /notifications/unread-count`ni TAQDIM ETMAYDI — o'qilmagan son
/// mahalliy ravishda (`NotificationsCubit.unreadCount`) yuklangan
/// ro'yxatdan hisoblanadi, qo'shimcha so'rov shart emas.
class NotificationsRemoteDataSourceApiImpl
    implements NotificationsRemoteDataSource {
  NotificationsRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<NotificationItem>> list(String employeeId) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/notifications/employee/$employeeId',
      );
      final data = response.data ?? const [];
      return data
          .map((e) => NotificationItem.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<NotificationItem> markRead(String id) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/notifications/$id/read',
      );
      final data = response.data;
      // PATCH mark-read odatda yangilangan bildirishnomani qaytaradi; backend
      // bo'sh/nomaqbul javob bersa (204 yoki `id`siz) xom `fromJson({})` cast
      // yiqilishi o'rniga nazoratli xato beramiz — cubit uni yumshoq ko'rsatadi.
      if (data == null || data['id'] == null) {
        throw ServerException(
          "Bildirishnomani belgilashda kutilmagan javob",
        );
      }
      return NotificationItem.fromJson(data);
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
