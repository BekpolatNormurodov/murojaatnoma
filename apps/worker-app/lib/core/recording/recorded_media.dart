import 'package:equatable/equatable.dart';

/// Natija — REAL qurilma darajasida yozib olingan ovoz/video biriktirma.
///
/// Xususiyatga xos modellarga (`AttachmentRef` — `requests` moduli,
/// `ChatAttachment` — `chat` moduli) ataylab bog'liq emas: ovoz/video
/// yozib oluvchi varaqlar (`showVoiceRecorderSheet`, `VideoRecorderPage`)
/// shu umumiy natijani qaytaradi, chaqiruvchi uni o'z modeliga moslaydi.
/// Shu tufayli haqiqiy yozib olish mantig'i ikkala modul o'rtasida bitta
/// joyda qayta ishlatiladi.
class RecordedMedia extends Equatable {
  const RecordedMedia({
    required this.path,
    required this.name,
    required this.durationMs,
    this.sizeBytes,
  });

  /// Qurilmadagi haqiqiy fayl yo'li (`<appDocs>/attachments/...`).
  final String path;

  /// Ko'rsatiladigan fayl nomi (masalan `Ovozli xabar 14:32.m4a`).
  final String name;

  /// Yozuv davomiyligi (millisekundlarda).
  final int durationMs;

  /// Fayl hajmi (baytlarda) — o'qib bo'lmasa `null`.
  final int? sizeBytes;

  @override
  List<Object?> get props => [path, name, durationMs, sizeBytes];
}
