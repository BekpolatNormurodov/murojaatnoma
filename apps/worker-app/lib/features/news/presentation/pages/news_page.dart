import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/news/presentation/bloc/news_cubit.dart';
import 'package:worker_app/features/news/presentation/widgets/news_card.dart';

/// "Yangiliklar" sahifasi — hokimiyat yangiliklari va e'lonlari ro'yxati:
/// muqova, turkum, sarlavha, qisqa tavsif va sana bilan kartalar.
/// `NewsCubit`ning barcha holatlari (yuklanish/bo'sh/xato/yuklandi) shu
/// yerda ko'rsatiladi — hech qachon oq/bo'sh ekran YO'Q.
///
/// Shell tabidan TASHQARIDA, ro'yxatdan (masalan bosh sahifadagi "Tezkor"
/// tugmalari) PUSH qilinadigan to'liq ekranli sahifa — `MeetingsPage`
/// bilan bir xil naqsh: o'z `AppBar`i + `AppBackButton`.
///
/// MUHIM (l10n): boshqa modullardan farqli o'laroq, matnlar `context.
/// l10n` O'RNIGA to'g'ridan-to'g'ri o'zbekcha satrlar sifatida
/// yozilgan — vazifa doirasi `lib/features/news/**` bilan
/// cheklanganligi sababli umumiy `packages/app_core` l10n fayllariga
/// yangi kalitlar qo'shilmadi (orchestrator xohlasa keyinchalik
/// `context.l10n`ga ko'chirishi mumkin).
class NewsPage extends StatelessWidget {
  const NewsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final cubit = context.read<NewsCubit>();

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text('Yangiliklar', style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: BlocBuilder<NewsCubit, NewsState>(
          builder: (context, state) => switch (state) {
            NewsLoading() => const AppSkeletonList(
              key: Key('news_skeleton'),
              avatar: false,
              itemHeight: 140,
            ),
            NewsError(:final message) => _NewsErrorView(
              message: message,
              onRetry: cubit.reload,
            ),
            NewsEmpty() => RefreshIndicator(
              onRefresh: cubit.reload,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(vertical: 40),
                children: const [
                  _NewsEmptyView(),
                ],
              ),
            ),
            NewsLoaded(:final items) => RefreshIndicator(
              onRefresh: cubit.reload,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                itemCount: items.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 14),
                itemBuilder: (context, index) {
                  final news = items[index];
                  return NewsCard(
                    item: news,
                    onTap: () => context.push('/news/${news.id}'),
                  );
                },
              ),
            ),
          },
        ),
      ),
    );
  }
}

class _NewsEmptyView extends StatelessWidget {
  const _NewsEmptyView();

  @override
  Widget build(BuildContext context) {
    return const EmptyState(
      icon: AppIcons.notification,
      title: "Yangiliklar yo'q",
      message: "Hozircha e'lon qilingan yangilik va e'lonlar mavjud emas.",
    );
  }
}

class _NewsErrorView extends StatelessWidget {
  const _NewsErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: 'Yuklashda xatolik',
        message: message,
        action: AppButton(
          label: 'Qayta urinish',
          expand: false,
          onPressed: onRetry,
        ),
      ),
    );
  }
}
