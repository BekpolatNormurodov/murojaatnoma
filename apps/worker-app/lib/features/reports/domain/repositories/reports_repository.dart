import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';

/// Kunlik hisobot (kunlik ish hisoboti) va hududda bo'lgan vaqt bilan
/// ishlash shartnomasi.
///
/// - `GET /daily-reports/my?days=N` — o'z hisobotlari (eng yangisi
///   birinchi).
/// - `POST /daily-reports` — yangi hisobot (matn va/yoki biriktirmalar).
/// - `DELETE /daily-reports/my/:id` — faqat yuborilgan kunning o'zida.
/// - `GET /daily-reports/my/zone-time?days=N` — hududda/tashqarida vaqt.
/// - `POST /uploads` (rasm/ovoz/video) va `POST /uploads/document`
///   (hujjatlar) — biriktirmani avval yuklash.
abstract class ReportsRepository {
  Future<Either<Failure, List<DailyReport>>> myReports({int days = 30});

  Future<Either<Failure, DailyReport>> submit({
    required String day,
    required String text,
    required List<ReportAttachment> attachments,
  });

  Future<Either<Failure, Unit>> delete(String id);

  Future<Either<Failure, ZoneTimeReport>> zoneTime({int days = 7});

  /// Faylni serverga yuklaydi va tayyor [ReportAttachment] qaytaradi.
  Future<Either<Failure, ReportAttachment>> upload({
    required File file,
    required ReportAttachmentKind kind,
    String? fileName,
    int? durationSec,
    void Function(double progress)? onProgress,
  });
}
