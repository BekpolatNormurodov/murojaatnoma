import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/core/recording/media_limits.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/repositories/reports_repository.dart';

/// Biriktirmani serverga yuklash (hujjat → `/uploads/document`, qolgani →
/// `/uploads`). 25 MB dan katta fayl yuborilmaydi.
class UploadReportFile
    implements UseCase<ReportAttachment, UploadReportFileParams> {
  UploadReportFile(this.repository);

  final ReportsRepository repository;

  static const int maxBytes = kMaxUploadBytes;

  @override
  Future<Either<Failure, ReportAttachment>> call(
    UploadReportFileParams params,
  ) async {
    final size = params.sizeBytes;
    if (size != null && size > maxBytes) {
      return const Left(
        ServerFailure(kFileTooLargeMessage),
      );
    }
    return repository.upload(
      file: params.file,
      kind: params.kind,
      fileName: params.fileName,
      durationSec: params.durationSec,
      onProgress: params.onProgress,
    );
  }
}

class UploadReportFileParams extends Equatable {
  const UploadReportFileParams({
    required this.file,
    required this.kind,
    this.fileName,
    this.sizeBytes,
    this.durationSec,
    this.onProgress,
  });

  final File file;
  final ReportAttachmentKind kind;
  final String? fileName;
  final int? sizeBytes;
  final int? durationSec;
  final void Function(double progress)? onProgress;

  @override
  List<Object?> get props => [file.path, kind, fileName, sizeBytes];
}
