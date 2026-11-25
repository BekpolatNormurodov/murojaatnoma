import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';
import 'package:worker_app/features/reports/domain/repositories/reports_repository.dart';

/// Hududda bo'lgan vaqt — so'nggi `days` kun (standart 7).
class GetZoneTime implements UseCase<ZoneTimeReport, int> {
  GetZoneTime(this.repository);

  final ReportsRepository repository;

  @override
  Future<Either<Failure, ZoneTimeReport>> call(int days) =>
      repository.zoneTime(days: days);
}
