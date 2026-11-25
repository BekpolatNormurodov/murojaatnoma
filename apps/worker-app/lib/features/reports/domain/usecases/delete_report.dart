import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/reports/domain/repositories/reports_repository.dart';

/// Bugun yuborilgan hisobotni o'chirish (server boshqa kunlarda 403).
class DeleteReport implements UseCase<Unit, String> {
  DeleteReport(this.repository);

  final ReportsRepository repository;

  @override
  Future<Either<Failure, Unit>> call(String id) => repository.delete(id);
}
