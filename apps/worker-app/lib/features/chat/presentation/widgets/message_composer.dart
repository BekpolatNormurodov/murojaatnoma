import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:image_picker/image_picker.dart';
import 'package:worker_app/core/recording/video_recorder_page.dart';
import 'package:worker_app/core/recording/voice_recorder_sheet.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/widgets/sticker_catalog.dart';

/// Attach-varag'idagi tanlov — qaysi turdagi biriktirma yuborilishini
/// bildiradi.
enum _AttachOption { image, file, voice, roundVideo, sticker }

/// Suhbat pastidagi yozish paneli — matn maydoni, biriktirish (attach)
/// tugmasi va yuborish tugmasi.
///
/// BARCHA biriktirmalar HAQIQIY qurilma manbalaridan olinadi (mock backend
/// rejimida ham — bu standart loyiha talabi):
/// * rasm — `image_picker` (kamera yoki galereya);
/// * fayl — `file_picker` (qurilma hujjat tanlagichi);
/// * ovozli xabar — REAL mikrofon (`showVoiceRecorderSheet`, `record`
///   paketi — `requests` modulidagi `AttachmentPicker` bilan bir xil
///   premium recorder);
/// * video — REAL kamera bilan yozib olish (`showVideoRecorderScreen`).
///
/// Mock/real backend farqi FAQAT keyingi `sendMessage()` tarmoq
/// chaqiruviga tegishli — yozib olish/tanlashning o'zi doim haqiqiy.
class MessageComposer extends StatefulWidget {
  const MessageComposer({
    required this.onSendText,
    required this.onSendAttachment,
    required this.onSendSticker,
    super.key,
    this.onTyping,
  });

  final ValueChanged<String> onSendText;
  final ValueChanged<ChatAttachment> onSendAttachment;
  final ValueChanged<String> onSendSticker;

  /// "Yozmoqda" signali — matn maydoni bo'sh↔to'la o'zgarganda chaqiriladi
  /// (jonli `chat:typing`). Ixtiyoriy — berilmasa signal yuborilmaydi.
  final ValueChanged<bool>? onTyping;

  @override
  State<MessageComposer> createState() => _MessageComposerState();
}

