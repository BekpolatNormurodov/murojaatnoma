import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
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
/// Faqat rasm (`image_picker`: galereya/kamera). Ovoz yozish/fayl tanlash
/// paketlari ulanmagan va backend fuqarodan hujjat qabul qilmaydi — shuning
/// uchun bunday tugmalar ko'rsatilmaydi (soxta fayl yaratilmaydi).
class RequestAttachmentPicker extends StatefulWidget {
  const RequestAttachmentPicker({
    required this.attachments,
    required this.onChanged,
    super.key,
    this.maxCount = defaultMaxCount,
  });

  /// Chaqiruvchilar (masalan `SubmitRequestPage`dagi sarlavha
  /// hisoblagichi: "Fayllar (2/5)") standart chegarani QAYTA
  /// e'lon qilmasdan shu yerdan o'qishi uchun ochiq konstanta.
  static const defaultMaxCount = 5;

  /// Server bitta fayl uchun qabul qiladigan eng katta hajm (25 MB).
  static const maxFileBytes = 25 * 1024 * 1024;

  final List<RequestAttachment> attachments;
  final ValueChanged<List<RequestAttachment>> onChanged;

  /// Bitta murojaatga biriktirsa bo'ladigan MAKSIMAL fayllar soni —
  /// forma "shishib" ketmasligi uchun (sarlavha ustidagi hisoblagichda
  /// ham ko'rsatiladi, qarang: `SubmitRequestPage`).
  final int maxCount;

  @override
  State<RequestAttachmentPicker> createState() =>
      _RequestAttachmentPickerState();
}

class _RequestAttachmentPickerState extends State<RequestAttachmentPicker> {
  final _picker = ImagePicker();
  bool _busy = false;

  bool get _atLimit => widget.attachments.length >= widget.maxCount;

  void _showLimitReached() {
    AppAlert.info(
      context,
      "Ko'pi bilan ${widget.maxCount} ta fayl biriktirishingiz mumkin",
    );
  }

  void _showTooLarge() {
    final ru = Localizations.localeOf(context).languageCode == 'ru';
    AppAlert.error(
      context,
      ru
          ? 'Размер файла не должен превышать 25 МБ'
          : 'Fayl hajmi 25 MB dan oshmasligi kerak',
    );
  }

  Future<void> _addImage() async {
    if (_atLimit) {
      _showLimitReached();
      return;
    }
    final source = await _chooseSource(context);
    if (source == null || !mounted) return;

    setState(() => _busy = true);
    try {
      // 1600 px / 75% (~300 KB) — fuqaro sekin internetda ham yubora oladi.
      final picked = await _picker.pickImage(
        source: source,
        imageQuality: 75,
        maxWidth: 1600,
        maxHeight: 1600,
      );
      if (picked == null) return;

      final length = await picked.length();
      if (!mounted) return;
      // GIF kabi fayllar kichraytirilmaydi — server baribir rad etadi.
      if (length > RequestAttachmentPicker.maxFileBytes) {
        _showTooLarge();
        return;
      }
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
