import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:file_picker/file_picker.dart';
// Butun ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:image_picker/image_picker.dart';
import 'package:worker_app/core/recording/video_recorder_page.dart';
import 'package:worker_app/core/recording/voice_recorder_sheet.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/report_formatters.dart';
import 'package:worker_app/features/reports/domain/usecases/submit_report.dart';
import 'package:worker_app/features/reports/presentation/bloc/report_compose_cubit.dart';
import 'package:worker_app/features/reports/presentation/widgets/compose_attachment_tile.dart';

/// Server `/uploads/document` qabul qiladigan hujjat kengaytmalari.
const List<String> kReportDocumentExtensions = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'rtf',
  'odt',
  'ods',
  'zip',
];

/// Yangi kunlik hisobot: kun tanlash (bugun + oldingi 7 kun), matn,
/// ovoz/video/rasm/hujjat biriktirish. Har bir fayl biriktirilishi bilan
/// yuklanadi; "Yuborish" hammasi yuklangach faol. Muvaffaqiyatda
/// `pop(true)`.
///
/// [ReportComposeCubit] router'da (`/reports/new`) ta'minlanadi.
class ReportComposePage extends StatefulWidget {
  const ReportComposePage({super.key});

  @override
  State<ReportComposePage> createState() => _ReportComposePageState();
}

class _ReportComposePageState extends State<ReportComposePage> {
  final _textController = TextEditingController();
  final _picker = ImagePicker();
  bool _picking = false;

  @override
  void initState() {
    super.initState();
    // Tiklangan qoralama matni.
    _textController
      ..text = context.read<ReportComposeCubit>().state.text
      ..addListener(_onTextChanged);
  }

  void _onTextChanged() {
    context.read<ReportComposeCubit>().setText(_textController.text);
  }

  @override
  void dispose() {
    _textController
      ..removeListener(_onTextChanged)
      ..dispose();
    super.dispose();
  }

  ReportComposeCubit get _cubit => context.read<ReportComposeCubit>();

  bool _limitReached() {
    if (_cubit.state.attachments.length < SubmitReport.maxAttachments) {
      return false;
    }
    AppAlert.warning(
      context,
      "Ko'pi bilan ${SubmitReport.maxAttachments} ta fayl biriktirish mumkin",
    );
    return true;
  }

  void _add({
    required ReportAttachmentKind kind,
    required String path,
    required String name,
    int? sizeBytes,
    int? durationSec,
  }) {
    final error = _cubit.addFile(
      kind: kind,
      path: path,
      name: name,
      sizeBytes: sizeBytes,
      durationSec: durationSec,
    );
    if (error != null && mounted) AppAlert.error(context, error);
  }

