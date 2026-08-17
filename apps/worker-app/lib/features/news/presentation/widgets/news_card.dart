import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/news/domain/entities/news_item.dart';

/// `NewsItem.publishedAt` kabi ISO sana-vaqt satrini inson o'qiy oladigan
/// ko'rinishga o'giradi; parslab bo'lmasa xom satrni qaytaradi
/// (`formatMeetingDateTime` — `meetings` moduli — bilan bir xil naqsh).
String formatNewsDate(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  return formatDate(parsed);
}

/// Turkum uchun chip rangi — vizual farqlash uchun (taqdimot qatlami
/// ma'sulyati, domen [NewsCategory] o'zi rang haqida bilmaydi).
Color newsCategoryChipColor(NewsCategory category) {
  switch (category) {
    case NewsCategory.elon:
      return AppColors.accent;
    case NewsCategory.tadbir:
      return AppColors.primary;
    case NewsCategory.qaror:
      return AppColors.accentDark;
    case NewsCategory.ogohlantirish:
      return AppColors.warning;
    case NewsCategory.yangilik:
      return AppColors.primaryDark;
  }
}

/// Ro'yxatdagi bitta yangilik kartasi — muqova rasmi, turkum chipi,
/// sarlavha, qisqa tavsif (excerpt) va nashr sanasi.
///
/// Butun karta bosiladigan (tafsilotlar sahifasiga o'tadi) — `MeetingCard`
/// bilan bir xil naqsh.
class NewsCard extends StatelessWidget {
  const NewsCard({required this.item, super.key, this.onTap});

  final NewsItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final surfaceAlt = isDark
        ? AppColors.darkSurfaceAlt
        : AppColors.surfaceAlt;

    return AppCard(
      onTap: onTap,
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (item.cover.isNotEmpty)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppRadii.lg),
              ),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Image.network(
                  item.cover,
                  fit: BoxFit.cover,
                  loadingBuilder: (context, child, progress) =>
                      progress == null
                      ? child
                      : ColoredBox(color: surfaceAlt),
                  errorBuilder: (context, error, stackTrace) => ColoredBox(
                    color: surfaceAlt,
                    child: Icon(AppIcons.imageIcon, color: inkMuted),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AppChip(
                      label: newsCategoryLabel(item.category),
                      color: newsCategoryChipColor(item.category),
                      filled: true,
                    ),
                    const Spacer(),
                    Text(
                      formatNewsDate(item.publishedAt),
                      style: AppTextStyles.caption.copyWith(color: inkMuted),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  item.title,
                  style: AppTextStyles.bodyStrong,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),
                Text(
                  item.excerpt,
                  style: AppTextStyles.caption.copyWith(color: inkSoft),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