class _MessageComposerState extends State<MessageComposer> {
  final _controller = TextEditingController();
  final _picker = ImagePicker();
  bool _hasText = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_handleTextChange);
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_handleTextChange)
      ..dispose();
    super.dispose();
  }

  void _handleTextChange() {
    final hasText = _controller.text.trim().isNotEmpty;
    if (hasText != _hasText) {
      setState(() => _hasText = hasText);
      // Matn bo'sh↔to'la o'tishida "yozmoqda" holatini bildiradi (past
      // hajmli signal — har bosishda emas, faqat o'tishda).
      widget.onTyping?.call(hasText);
    }
  }

  void _submitText() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    widget.onSendText(text);
    _controller.clear();
  }

  Future<void> _openAttachSheet() async {
    final l10n = context.l10n;
    final choice = await showAppSheet<_AttachOption>(
      context: context,
      title: l10n.chatAttachSheetTitle,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AppListTile(
            title: l10n.attachmentAddImage,
            leadingIcon: AppIcons.gallery,
            onTap: () => Navigator.of(context).pop(_AttachOption.image),
          ),
          AppListTile(
            title: l10n.attachmentAddFile,
            leadingIcon: IconsaxPlusLinear.document_text,
            onTap: () => Navigator.of(context).pop(_AttachOption.file),
          ),
          AppListTile(
            title: l10n.attachmentAddVoice,
            leadingIcon: IconsaxPlusLinear.microphone_2,
            onTap: () => Navigator.of(context).pop(_AttachOption.voice),
          ),
          AppListTile(
            title: l10n.chatAttachRoundVideo,
            leadingIcon: IconsaxPlusLinear.video_circle,
            // Boshqa qatorlardagi qisqa nomlardan farqli — bu yorliq
            // uzunroq ("Dumaloq video xabar"), shuning uchun bitta qatorga
            // kesib-ellipsis qilib qo'yish o'rniga 2 qatorga o'ralishiga
            // ruxsat beriladi (`titleMaxLines` aynan shu holat uchun).
            titleMaxLines: 2,
            onTap: () => Navigator.of(context).pop(_AttachOption.roundVideo),
          ),
          AppListTile(
            title: l10n.chatAttachSticker,
            leadingIcon: IconsaxPlusLinear.emoji_happy,
            onTap: () => Navigator.of(context).pop(_AttachOption.sticker),
          ),
        ],
      ),
    );
    if (choice == null || !mounted) return;

    switch (choice) {
      case _AttachOption.image:
        await _pickImage();
      case _AttachOption.file:
        await _pickFile();
      case _AttachOption.voice:
        await _recordVoice();
      case _AttachOption.roundVideo:
        await _recordVideo();
      case _AttachOption.sticker:
        await _openStickerSheet();
    }
  }

  /// REAL qurilma hujjat tanlagichi (`file_picker`) — istalgan turdagi
  /// faylni tanlaydi va biriktirma sifatida yuboradi.
  Future<void> _pickFile() async {
    setState(() => _busy = true);
    try {
      final result = await FilePicker.platform.pickFiles();
      if (result == null || !mounted) return;
      final picked = result.files.single;
      final path = picked.path;
      if (path == null) return;
      widget.onSendAttachment(
        ChatAttachment(
          kind: MessageType.file,
          path: path,
          name: picked.name,
          sizeBytes: picked.size,
        ),
      );
    } on Object {
      if (mounted) AppAlert.error(context, context.l10n.attachmentPickError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// REAL kamera bilan video yozib olish (`showVideoRecorderScreen`) —
  /// muvaffaqiyatda darhol biriktirma sifatida yuboradi. Yozib olishning
  /// o'zi doim haqiqiy qurilma kamerasi bilan.
  Future<void> _recordVideo() async {
    setState(() => _busy = true);
    try {
      final media = await showVideoRecorderScreen(context);
      if (media == null || !mounted) return;
      widget.onSendAttachment(
        ChatAttachment(
          kind: MessageType.roundVideo,
          path: media.path,
          name: media.name,
          durationMs: media.durationMs,
          sizeBytes: media.sizeBytes,
        ),
      );
    } on Object {
      if (mounted) AppAlert.error(context, context.l10n.attachmentPickError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickImage() async {
    final l10n = context.l10n;
    final source = await showAppSheet<ImageSource>(
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
    if (source == null || !mounted) return;

    setState(() => _busy = true);
    try {
      final picked = await _picker.pickImage(source: source, imageQuality: 85);
      if (picked == null) return;
      final length = await picked.length();
      widget.onSendAttachment(
        ChatAttachment(
          kind: MessageType.image,
          path: picked.path,
          name: picked.name,
          sizeBytes: length,
        ),
      );
    } on Object {
      if (mounted) AppAlert.error(context, context.l10n.attachmentPickError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// REAL ovozli xabar yozib olish (`record` paketi, `AttachmentPicker`
  /// bilan bir xil premium `showVoiceRecorderSheet`) — muvaffaqiyatda
  /// darhol yuboradi. Yozib olishning o'zi har doim haqiqiy qurilma
  /// mikrofoni bilan — mock/real backend rejimi faqat keyingi
  /// `sendMessage()` tarmoq chaqiruviga tegishli.
  Future<void> _recordVoice() async {
    setState(() => _busy = true);
    try {
      final result = await showVoiceRecorderSheet(context);
      if (result == null || !mounted) return;
      widget.onSendAttachment(
        ChatAttachment(
          kind: MessageType.voice,
          path: result.path,
          name: result.name,
          durationMs: result.durationMs,
          sizeBytes: result.sizeBytes,
        ),
      );
    } on Object {
      if (mounted) AppAlert.error(context, context.l10n.attachmentPickError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openStickerSheet() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final id = await showAppSheet<String>(
      context: context,
      title: context.l10n.chatStickerSheetTitle,
      child: Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final entry in stickerCatalog.entries)
            GestureDetector(
              onTap: () => Navigator.of(context).pop(entry.key),
              child: Container(
                width: 60,
                height: 60,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: surfaceAlt,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Text(entry.value, style: const TextStyle(fontSize: 30)),
              ),
            ),
        ],
      ),
    );
    if (id != null) widget.onSendSticker(id);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: surface,
        border: Border(top: BorderSide(color: line)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Premium "pill" — biriktirish + matn + stiker bitta yumaloq
              // konteynerda (Telegram/iMessage uslubida).
              Expanded(
                child: Container(
                  constraints: const BoxConstraints(
                    minHeight: 44,
                    maxHeight: 132,
                  ),
                  decoration: BoxDecoration(
                    color: surfaceAlt,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: line),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _PillIconButton(
                        icon: IconsaxPlusLinear.paperclip,
                        color: inkSoft,
                        onTap: _busy ? null : _openAttachSheet,
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child: TextField(
                            controller: _controller,
                            minLines: 1,
                            maxLines: 5,
                            keyboardType: TextInputType.multiline,
                            textInputAction: TextInputAction.newline,
                            cursorColor: AppColors.primary,
                            style: AppTextStyles.body.copyWith(color: ink),
                            decoration: InputDecoration(
                              isDense: true,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              hintText: l10n.chatMessageHint,
                              hintStyle: AppTextStyles.body.copyWith(
                                color: inkMuted,
                              ),
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                        ),
                      ),
                      _PillIconButton(
                        icon: IconsaxPlusLinear.emoji_happy,
                        color: inkSoft,
                        onTap: _busy ? null : _openStickerSheet,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Yagona doiraviy asosiy tugma — matn bo'lsa YUBORISH, bo'lmasa
              // MIKROFON (haqiqiy ovoz yozib olish) ko'rinishiga o'zgaradi.
              _PrimaryActionButton(
                showSend: _hasText,
                onTap: _busy ? null : (_hasText ? _submitText : _recordVoice),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pill ichidagi chegarasiz ikon tugmasi (biriktirish / stiker).
class _PillIconButton extends StatelessWidget {
  const _PillIconButton({
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Icon(icon, size: 22, color: color),
      ),
    );
  }
}

/// Yozish paneli oxiridagi 44px doiraviy asosiy tugma — matn holatiga qarab
/// mikrofon↔yuborish ikonini `AnimatedSwitcher` (masshtab+xiralik, ~180ms)
/// bilan almashtiradi.
class _PrimaryActionButton extends StatelessWidget {
  const _PrimaryActionButton({required this.showSend, required this.onTap});

  final bool showSend;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: AppColors.primary,
          shape: BoxShape.circle,
        ),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          transitionBuilder: (child, animation) => ScaleTransition(
            scale: animation,
            child: FadeTransition(opacity: animation, child: child),
          ),
          child: Icon(
            showSend ? AppIcons.send : IconsaxPlusBold.microphone_2,
            key: ValueKey(showSend),
            size: 20,
            color: AppColors.surface,
          ),
        ),
      ),
    );
  }
}