  /// Picker oqimini umumiy himoya bilan bajaradi (bir vaqtda bitta,
  /// xatolar ushlanadi, `mounted` tekshiriladi).
  Future<void> _guardedPick(Future<void> Function() run) async {
    if (_picking || _limitReached()) return;
    setState(() => _picking = true);
    try {
      await run();
    } on Object {
      if (mounted) AppAlert.error(context, context.l10n.attachmentPickError);
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  Future<void> _addVoice() => _guardedPick(() async {
    final media = await showVoiceRecorderSheet(context);
    if (media == null || !mounted) return;
    _add(
      kind: ReportAttachmentKind.voice,
      path: media.path,
      name: media.name,
      sizeBytes: media.sizeBytes,
      durationSec: (media.durationMs / 1000).round(),
    );
  });

  Future<void> _addVideo() => _guardedPick(() async {
    final source = await _chooseSource();
    if (source == null || !mounted) return;
    if (source == ImageSource.camera) {
      final media = await showVideoRecorderScreen(context);
      if (media == null || !mounted) return;
      _add(
        kind: ReportAttachmentKind.video,
        path: media.path,
        name: media.name,
        sizeBytes: media.sizeBytes,
        durationSec: (media.durationMs / 1000).round(),
      );
      return;
    }
    final picked = await _picker.pickVideo(source: ImageSource.gallery);
    if (picked == null || !mounted) return;
    final length = await picked.length();
    if (!mounted) return;
    _add(
      kind: ReportAttachmentKind.video,
      path: picked.path,
      name: picked.name,
      sizeBytes: length,
    );
  });

  Future<void> _addPhoto() => _guardedPick(() async {
    final source = await _chooseSource();
    if (source == null || !mounted) return;
    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 80,
      maxWidth: 2000,
      maxHeight: 2000,
    );
    if (picked == null || !mounted) return;
    final length = await picked.length();
    if (!mounted) return;
    _add(
      kind: ReportAttachmentKind.image,
      path: picked.path,
      name: picked.name,
      sizeBytes: length,
    );
  });

  Future<void> _addDocument() => _guardedPick(() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: kReportDocumentExtensions,
    );
    if (result == null || result.files.isEmpty || !mounted) return;
    final picked = result.files.single;
    final path = picked.path;
    if (path == null) {
      AppAlert.error(context, context.l10n.attachmentPickError);
      return;
    }
    _add(
      kind: ReportAttachmentKind.file,
      path: path,
      name: picked.name,
      sizeBytes: picked.size,
    );
  });

  Future<ImageSource?> _chooseSource() {
    final l10n = context.l10n;
    return showAppSheet<ImageSource>(
      context: context,
      title: l10n.attachmentPickSource,
      child: Builder(
        builder: (sheetContext) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppListTile(
              title: l10n.attachmentCamera,
              leadingIcon: AppIcons.camera,
              onTap: () => Navigator.of(sheetContext).pop(ImageSource.camera),
            ),
            AppListTile(
              title: l10n.attachmentGallery,
              leadingIcon: AppIcons.gallery,
              onTap: () => Navigator.of(sheetContext).pop(ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _send() async {
    FocusScope.of(context).unfocus();
    final error = await _cubit.submit();
    if (!mounted) return;
    if (error != null) {
      AppAlert.error(context, error);
      return;
    }
    Navigator.of(context).pop(true);
  }

  Future<void> _onPopBlocked() async {
    final state = _cubit.state;
    if (state.submitting) return;
    final leave = await AppDialog.confirm(
      context: context,
      title: 'Hisobot yuborilmadi',
      message: _cubit.keepsDraft
          ? 'Qoralama saqlanadi — keyin davom ettirasiz. Chiqasizmi?'
          : 'Yozganlaringiz saqlanmaydi. Chiqasizmi?',
      confirmLabel: 'Chiqish',
      cancelLabel: 'Qolish',
      danger: true,
    );
    if (leave && mounted) Navigator.of(context).pop(false);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final soft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    return BlocBuilder<ReportComposeCubit, ReportComposeState>(
      builder: (context, state) {
        final busy = state.submitting || _picking;
        return PopScope(
          canPop: state.isEmpty && !state.submitting,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) unawaited(_onPopBlocked());
          },
          child: Scaffold(
            backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
            resizeToAvoidBottomInset: true,
            appBar: AppBar(
              leading: const AppBackButton(),
              title: const Text('Yangi hisobot'),
            ),
            body: SafeArea(
              child: Column(
                children: [
                  Expanded(
                    child: ListView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                      children: [
                        _Label('Qaysi kun uchun', color: soft),
                        const SizedBox(height: 8),
                        _DayPicker(
                          days: state.allowedDays,
                          selected: state.day,
                          enabled: !state.submitting,
                          onSelected: _cubit.setDay,
                        ),
                        const SizedBox(height: 18),
                        _Label('Bugun nima ish qildingiz?', color: soft),
                        const SizedBox(height: 8),
                        AppTextField(
                          key: const Key('report_text_field'),
                          controller: _textController,
                          hint: 'Qilingan ishlar, natijalar, muammolar…',
                          keyboardType: TextInputType.multiline,
                          textInputAction: TextInputAction.newline,
                          maxLines: 8,
                          maxLength: SubmitReport.maxTextLength,
                          enabled: !state.submitting,
                        ),
                        const SizedBox(height: 4),
                        Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                            '${state.text.length} / '
                            '${SubmitReport.maxTextLength}',
                            style: AppTextStyles.caption.copyWith(
                              color: muted,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _Label('Biriktirmalar', color: soft),
                            ),
                            Text(
                              '${state.attachments.length} / '
                              '${SubmitReport.maxAttachments}',
                              style: AppTextStyles.caption.copyWith(
                                color: muted,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        _AttachButtons(
                          enabled: !busy,
                          onVoice: () => unawaited(_addVoice()),
                          onVideo: () => unawaited(_addVideo()),
                          onPhoto: () => unawaited(_addPhoto()),
                          onDocument: () => unawaited(_addDocument()),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Har bir fayl 25 MB gacha, jami 10 tagacha. '
                          "Kameradan video ko'pi bilan 1:30.",
                          style: AppTextStyles.caption.copyWith(color: muted),
                        ),
                        for (final a in state.attachments) ...[
                          const SizedBox(height: 8),
                          ComposeAttachmentTile(
                            key: ValueKey(a.localId),
                            attachment: a,
                            enabled: !state.submitting,
                            onRemove: () => _cubit.remove(a.localId),
                            onRetry: () => _cubit.retry(a.localId),
                          ),
                        ],
                      ],
                    ),
                  ),
                  _SendBar(state: state, onSend: () => unawaited(_send())),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text, {required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: AppTextStyles.label.copyWith(color: color),
    maxLines: 2,
    overflow: TextOverflow.ellipsis,
  );
}

/// Bugun + oldingi 7 kun — gorizontal skroll qilinadigan chiplar (katta
/// shriftda ham toshib ketmaydi).
class _DayPicker extends StatelessWidget {
  const _DayPicker({
    required this.days,
    required this.selected,
    required this.enabled,
    required this.onSelected,
  });

  final List<String> days;
  final String selected;
  final bool enabled;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < days.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            AppChip(
              key: ValueKey('day_${days[i]}'),
              label: _label(days[i], i),
              selected: days[i] == selected,
              filled: days[i] == selected,
              onTap: enabled ? () => onSelected(days[i]) : null,
            ),
          ],
        ],
      ),
    );
  }

  static String _label(String day, int index) {
    if (index == 0) return 'Bugun';
    if (index == 1) return 'Kecha';
    final date = parseYmd(day);
    return date == null ? day : formatDayShort(date);
  }
}

/// Ovoz / Video / Rasm / Hujjat — teng kenglikdagi 2×2 to'r.
class _AttachButtons extends StatelessWidget {
  const _AttachButtons({
    required this.enabled,
    required this.onVoice,
    required this.onVideo,
    required this.onPhoto,
    required this.onDocument,
  });

  final bool enabled;
  final VoidCallback onVoice;
  final VoidCallback onVideo;
  final VoidCallback onPhoto;
  final VoidCallback onDocument;

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Ovoz', IconsaxPlusLinear.microphone_2, onVoice),
      ('Video', IconsaxPlusLinear.video, onVideo),
      ('Rasm', AppIcons.gallery, onPhoto),
      ('Hujjat', IconsaxPlusLinear.document_text, onDocument),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        const spacing = 8.0;
        final itemWidth = (constraints.maxWidth - spacing) / 2;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final (label, icon, onTap) in items)
              SizedBox(
                width: itemWidth,
                child: AppChip(
                  label: label,
                  icon: icon,
                  onTap: enabled ? onTap : null,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _SendBar extends StatelessWidget {
  const _SendBar({required this.state, required this.onSend});

  final ReportComposeState state;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final muted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final hint = state.isUploading
        ? 'Fayllar yuklanmoqda…'
        : state.hasFailed
        ? 'Yuklanmagan fayllarni qayta yuklang yoki olib tashlang'
        : null;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(
        color: surface,
        border: Border(top: BorderSide(color: line)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hint != null) ...[
            Text(
              hint,
              style: AppTextStyles.caption.copyWith(
                color: state.hasFailed ? AppColors.danger : muted,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
          ],
          AppButton(
            key: const Key('report_send_button'),
            label: 'Yuborish',
            icon: AppIcons.send,
            loading: state.submitting,
            onPressed: state.canSend ? onSend : null,
          ),
        ],
      ),
    );
  }
}
