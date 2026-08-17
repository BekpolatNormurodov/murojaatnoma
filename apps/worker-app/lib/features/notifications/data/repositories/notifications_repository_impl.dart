// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/notifications/data/datasources/notifications_remote_data_source.dart';
import 'package:worker_app/features/notifications/domain/entities/notification_item.dart';
import 'package:worker_app/features/notifications/domain/repositories/notifications_repository.dart';

/// `NotificationsRepository`ning masofaviy-manba (mock/api)
/// implementatsiyasi.
class NotificationsRepositoryImpl implements NotificationsRepository {
  NotificationsRepositoryImpl({required this.remote});

  final NotificationsRemoteDataSource remote;

  @override
  Future<Either<Failure, List<NotificationItem>>> list(
    String employeeId,
  ) async {
    try {
      final items = await remote.list(employeeId);
      return Right(items);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, NotificationItem>> markRead(String id) async {
    try {
      final item = await remote.markRead(id);
      return Right(item);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
