import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/reports/data/datasources/reports_remote_data_source.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';
import 'package:worker_app/features/reports/domain/repositories/reports_repository.dart';

/// `ReportsRepository`ning masofaviy-manba (mock/api) implementatsiyasi —
/// istisnolar `Failure`ga aylanadi, hech qachon uncaught bo'lmaydi.
class ReportsRepositoryImpl implements ReportsRepository {
  ReportsRepositoryImpl({required this.remote});

  final ReportsRemoteDataSource remote;

  Future<Either<Failure, T>> _guard<T>(Future<T> Function() run) async {
    try {
      return Right(await run());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Object catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, List<DailyReport>>> myReports({int days = 30}) =>
      _guard(() => remote.myReports(days: days));

  @override
  Future<Either<Failure, DailyReport>> submit({
    required String day,
    required String text,
    required List<ReportAttachment> attachments,
  }) => _guard(
    () => remote.submit(day: day, text: text, attachments: attachments),
  );

  @override
  Future<Either<Failure, Unit>> delete(String id) => _guard(() async {
    await remote.delete(id);
    return unit;
  });

  @override
  Future<Either<Failure, ZoneTimeReport>> zoneTime({int days = 7}) =>
      _guard(() => remote.zoneTime(days: days));

  @override
  Future<Either<Failure, ReportAttachment>> upload({
    required File file,
    required ReportAttachmentKind kind,
    String? fileName,
    int? durationSec,
    void Function(double progress)? onProgress,
  }) => _guard(
    () => remote.upload(
      file: file,
      kind: kind,
      fileName: fileName,
      durationSec: durationSec,
      onProgress: onProgress,
    ),
  );
}
