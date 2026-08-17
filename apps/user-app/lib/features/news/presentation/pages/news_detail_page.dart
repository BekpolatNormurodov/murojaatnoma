import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:user_app/features/news/domain/entities/news_item.dart';
import 'package:user_app/features/news/presentation/widgets/news_section.dart';

/// Bitta e'lon/yangilikning tafsilotlar sahifasi — muqova rasmi, turkum,
/// sarlavha, muallif, nashr sanasi va to'liq matn (`body`).
///
/// [item] to'liq (`body` bilan birga) allaqachon ro'yxat chaqiruvida
/// (`GET /news`) kelgani uchun bu sahifa ALOHIDA tarmoq so'rovi
/// yubormaydi — konstruktor orqali to'g'ridan-to'g'ri beriladi (oddiy
/// `Navigator.push`, go_router marshrutisiz — `NewsSection` shu tarzda
/// ochadi).
class NewsDetailPage extends StatelessWidget {
  const NewsDetailPage({required this.item, super.key});

  final NewsItem item;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final surfaceAlt = isDark
        ? AppColors.darkSurfaceAlt
        : AppColors.surfaceAlt;
    final publishedAtDate = item.publishedAtDate;

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text("E'lon", style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
          children: [
            if (item.cover.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.lg),
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
            const SizedBox(height: 16),
            Row(
              children: [
                AppChip(
                  label: newsCategoryLabel(item.category),
                  color: newsCategoryColor(item.category),
                  filled: true,
                ),
                const Spacer(),
                if (publishedAtDate != null)
                  Text(
                    timeAgo(publishedAtDate),
                    style: AppTextStyles.caption.copyWith(color: inkMuted),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(item.title, style: AppTextStyles.h2),
            const SizedBox(height: 14),
            if (item.author.isNotEmpty) ...[
              AppCard(
                padding: const EdgeInsets.symmetric(
                  vertical: 4,
                  horizontal: 8,
                ),
                child: AppListTile(
                  title: item.author,
                  subtitle: 'Muallif',
                  leadingIcon: AppIcons.profile,
                  showChevron: false,
                ),
              ),
              const SizedBox(height: 20),
            ],
            AppCard(child: Text(item.body, style: AppTextStyles.body)),
          ],
        ),
      ),
    );
  }
}
