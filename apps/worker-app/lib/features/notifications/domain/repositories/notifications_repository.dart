import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/notifications/domain/entities/notification_item.dart';

/// Xodim bildirishnomalari uchun shartnoma — ro'yxatni o'qish va bitta
/// yozuvni o'qilgan deb belgilash.
///
/// `ApplicationsRepository`/`PointsRepository` bilan bir xil naqsh
/// (data qatlamidagi Mock/Api seam'ni domendan yashiradi).
abstract class NotificationsRepository {
  /// Berilgan xodimning bildirishnomalar ro'yxatini oladi (eng yangisi
  /// birinchi bo'lishi SHART emas — tartiblash `NotificationsCubit`da).
  ///
  /// [employeeId] — joriy sessiyaning `workerId`si (backend `employeeId`,
  /// JWT `sub`) — qarang: `AuthSession.workerId`.
  Future<Either<Failure, List<NotificationItem>>> list(String employeeId);

  /// Bitta yozuvni o'qilgan deb belgilaydi.
  Future<Either<Failure, NotificationItem>> markRead(String id);
}
