import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';
import 'package:worker_app/features/documents/presentation/widgets/document_status_chip.dart';
import 'package:worker_app/features/documents/presentation/widgets/document_type_chip.dart';

/// `DocumentItem.createdAt` kabi ISO sana satrini inson o'qiy oladigan
/// ko'rinishga o'giradi; parslab bo'lmasa xom satrni qaytaradi
/// (`formatMeetingDateTime` — `meetings` moduli — bilan bir xil naqsh,
/// mock ma'lumotlar doim to'g'ri formatda, lekin himoya sifatida).
String formatDocumentDate(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  return formatDate(parsed);
}

/// Fayl hajmini (kilobaytlarda) inson o'qiy oladigan ko'rinishga o'giradi
/// — `1024` KB dan katta bo'lsa megabaytda (`"1.4 MB"`), aks holda
/// kilobaytda (`"320 KB"`) ko'rsatadi.
String formatFileSize(int sizeKb) {
  if (sizeKb >= 1024) {
    final mb = sizeKb / 1024;
    return '${mb.toStringAsFixed(1)} MB';
  }
  return '$sizeKb KB';
}

/// Ro'yxatdagi bitta hujjat kartasi — kod + sarlavha, tur/holat chiplari,
/// sana va fayl hajmi.
///
/// Butun karta bosiladigan (tafsilotlar sahifasiga o'tadi) —
/// `MeetingCard`/`ApplicationCard` bilan bir xil naqsh.
class DocumentCard extends StatelessWidget {
  const DocumentCard({required this.document, super.key, this.onTap});

  final DocumentItem document;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      document.code,
                      style: AppTextStyles.caption.copyWith(color: inkSoft),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      document.title,
                      style: AppTextStyles.bodyStrong,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              DocumentStatusChip(status: document.status),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [DocumentTypeChip(type: document.type)],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(AppIcons.calendar, size: 14, color: inkMuted),
              const SizedBox(width: 4),
              Text(
                formatDocumentDate(document.createdAt),
                style: AppTextStyles.caption.copyWith(color: inkMuted),
              ),
              const SizedBox(width: 14),
              Icon(AppIcons.receipt, size: 14, color: inkMuted),
              const SizedBox(width: 4),
              Text(
                formatFileSize(document.sizeKb),
                style: AppTextStyles.caption.copyWith(color: inkMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
