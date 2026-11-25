import 'package:app_ui/app_ui.dart';
// Butun ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/report_formatters.dart';
import 'package:worker_app/features/reports/presentation/widgets/report_attachment_view.dart';

/// Bitta yuborilgan hisobot: yuborilgan vaqt, matn va biriktirmalar.
/// [onDelete] berilsa (faqat bugun yuborilgan hisobot) — o'chirish tugmasi.
class ReportCard extends StatelessWidget {
  const ReportCard({
    required this.report,
    super.key,
    this.onDelete,
    this.deleting = false,
  });

  final DailyReport report;
  final VoidCallback? onDelete;
  final bool deleting;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final muted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final count = report.attachments.length;

    return AppCard(
      padding: const EdgeInsets.fromLTRB(14, 10, 6, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(AppIcons.clock, size: 15, color: muted),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  count == 0
                      ? 'Yuborildi: ${formatClock(report.createdAt)}'
                      : 'Yuborildi: ${formatClock(report.createdAt)}'
                            ' · $count ta fayl',
                  style: AppTextStyles.caption.copyWith(color: muted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (deleting)
                const SizedBox(
                  width: 44,
                  height: 44,
                  child: Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                )
              else if (onDelete != null)
                IconButton(
                  tooltip: "O'chirish",
                  onPressed: onDelete,
                  icon: const Icon(
                    AppIcons.trash,
                    size: 20,
                    color: AppColors.danger,
                  ),
                )
              else
                const SizedBox(height: 44),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (report.text.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  SelectableText(
                    report.text.trim(),
                    style: AppTextStyles.body.copyWith(color: ink),
                  ),
                ],
                if (report.attachments.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  ReportAttachmentsView(attachments: report.attachments),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
