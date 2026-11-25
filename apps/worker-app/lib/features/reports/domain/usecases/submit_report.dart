import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/repositories/reports_repository.dart';

/// Kunlik hisobot yuborish. Biriktirmalar OLDIN yuklangan bo'lishi kerak
/// (`UploadReportFile`).
class SubmitReport implements UseCase<DailyReport, SubmitReportParams> {
  SubmitReport(this.repository);

  final ReportsRepository repository;

  /// Server bilan bir xil cheklovlar (mijoz tomonida ham tekshiriladi).
  static const int maxAttachments = 10;
  static const int maxTextLength = 5000;

  @override
  Future<Either<Failure, DailyReport>> call(SubmitReportParams params) async {
    final text = params.text.trim();
    if (text.isEmpty && params.attachments.isEmpty) {
      return const Left(
        ServerFailure('Matn yozing yoki kamida bitta fayl biriktiring'),
      );
    }
    if (text.length > maxTextLength) {
      return const Left(
        ServerFailure('Matn 5000 belgidan oshmasligi kerak'),
      );
    }
    if (params.attachments.length > maxAttachments) {
      return const Left(
        ServerFailure("Ko'pi bilan 10 ta fayl biriktirish mumkin"),
      );
    }
    return repository.submit(
      day: params.day,
      text: text,
      attachments: params.attachments,
    );
  }
}

class SubmitReportParams extends Equatable {
  const SubmitReportParams({
    required this.day,
    required this.text,
    this.attachments = const [],
  });

  /// `YYYY-MM-DD`.
  final String day;
  final String text;
  final List<ReportAttachment> attachments;

  @override
  List<Object?> get props => [day, text, attachments];
}
