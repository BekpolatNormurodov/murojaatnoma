import 'package:worker_app/features/requests/domain/entities/application.dart';

/// URL / fayl nomi kengaytmasidan biriktirma turi. Noma'lum — hujjat (uni
/// qurilmadagi mos ilova ochadi).
AttachmentType attachmentTypeFor(String? urlOrName) {
  final value = (urlOrName ?? '').split('?').first.toLowerCase();
  final dot = value.lastIndexOf('.');
  final extension = dot < 0 ? '' : value.substring(dot + 1);
  return switch (extension) {
    'jpg' ||
    'jpeg' ||
    'png' ||
    'webp' ||
    'gif' ||
    'heic' ||
    'heif' => AttachmentType.image,
    'mp4' || 'mov' || 'm4v' || 'webm' || '3gp' => AttachmentType.video,
    'm4a' ||
    'aac' ||
    'mp3' ||
    'ogg' ||
    'opus' ||
    'wav' ||
    'amr' => AttachmentType.voice,
    _ => AttachmentType.file,
  };
}
