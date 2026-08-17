import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/widgets/app_shimmer.dart';
import 'package:user_app/core/widgets/empty_view.dart';
import 'package:user_app/core/widgets/error_view.dart';
import 'package:user_app/features/news/domain/entities/news_item.dart';
import 'package:user_app/features/news/presentation/bloc/news_cubit.dart';
import 'package:user_app/features/news/presentation/pages/news_detail_page.dart';
import 'package:user_app/injection.dart';

/// [NewsItem.category] (xom satr)ni foydalanuvchiga ko'rsatsa bo'ladigan
/// o'zbekcha nomga o'giradi. Bilinmagan/kelajakda qo'shiladigan turkum
/// xavfsiz ravishda xom qiymatning o'ziga (yoki bo'sh bo'lsa "Yangilik"ga)
/// tushadi — hech qachon qulamaydi.
String newsCategoryLabel(String category) {
  switch (category.trim().toLowerCase()) {
    case 'elon':
      return "E'lon";
    case 'tadbir':
      return 'Tadbir';
    case 'qaror':
      return 'Qaror';
    case 'ogohlantirish':
      return 'Ogohlantirish';
    case 'yangilik':
      return 'Yangilik';
    default:
      return category.trim().isEmpty ? 'Yangilik' : category.trim();
  }
}

/// Turkum uchun chip rangi — vizual farqlash uchun (taqdimot qatlami
/// mas'uliyati, domen [NewsItem] o'zi rang haqida bilmaydi).
Color newsCategoryColor(String category) {
  switch (category.trim().toLowerCase()) {
    case 'elon':
      return AppColors.accent;
    case 'tadbir':
      return AppColors.primary;
    case 'qaror':
      return AppColors.accentDark;
    case 'ogohlantirish':
      return AppColors.warning;
    default:
      return AppColors.primaryDark;
  }
}

/// Bosh sahifadagi "E'lonlar" bo'limi — so'nggi bir necha (standart 5) ta
/// e'lon/yangilikni gorizontal kartalar qatorida ko'rsatadi.
///
/// O'ZINI-O'ZI ta'minlaydi: ichkarida o'zining `NewsCubit`ini (`getIt`dan,
/// factory) yaratadi va darhol yuklaydi — bosh sahifaning routerdagi
/// `BlocProvider` zanjiriga (`HomeCubit`) tegishlilik shart emas, shu
/// tufayli `app_router.dart`ga tegmasdan to'g'ridan-to'g'ri
/// `home_page.dart`ning ichiga BITTA widget sifatida qo'shiladi.
///
/// `NewsCubit`ning BARCHA holatlari (`loading`/`loaded`/`empty`/`error`)
/// shu yerda ko'rsatiladi — hech qachon oq/bo'sh joy YO'Q.
class NewsSection extends StatelessWidget {
  const NewsSection({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<NewsCubit>(
      create: (_) => getIt<NewsCubit>()..load(),
      child: const _NewsSectionBody(),
    );
  }
}

class _NewsSectionBody extends StatelessWidget {
  const _NewsSectionBody();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<NewsCubit, NewsState>(
      builder: (context, state) => switch (state) {
        NewsLoading() => const _NewsSectionShell(
          key: Key('news_section_loading'),
          child: _NewsSkeletonRow(),
        ),
        NewsError(:final message) => _NewsSectionShell(
          key: const Key('news_section_error'),
          child: ErrorView(
            message: message,
            onRetry: () => context.read<NewsCubit>().reload(),
          ),
        ),
        NewsEmpty() => const _NewsSectionShell(
          key: Key('news_section_empty'),
          child: EmptyView(
            icon: AppIcons.notification,
            title: "Hozircha e'lonlar yo'q",
            message: "Tez orada yangi e'lon va yangiliklar joylanadi.",
          ),
        ),
        NewsLoaded(:final items) => _NewsSectionShell(
          key: const Key('news_section_loaded'),
          child: _NewsRow(items: items),
        ),
      },
    );
  }
}

/// Bo'lim sarlavhasi ("E'lonlar") + ixtiyoriy kontent — barcha holatlar
/// (yuklanish/xato/bo'sh/yuklandi) shu bitta qobiqni ishlatadi, shu
/// tufayli sarlavha holat almashganda ham joyida qoladi.
class _NewsSectionShell extends StatelessWidget {
  const _NewsSectionShell({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "E'lonlar",
          style: AppTextStyles.h3,
        ).animate(delay: 240.ms).fadeIn(duration: 300.ms),
        const SizedBox(height: 14),
        child,
      ],
    );
  }
}

/// Yuklanish holati — haqiqiy gorizontal kartalar qatoriga mos "shaped"
/// skeleton, [ShimmerBox]lardan yig'ilgan.
class _NewsSkeletonRow extends StatelessWidget {
  const _NewsSkeletonRow();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: _kCardHeight,
      child: Row(
        children: [
          Expanded(
            child: ShimmerBox(
              width: double.infinity,
              radius: 20,
              height: _kCardHeight,
            ),
          ),
          SizedBox(width: 12),
          Expanded(
            child: ShimmerBox(
              width: double.infinity,
              radius: 20,
              height: _kCardHeight,
            ),
          ),
        ],
      ),
    );
  }
}

const double _kCardHeight = 250;
const double _kCardWidth = 220;

class _NewsRow extends StatelessWidget {
  const _NewsRow({required this.items});

  final List<NewsItem> items;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _kCardHeight,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        itemCount: items.length,
        separatorBuilder: (context, index) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final item = items[index];
          return _NewsMiniCard(
            item: item,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => NewsDetailPage(item: item),
              ),
            ),
          );
        },
      ),
    ).animate(delay: 300.ms).fadeIn(duration: 300.ms);
  }
}

/// Bitta e'lon kartasi — muqova rasmi ([Image.network], errorBuilder bilan
/// himoyalangan), sarlavha, qisqa tavsif va nisbiy nashr sanasi
/// ([timeAgo]).
class _NewsMiniCard extends StatelessWidget {
  const _NewsMiniCard({required this.item, this.onTap});

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

    final publishedAtDate = item.publishedAtDate;

    return SizedBox(
      width: _kCardWidth,
      child: AppCard(
        onTap: onTap,
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppRadii.lg),
              ),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: item.cover.isEmpty
                    ? ColoredBox(
                        color: surfaceAlt,
                        child: Icon(AppIcons.imageIcon, color: inkMuted),
                      )
                    : Image.network(
                        item.cover,
                        fit: BoxFit.cover,
                        loadingBuilder: (context, child, progress) =>
                            progress == null
                            ? child
                            : ColoredBox(color: surfaceAlt),
                        errorBuilder: (context, error, stackTrace) =>
                            ColoredBox(
                              color: surfaceAlt,
                              child: Icon(
                                AppIcons.imageIcon,
                                color: inkMuted,
                              ),
                            ),
                      ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item.title,
                      style: AppTextStyles.bodyStrong,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      item.excerpt,
                      style: AppTextStyles.caption.copyWith(color: inkSoft),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      publishedAtDate == null
                          ? ''
                          : timeAgo(publishedAtDate),
                      style: AppTextStyles.caption.copyWith(
                        color: inkMuted,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
