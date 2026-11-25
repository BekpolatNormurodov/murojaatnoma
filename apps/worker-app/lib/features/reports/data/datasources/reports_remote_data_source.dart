import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/core/realtime/uploads_service.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';
import 'package:worker_app/features/reports/domain/report_formatters.dart';

/// Kunlik hisobot moduli uchun masofaviy ma'lumot manbai.
///
/// Xatoliklar [ServerException] sifatida (backendning o'zbekcha `message`i
/// bilan — `string` yoki `string[]`) uloqtiriladi.
abstract class ReportsRemoteDataSource {
  Future<List<DailyReport>> myReports({int days = 30});

  Future<DailyReport> submit({
    required String day,
    required String text,
    required List<ReportAttachment> attachments,
  });

  Future<void> delete(String id);

  Future<ZoneTimeReport> zoneTime({int days = 7});

  Future<ReportAttachment> upload({
    required File file,
    required ReportAttachmentKind kind,
    String? fileName,
    int? durationSec,
    void Function(double progress)? onProgress,
  });
}

/// Real backend — [DioClient] + mavjud [UploadsService] (yuklash).
class ReportsRemoteDataSourceApiImpl implements ReportsRemoteDataSource {
  ReportsRemoteDataSourceApiImpl(this._client, this._uploads);

  final DioClient _client;
  final UploadsService _uploads;

  @override
  Future<List<DailyReport>> myReports({int days = 30}) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/daily-reports/my',
        queryParameters: {'days': days},
      );
      return [
        for (final item in response.data ?? const <dynamic>[])
          if (item is Map<String, dynamic>) DailyReport.fromJson(item),
      ];
    } on DioException catch (e) {
      throw ServerException(_errorText(e));
    }
  }

  @override
  Future<DailyReport> submit({
    required String day,
    required String text,
    required List<ReportAttachment> attachments,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/daily-reports',
        data: {
          'day': day,
          if (text.isNotEmpty) 'text': text,
          if (attachments.isNotEmpty)
            'attachments': [for (final a in attachments) a.toJson()],
        },
      );
      return DailyReport.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(_errorText(e));
    }
  }

  @override
  Future<void> delete(String id) async {
    try {
      await _client.dio.delete<void>(
        '/daily-reports/my/${Uri.encodeComponent(id)}',
      );
    } on DioException catch (e) {
      throw ServerException(_errorText(e));
    }
  }

  @override
  Future<ZoneTimeReport> zoneTime({int days = 7}) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/daily-reports/my/zone-time',
        queryParameters: {'days': days},
      );
      return ZoneTimeReport.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(_errorText(e));
    }
  }

  @override
  Future<ReportAttachment> upload({
    required File file,
    required ReportAttachmentKind kind,
    String? fileName,
    int? durationSec,
    void Function(double progress)? onProgress,
  }) async {
    final uploaded = kind == ReportAttachmentKind.file
        ? await _uploads.uploadDocument(file, onProgress: onProgress)
        : await _uploads.upload(
            file,
            durationSec: durationSec,
            onProgress: onProgress,
          );
    if (uploaded.url.isEmpty) {
      throw ServerException("Fayl yuklanmadi — qayta urinib ko'ring");
    }
    return ReportAttachment(
      kind: kind,
      url: uploaded.url,
      fileName: fileName ?? uploaded.fileName,
      fileSize: uploaded.fileSize ?? _safeLength(file),
      durationSec: uploaded.durationSec ?? durationSec,
    );
  }
}

/// Demo rejim (`AppConfig.useMock`) — xotirada saqlanadi; "yuklangan"
/// fayl URL'i sifatida lokal yo'l qaytariladi (shunda demo'da ham
/// ovoz/video/rasm ochiladi).
class ReportsRemoteDataSourceMockImpl implements ReportsRemoteDataSource {
  ReportsRemoteDataSourceMockImpl({DateTime Function()? clock})
    : _clock = clock ?? DateTime.now {
    _seed();
  }

  final DateTime Function() _clock;
  final List<DailyReport> _reports = [];
  var _seq = 0;

  void _seed() {
    final now = _clock();
    final yesterday = now.subtract(const Duration(days: 1));
    final before = now.subtract(const Duration(days: 3));
    _reports.addAll([
      DailyReport(
        id: 'mock-r-${++_seq}',
        day: ymd(yesterday),
        createdAt: DateTime(
          yesterday.year,
          yesterday.month,
          yesterday.day,
          18,
          12,
        ),
        text:
            "Olmazor mahallasida 3 ta murojaat bo'yicha joyida o'rganish "
            "o'tkazildi. Ko'cha yoritgichlari bo'yicha dalolatnoma tuzildi.",
        attachments: const [
          ReportAttachment(
            kind: ReportAttachmentKind.file,
            url: 'mock://file/dalolatnoma.pdf',
            fileName: 'Dalolatnoma.pdf',
            fileSize: 248000,
          ),
        ],
      ),
      DailyReport(
        id: 'mock-r-${++_seq}',
        day: ymd(before),
        createdAt: DateTime(before.year, before.month, before.day, 17, 40),
        text: 'Fuqarolar qabuli — 12 kishi. Takliflar umumlashtirildi.',
      ),
    ]);
  }

