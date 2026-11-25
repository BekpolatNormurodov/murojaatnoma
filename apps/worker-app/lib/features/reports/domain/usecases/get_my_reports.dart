import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/repositories/reports_repository.dart';

/// O'z kunlik hisobotlari — so'nggi `days` kun (standart 30).
class GetMyReports implements UseCase<List<DailyReport>, int> {
  GetMyReports(this.repository);

  final ReportsRepository repository;

  @override
  Future<Either<Failure, List<DailyReport>>> call(int days) =>
      repository.myReports(days: days);
}
