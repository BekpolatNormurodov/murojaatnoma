import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:image_picker/image_picker.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/widgets/request_attachment_tile.dart';

/// Biriktirma qo'shish/olib-tashlash boshqaruvchisi — murojaat (ariza/
/// shikoyat) yuborish shaklida ishlatiladi.
///
/// Boshqariladigan (controlled) komponent: joriy ro'yxatni [attachments]
/// orqali oladi, o'zgarishlarni [onChanged] orqali chiqaradi — haqiqiy
/// ro'yxat holatini chaqiruvchi o'zi saqlaydi.
///
/// Rasm uchun `image_picker` (galereya/kamera) ishlatiladi. Ovozli
/// xabar/fayl uchun loyihada recorder/file-picker paketi hali
/// ulanmagan — shuning uchun MOCK biriktirma yaratiladi, shunda oqim va
/// UI to'liq ishlaydi (`worker-app/features/requests` bilan bir xil
/// yondashuv).
// TODO(citizen-requests): real voice/file capture — recorder/file_picker
// paketi qo'shilgach, mock generatorlari almashtiriladi.
class RequestAttachmentPicker extends StatefulWidget {
  const RequestAttachmentPicker({
    required this.attachments,
    required this.onChanged,
    super.key,
  });

  final List<RequestAttachment> attachments;
  final ValueChanged<List<RequestAttachment>> onChanged;

  @override
  State<RequestAttachmentPicker> createState() =>
      _RequestAttachmentPickerState();
}

class _RequestAttachmentPickerState extends State<RequestAttachmentPicker> {
  final _picker = ImagePicker();
  bool _busy = false;

  Future<void> _addImage() async {
    final source = await _chooseSource(context);
    if (source == null || !mounted) return;

    setState(() => _busy = true);
    try {
      final picked = await _picker.pickImage(source: source);
      if (picked == null) return;

      final length = await picked.length();
      final ref = RequestAttachment(
        type: RequestAttachmentType.image,
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

  void _addMockVoice() {
    final count = widget.attachments
        .where((a) => a.type == RequestAttachmentType.voice)
        .length;
    final ref = RequestAttachment(
      type: RequestAttachmentType.voice,
      path: 'mock://voice/${DateTime.now().millisecondsSinceEpoch}.m4a',
      name: '${context.l10n.attachmentAddVoice} ${count + 1}.m4a',
      durationMs: 0,
    );
    widget.onChanged([...widget.attachments, ref]);
  }

  void _addMockFile() {
    final count = widget.attachments
        .where((a) => a.type == RequestAttachmentType.file)
        .length;
    final ref = RequestAttachment(
      type: RequestAttachmentType.file,
      path: 'mock://file/${DateTime.now().millisecondsSinceEpoch}',
      name: '${context.l10n.attachmentAddFile} ${count + 1}.pdf',
    );
    widget.onChanged([...widget.attachments, ref]);
  }

  void _remove(RequestAttachment ref) {
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
              label: l10n.attachmentAddVoice,
              icon: IconsaxPlusLinear.microphone_2,
              onTap: _busy ? null : _addMockVoice,
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
            RequestAttachmentTile(
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