  @override
  Future<List<DailyReport>> myReports({int days = 30}) async {
    await Future<void>.delayed(const Duration(milliseconds: 450));
    final cutoff = _clock().subtract(Duration(days: days));
    final list = _reports.where((r) => r.createdAt.isAfter(cutoff)).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return List.unmodifiable(list);
  }

  @override
  Future<DailyReport> submit({
    required String day,
    required String text,
    required List<ReportAttachment> attachments,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final report = DailyReport(
      id: 'mock-r-${++_seq}',
      employeeId: 'MOCK-0001',
      day: day,
      text: text,
      attachments: attachments,
      createdAt: _clock(),
    );
    _reports.add(report);
    return report;
  }

  @override
  Future<void> delete(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = _reports.indexWhere((r) => r.id == id);
    if (index < 0) throw ServerException('Hisobot topilmadi');
    if (!_reports[index].canDeleteOn(_clock())) {
      throw ServerException(
        "Faqat bugun yuborilgan hisobotni o'chirish mumkin",
      );
    }
    _reports.removeAt(index);
  }

  @override
  Future<ZoneTimeReport> zoneTime({int days = 7}) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final now = _clock();
    final result = <ZoneDay>[];
    for (var i = 0; i < days; i++) {
      final d = DateTime(now.year, now.month, now.day - i);
      // Dam olish kuni (yakshanba) va bugun ertalab — bo'sh.
      if (d.weekday == DateTime.sunday) {
        result.add(ZoneDay(date: ymd(d)));
        continue;
      }
      DateTime at(int h, int m) => DateTime(d.year, d.month, d.day, h, m);
      final stretches = [
        ZoneStretch(
          from: at(9, 12),
          to: at(11, 40),
          minutes: 148,
          inside: true,
          mahallaName: 'Olmazor',
        ),
        ZoneStretch(
          from: at(11, 40),
          to: at(12, 25),
          minutes: 45,
          inside: false,
        ),
        ZoneStretch(
          from: at(12, 25),
          to: at(15, 17),
          minutes: 172,
          inside: true,
          mahallaName: 'Bodomzor',
        ),
        ZoneStretch(
          from: at(15, 17),
          to: at(16, 0),
          minutes: 43,
          inside: false,
          office: true,
        ),
      ];
      result.add(
        ZoneDay(
          date: ymd(d),
          zoneMinutes: 320,
          outsideMinutes: 45,
          officeMinutes: 43,
          activeMinutes: 408,
          firstAt: at(9, 12),
          lastAt: at(16, 0),
          stretches: stretches,
          byMahalla: const [
            MahallaTime(name: 'Bodomzor', minutes: 172, inside: true),
            MahallaTime(name: 'Olmazor', minutes: 148, inside: true),
            MahallaTime(minutes: 45, inside: false),
            MahallaTime(minutes: 43, inside: false, office: true),
          ],
        ),
      );
    }
    return ZoneTimeReport(days: result);
  }

  @override
  Future<ReportAttachment> upload({
    required File file,
    required ReportAttachmentKind kind,
    String? fileName,
    int? durationSec,
    void Function(double progress)? onProgress,
  }) async {
    for (var i = 1; i <= 4; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 150));
      onProgress?.call(i / 4);
    }
    final segments = file.uri.pathSegments;
    return ReportAttachment(
      kind: kind,
      url: file.path,
      fileName: fileName ?? (segments.isEmpty ? 'file' : segments.last),
      fileSize: _safeLength(file),
      durationSec: durationSec,
    );
  }
}

int? _safeLength(File file) {
  try {
    return file.lengthSync();
  } on Object {
    return null;
  }
}

/// Backend xatosidan foydalanuvchiga ko'rsatiladigan matn — `{message}`
/// (`string` yoki NestJS `string[]`), bo'lmasa `FriendlyErrorInterceptor`
/// allaqachon tozalagan `e.message`.
String _errorText(DioException e) {
  final data = e.response?.data;
  if (data is Map) {
    final message = data['message'];
    if (message is String && message.trim().isNotEmpty) return message.trim();
    if (message is List) {
      final parts = message.whereType<String>().where((s) => s.isNotEmpty);
      if (parts.isNotEmpty) return parts.join('\n');
    }
  }
  return e.message ?? 'Server xatosi';
}
