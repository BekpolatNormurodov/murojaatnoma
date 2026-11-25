import 'package:app_ui/app_ui.dart';
// Butun ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/report_formatters.dart';
import 'package:worker_app/features/reports/presentation/bloc/report_compose_cubit.dart';

/// Yangi hisobot formasidagi biriktirma — turi, nomi, hajmi va yuklash
/// holati (progress / tayyor / xato + "Qayta"), o'ngda olib tashlash.
class ComposeAttachmentTile extends StatelessWidget {
  const ComposeAttachmentTile({
    required this.attachment,
    required this.onRemove,
    required this.onRetry,
    super.key,
    this.enabled = true,
  });

  final ComposeAttachment attachment;
  final VoidCallback onRemove;
  final VoidCallback onRetry;
  final bool enabled;

  static IconData _icon(ReportAttachmentKind kind) => switch (kind) {
    ReportAttachmentKind.image => IconsaxPlusLinear.gallery,
    ReportAttachmentKind.video => IconsaxPlusLinear.video,
    ReportAttachmentKind.voice => IconsaxPlusLinear.microphone_2,
    ReportAttachmentKind.file => IconsaxPlusLinear.document_text,
  };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final muted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final failed = attachment.status == ComposeUploadStatus.failed;
    final uploading = attachment.status == ComposeUploadStatus.uploading;

    final meta = <String>[
      if (attachment.sizeBytes != null) formatFileSize(attachment.sizeBytes!),
      if (attachment.durationSec != null && attachment.durationSec! > 0)
        formatDurationSec(attachment.durationSec!),
    ];
    final statusText = switch (attachment.status) {
      ComposeUploadStatus.uploading =>
        'Yuklanmoqda… ${(attachment.progress * 100).round()}%',
      ComposeUploadStatus.uploaded => 'Yuklandi',
      ComposeUploadStatus.failed => attachment.error ?? 'Yuklanmadi',
    };

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(
          color: failed ? AppColors.danger.withValues(alpha: 0.5) : line,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadii.xs),
            ),
            child: Icon(
              _icon(attachment.kind),
              size: 20,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  attachment.name,
                  style: AppTextStyles.body.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  [...meta, statusText].join(' • '),
                  style: AppTextStyles.caption.copyWith(
                    color: failed ? AppColors.danger : muted,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (uploading) ...[
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: attachment.progress <= 0
                          ? null
                          : attachment.progress,
                      minHeight: 3,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (failed)
            IconButton(
              tooltip: 'Qayta yuklash',
              onPressed: enabled ? onRetry : null,
              icon: const Icon(IconsaxPlusLinear.refresh, size: 20),
            )
          else if (attachment.status == ComposeUploadStatus.uploaded)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Icon(
                IconsaxPlusBold.tick_circle,
                size: 20,
                color: AppColors.success,
              ),
            ),
          IconButton(
            tooltip: 'Olib tashlash',
            onPressed: enabled ? onRemove : null,
            icon: const Icon(
              IconsaxPlusLinear.close_circle,
              size: 20,
              color: AppColors.danger,
            ),
          ),
        ],
      ),
    );
  }
}
