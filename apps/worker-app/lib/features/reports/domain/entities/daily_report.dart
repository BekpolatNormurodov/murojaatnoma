import 'package:equatable/equatable.dart';

/// Kunlik hisobot biriktirmasi turi — backend `kind` qiymatlari bilan
/// bir xil (`image|voice|video|file`).
enum ReportAttachmentKind {
  image,
  voice,
  video,
  file;

  /// Backendga yuboriladigan qiymat.
  String get wire => name;

  /// Noma'lum qiymat — `file` (generic hujjat qatori sifatida ochiladi).
  static ReportAttachmentKind fromWire(String? raw) {
    for (final kind in values) {
      if (kind.name == raw) return kind;
    }
    return ReportAttachmentKind.file;
  }
}

/// Kunlik hisobotga biriktirilgan (serverga allaqachon yuklangan) fayl.
class ReportAttachment extends Equatable {
  const ReportAttachment({
    required this.kind,
    required this.url,
    this.fileName,
    this.fileSize,
    this.durationSec,
  });

  factory ReportAttachment.fromJson(Map<String, dynamic> json) {
    return ReportAttachment(
      kind: ReportAttachmentKind.fromWire(json['kind'] as String?),
      url: json['url'] as String? ?? '',
      fileName: json['fileName'] as String?,
      fileSize: (json['fileSize'] as num?)?.toInt(),
      durationSec: (json['durationSec'] as num?)?.toInt(),
    );
  }

  final ReportAttachmentKind kind;

  /// Serverdagi manzil (`/uploads/...` yoki mutlaq http(s)).
  final String url;
  final String? fileName;

  /// Baytlarda.
  final int? fileSize;

  /// Ovoz/video davomiyligi (soniya).
  final int? durationSec;

  Map<String, dynamic> toJson() => {
    'kind': kind.wire,
    'url': url,
    if (fileName != null && fileName!.isNotEmpty)
      'fileName': _fitFileName(fileName!),
    if (fileSize != null) 'fileSize': fileSize,
    if (durationSec != null) 'durationSec': durationSec,
  };

  @override
  List<Object?> get props => [kind, url, fileName, fileSize, durationSec];
}

/// Server `fileName`ni 200 belgigacha qabul qiladi — uzun nom butun
/// hisobotni rad ettirmasin (kengaytma saqlanadi).
String _fitFileName(String name) {
  const max = 200;
  if (name.length <= max) return name;
  final dot = name.lastIndexOf('.');
  final extension = dot < 0 || name.length - dot > 10
      ? ''
      : name.substring(dot);
  var stem = name.substring(0, max - extension.length);
  // Juft (surrogate) belgining o'rtasidan kesmaymiz.
  final last = stem.codeUnitAt(stem.length - 1);
  if (last >= 0xD800 && last <= 0xDBFF) {
    stem = stem.substring(0, stem.length - 1);
  }
  return '$stem$extension';
}

/// `POST /daily-reports` / `GET /daily-reports/my` elementi.
class DailyReport extends Equatable {
  const DailyReport({
    required this.id,
    required this.day,
    required this.createdAt,
    this.employeeId = '',
    this.text = '',
    this.attachments = const [],
  });

  factory DailyReport.fromJson(Map<String, dynamic> json) {
    final createdRaw = json['createdAt'] as String?;
    final created = createdRaw == null ? null : DateTime.tryParse(createdRaw);
    final attachmentsJson = json['attachments'];
    return DailyReport(
      id: '${json['id'] ?? ''}',
      employeeId: '${json['employeeId'] ?? ''}',
      day: _dayOnly(json['day'] as String?) ?? _ymd(created ?? DateTime.now()),
      text: json['text'] as String? ?? '',
      createdAt: (created ?? DateTime.now()).toLocal(),
      attachments: [
        if (attachmentsJson is List)
          for (final item in attachmentsJson)
            if (item is Map<String, dynamic>) ReportAttachment.fromJson(item),
      ],
    );
  }

  final String id;
  final String employeeId;

  /// Hisobot qaysi kun uchun — `YYYY-MM-DD`.
  final String day;
  final String text;
  final List<ReportAttachment> attachments;

  /// Yuborilgan vaqt (mahalliy).
  final DateTime createdAt;

  /// O'chirish faqat yuborilgan kunning o'zida mumkin (server qoidasi —
  /// 403 boshqa kunlarda).
  bool canDeleteOn(DateTime now) =>
      createdAt.year == now.year &&
      createdAt.month == now.month &&
      createdAt.day == now.day;

  @override
  List<Object?> get props => [
    id,
    employeeId,
    day,
    text,
    attachments,
    createdAt,
  ];
}

/// `2026-11-25` yoki `2026-11-25T00:00:00.000Z` → `2026-11-25`.
String? _dayOnly(String? raw) {
  if (raw == null || raw.length < 10) return null;
  return raw.substring(0, 10);
}

String _ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';
