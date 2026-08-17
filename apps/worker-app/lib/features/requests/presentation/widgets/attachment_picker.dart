import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:image_picker/image_picker.dart';
import 'package:worker_app/core/recording/video_recorder_page.dart';
import 'package:worker_app/core/recording/voice_recorder_sheet.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/presentation/widgets/attachment_tile.dart';

/// Biriktirma qo'shish/olib-tashlash boshqaruvchisi — murojaatga javob
/// yozish varag'ida (`RequestDetailPage`) ishlatiladi.
///
/// Boshqariladigan (controlled) komponent: joriy ro'yxatni [attachments]
/// orqali oladi, o'zgarishlarni [onChanged] orqali chiqaradi — haqiqiy
/// ro'yxat holatini chaqiruvchi o'zi saqlaydi (`AppMultiSelect` bilan bir
/// xil naqsh).
///
/// Rasm uchun `image_picker` (galereya/kamera) ishlatiladi. Ovozli xabar
/// va video — REAL qurilma yozib olish (`showVoiceRecorderSheet` —
/// `record`, `showVideoRecorderScreen` — `camera`); "Video" chipida
/// manba sifatida kamera tanlansa ham shu premium recorder ochiladi,
/// galereyadan tanlash esa hamon `image_picker` orqali. Fayl uchun
/// loyihada file-picker paketi hali ulanmagan — shuning uchun MOCK
/// biriktirma yaratiladi (pastdagi "file" metodiga qarang).
// TODO(requests-ui): real file capture — file_picker paketi qo'shilgach
// mock generatori almashtiriladi.
class AttachmentPicker extends StatefulWidget {
  const AttachmentPicker({
    required this.attachments,
    required this.onChanged,
    super.key,
  });

  final List<AttachmentRef> attachments;
  final ValueChanged<List<AttachmentRef>> onChanged;

  @override
  State<AttachmentPicker> createState() => _AttachmentPickerState();
}

class _AttachmentPickerState extends State<AttachmentPicker> {
  final _picker = ImagePicker();
  bool _busy = false;

  Future<void> _addImage() => _pickMedia(isVideo: false);

  /// "Video" chipi — manba tanlash varag'ini ochadi: "Kamera" REAL
  /// qurilma video-yozib-olish sahifasini (`showVideoRecorderScreen`)
  /// ochadi, "Galereya" esa (avvalgidek) `image_picker` orqali mavjud
  /// videoni tanlaydi.
  Future<void> _addVideo() async {
    final source = await _chooseSource(context);
    if (source == null || !mounted) return;

    if (source == ImageSource.camera) {
      await _recordVideo();
    } else {
      await _pickMediaFrom(source, isVideo: true);
    }
  }

  Future<void> _pickMedia({required bool isVideo}) async {
    final source = await _chooseSource(context);
    if (source == null || !mounted) return;
    await _pickMediaFrom(source, isVideo: isVideo);
  }

  Future<void> _pickMediaFrom(
    ImageSource source, {
    required bool isVideo,
  }) async {
    setState(() => _busy = true);
    try {
      final picked = isVideo
          ? await _picker.pickVideo(source: source)
          : await _picker.pickImage(source: source);
      if (picked == null) return;

      final length = await picked.length();
      final ref = AttachmentRef(
        type: isVideo ? AttachmentType.video : AttachmentType.image,
        path: picked.path,
        name: picked.name,
        sizeBytes: length,
      );
      widget.onChanged([...widget.attachments, ref]);
    } on Object {
      if (mounted) {
        AppAlert.error(context, context.l10n.attachmentPickError);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// REAL video yozib olish (`camera` paketi, to'liq-ekran premium
  /// recorder) — muvaffaqiyatda biriktirma ro'yxatiga qo'shadi.
  /// Foydalanuvchi bekor qilsa yoki xatolik bo'lsa (recorder sahifasi
  /// o'zi ham xabar ko'rsatadi) jim qaytadi.
  Future<void> _recordVideo() async {
    setState(() => _busy = true);
    try {
      final result = await showVideoRecorderScreen(context);
      if (result == null || !mounted) return;
      final ref = AttachmentRef(
        type: AttachmentType.video,
        path: result.path,
        name: result.name,
        sizeBytes: result.sizeBytes,
        durationMs: result.durationMs,
      );
      widget.onChanged([...widget.attachments, ref]);
    } on Object {
      if (mounted) {
        AppAlert.error(context, context.l10n.attachmentPickError);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// REAL ovozli xabar yozib olish (`record` paketi, premium varaq) —
  /// muvaffaqiyatda biriktirma ro'yxatiga qo'shadi. Yozib olishning o'zi
  /// har doim haqiqiy qurilma mikrofoni bilan — mock/real backend rejimi
  /// faqat keyingi `respond()` tarmoq chaqiruviga tegishli.
  Future<void> _addVoice() async {
    setState(() => _busy = true);
    try {
      final result = await showVoiceRecorderSheet(context);
      if (result == null || !mounted) return;
      final ref = AttachmentRef(
        type: AttachmentType.voice,
        path: result.path,
        name: result.name,
        sizeBytes: result.sizeBytes,
        durationMs: result.durationMs,
      );
      widget.onChanged([...widget.attachments, ref]);
    } on Object {
      if (mounted) {
        AppAlert.error(context, context.l10n.attachmentPickError);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<ImageSource?> _chooseSource(BuildContext context) {
    final l10n = context.l10n;
    return showAppSheet<ImageSource>(
      context: context,
      title: l10n.attachmentPickSource,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AppListTile(
            title: l10n.attachmentCamera,
            leadingIcon: AppIcons.camera,
            onTap: () => Navigator.of(context).pop(ImageSource.camera),
          ),
          AppListTile(
            title: l10n.attachmentGallery,
            leadingIcon: AppIcons.gallery,
            onTap: () => Navigator.of(context).pop(ImageSource.gallery),
          ),
        ],
      ),
    );
  }

  void _addMockFile() {
    final count = widget.attachments
        .where((a) => a.type == AttachmentType.file)
        .length;
    final ref = AttachmentRef(
      type: AttachmentType.file,
      path: 'mock://file/${DateTime.now().millisecondsSinceEpoch}',
      name: 'Hujjat ${count + 1}.pdf',
    );
    widget.onChanged([...widget.attachments, ref]);
  }

  void _remove(AttachmentRef ref) {
    widget.onChanged(widget.attachments.where((a) => a != ref).toList());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            AppChip(
              label: l10n.attachmentAddImage,
              icon: AppIcons.gallery,
              onTap: _busy ? null : _addImage,
            ),
            AppChip(
              label: l10n.attachmentAddVideo,
              icon: IconsaxPlusLinear.video,
              onTap: _busy ? null : _addVideo,
            ),
            AppChip(
              label: l10n.attachmentAddVoice,
              icon: IconsaxPlusLinear.microphone_2,
              onTap: _busy ? null : () => unawaited(_addVoice()),
            ),
            AppChip(
              label: l10n.attachmentAddFile,
              icon: IconsaxPlusLinear.document_text,
              onTap: _busy ? null : _addMockFile,
            ),
          ],
        ),
        if (widget.attachments.isNotEmpty) ...[
          const SizedBox(height: 12),
          for (final attachment in widget.attachments) ...[
            AttachmentTile(
              attachment: attachment,
              onRemove: () => _remove(attachment),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ],
    );
  }
}
