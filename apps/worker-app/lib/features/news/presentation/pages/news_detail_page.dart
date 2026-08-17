import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/news/domain/entities/news_item.dart';
import 'package:worker_app/features/news/presentation/bloc/news_detail_cubit.dart';
import 'package:worker_app/features/news/presentation/widgets/news_card.dart';

/// "Yangilik tafsilotlari" sahifasi — muqova rasmi, sarlavha, turkum,
/// muallif, nashr sanasi va to'liq matn (`body`).
///
/// Konstruktor parametrsiz — kerakli ID router tomonidan `NewsDetailCubit.
/// load(id)` orqali allaqachon berilgan bo'ladi (`MeetingDetailPage`
/// bilan bir xil naqsh).
class NewsDetailPage extends StatelessWidget {
  const NewsDetailPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text('Yangilik', style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: BlocBuilder<NewsDetailCubit, NewsDetailState>(
          builder: (context, state) => switch (state) {
            NewsDetailLoading() => const _DetailSkeleton(
              key: Key('news_detail_skeleton'),
            ),
            NewsDetailError(:final message) => _DetailErrorView(
              message: message,
            ),
            NewsDetailLoaded(:final item) => _DetailContent(item: item),
          },
        ),
      ),
    );
  }
}

class _DetailContent extends StatelessWidget {
  const _DetailContent({required this.item});

  final NewsItem item;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final surfaceAlt = isDark
        ? AppColors.darkSurfaceAlt
        : AppColors.surfaceAlt;

    return ListView(
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
                    progress == null ? child : ColoredBox(color: surfaceAlt),
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
        const SizedBox(height: 12),
        Text(item.title, style: AppTextStyles.h2),
        const SizedBox(height: 14),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
          child: AppListTile(
            title: item.author,
            subtitle: 'Muallif',
            leadingIcon: AppIcons.profile,
            showChevron: false,
          ),
        ),
        const SizedBox(height: 20),
        AppCard(
          child: Text(item.body, style: AppTextStyles.body),
        ),
      ],
    );
  }
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadii.lg);
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSkeleton(
            width: double.infinity,
            height: 180,
            borderRadius: radius,
          ),
          const SizedBox(height: 16),
          const AppSkeleton(width: 100),
          const SizedBox(height: 12),
          const AppSkeleton(width: double.infinity, height: 24),
          const SizedBox(height: 8),
          const AppSkeleton(width: 220, height: 24),
          const SizedBox(height: 20),
          AppSkeleton(width: double.infinity, height: 54, borderRadius: radius),
          const SizedBox(height: 20),
          AppSkeleton(
            width: double.infinity,
            height: 160,
            borderRadius: radius,
          ),
        ],
      ),
    );
  }
}

class _DetailErrorView extends StatelessWidget {
  const _DetailErrorView({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: 'Yangilik topilmadi',
        message: message,
        action: AppButton(
          label: 'Qayta urinish',
          expand: false,
          onPressed: () => context.read<NewsDetailCubit>().retry(),
        ),
      ),
    );
  }
}
