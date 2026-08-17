import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/face/data/services/face_photo_store.dart';
import 'package:user_app/features/home/presentation/bloc/home_cubit.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/injection.dart';

/// Fuqaro bosh sahifasi (dashboard) — 4-tab shellning "home" branchi.
///
/// Konstruktor parametrsiz: kerakli hamma narsani (`HomeCubit`,
/// `AuthCubit`) CONTEXT orqali o'qiydi. `HomeCubit.load()`ning BARCHA
/// holatlari (`loading`/`loaded`/`empty`/`error`) shu yerda ko'rsatiladi —
/// hech qachon oq/bo'sh ekran YO'Q.
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      body: SafeArea(
        child: BlocBuilder<HomeCubit, HomeState>(
          builder: (context, state) => switch (state) {
            HomeLoading() => const _HomeSkeleton(key: Key('home_skeleton')),
            HomeError(:final message) => _HomeErrorView(
              message: message,
              onRetry: () => context.read<HomeCubit>().load(),
            ),
            HomeEmpty() => const _HomeContent(
              utilities: [],
              totalDue: 0,
              isEmpty: true,
            ),
            HomeLoaded(:final utilities, :final totalDue) => _HomeContent(
              utilities: utilities,
              totalDue: totalDue,
              isEmpty: false,
            ),
          },
        ),
      ),
    );
  }
}

class _HomeContent extends StatelessWidget {
  const _HomeContent({
    required this.utilities,
    required this.totalDue,
    required this.isEmpty,
  });

  final List<Utility> utilities;
  final double totalDue;
  final bool isEmpty;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<AuthCubit>().state.session;

    return LayoutBuilder(
      builder: (context, constraints) {
        final horizontalPadding = constraints.maxWidth > 640
            ? (constraints.maxWidth - 560) / 2
            : 20.0;

        return RefreshIndicator(
          onRefresh: () => context.read<HomeCubit>().load(),
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              horizontalPadding,
              20,
              horizontalPadding,
              32,
            ),
            children: [
              _GreetingHeader(session: session),
              const SizedBox(height: 22),
              _TotalDueCard(totalDue: totalDue, isEmpty: isEmpty),
              const SizedBox(height: 26),
              Text(
                l10n.quickActionsTitle,
                style: AppTextStyles.h3,
              ).animate(delay: 160.ms).fadeIn(duration: 300.ms),
              const SizedBox(height: 14),
              const _QuickActionsGrid(),
            ],
          ),
        );
      },
    );
  }
}

class _GreetingHeader extends StatefulWidget {
  const _GreetingHeader({required this.session});

  final AuthSession? session;

  @override
  State<_GreetingHeader> createState() => _GreetingHeaderState();
}

class _GreetingHeaderState extends State<_GreetingHeader> {
  // Skanerlangan yuz rasmini bir marta yuklaydi (profil sarlavhasi bilan
  // bir xil manba, `FacePhotoStore`). DI'da ro'yxatdan o'tmagan bo'lsa
  // (masalan widget testda) xotirjam `null` — avatar initsiallarni
  // ko'rsatadi, hech qachon uncaught bo'lmaydi.
  late final Future<String?> _photoPath = getIt.isRegistered<FacePhotoStore>()
      ? getIt<FacePhotoStore>().currentPath()
      : Future<String?>.value();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final name = widget.session?.name ?? '';
    final phone = widget.session?.phone ?? '';
    final subtitleParts = <String>[
      if (phone.isNotEmpty) phone,
      formatDate(DateTime.now()),
    ];

    return Row(
      children: [
        FutureBuilder<String?>(
          future: _photoPath,
          builder: (context, snapshot) => _FaceAvatar(
            name: name.isEmpty ? '?' : name,
            size: 56,
            photoPath: snapshot.data,
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.homeGreeting,
                style: AppTextStyles.body.copyWith(color: inkMuted),
              ),
              Text(
                name,
                style: AppTextStyles.h2,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                subtitleParts.join(' • '),
                style: AppTextStyles.caption.copyWith(color: inkMuted),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        const _NotificationBell(),
      ],
    ).animate().fadeIn(duration: 300.ms).slideY(begin: -0.08, end: 0);
  }
}

/// Bosh sahifa sarlavha avatari — saqlangan (skanerlangan) yuz rasmi
/// bo'lsa doiraviy foto, aks holda initsiallarga qaytadi. `File.existsSync()`
/// himoyasi + `AppAvatar` errorBuilder'i tufayli hech qachon qulamaydi
/// (profil sarlavhasidagi `_FaceAvatar` bilan bir xil naqsh).
class _FaceAvatar extends StatelessWidget {
  const _FaceAvatar({required this.name, required this.size, this.photoPath});

  final String name;
  final double size;
  final String? photoPath;

  @override
  Widget build(BuildContext context) {
    final path = photoPath;
    final hasPhoto = path != null && File(path).existsSync();
    return AppAvatar(
      name: name,
      size: size,
      image: hasPhoto ? FileImage(File(path)) : null,
    );
  }
}

/// Bosh sahifa sarlavhasidagi qo'ng'iroq belgisi — `/notifications`
/// sahifasiga PUSH qiladi va `NotificationsCubit.unreadCount` bo'yicha
/// kichik qizil nuqta ko'rsatadi (o'qilmagan bildirishnoma bo'lsa).
/// `NotificationsCubit` ilova ildizida LAZY SINGLETON sifatida
/// ta'minlangan (qarang: `app.dart`), shuning uchun bu yerda
/// `context.watch` orqali holatni kuzatish yetarli.
class _NotificationBell extends StatelessWidget {
  const _NotificationBell();

  @override
  Widget build(BuildContext context) {
    context.watch<NotificationsCubit>();
    final unread = context.read<NotificationsCubit>().unreadCount;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;

    return GestureDetector(
      onTap: () => context.push('/notifications'),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(AppRadii.sm),
              border: Border.all(color: line),
            ),
            child: Icon(AppIcons.notification, size: 20, color: ink),
          ),
          if (unread > 0)
            const Positioned(top: -2, right: -2, child: AppBadge(dot: true)),
        ],
      ),
    );
  }
}

class _TotalDueCard extends StatelessWidget {
  const _TotalDueCard({required this.totalDue, required this.isEmpty});

  final double totalDue;
  final bool isEmpty;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final hasDebt = !isEmpty && totalDue > 0;

    final card = AppCard(
      onTap: () => context.go('/kommunalka'),
      gradient: AppColors.cardGradient,
      child: hasDebt
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        l10n.totalDueTitle,
                        style: AppTextStyles.bodyStrong.copyWith(
                          color: Colors.white70,
                        ),
                      ),
                    ),
                    const Icon(
                      AppIcons.arrowRight,
                      color: Colors.white70,
                      size: 18,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  formatSom(totalDue),
                  style: AppTextStyles.h1.copyWith(color: Colors.white),
                ),
                const SizedBox(height: 6),
                Text(
                  l10n.totalDueCaption,
                  style: AppTextStyles.caption.copyWith(color: Colors.white70),
                ),
              ],
            )
          : Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                  ),
                  child: const Icon(AppIcons.tick, color: Colors.white),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.homeDueEmptyTitle,
                        style: AppTextStyles.h3.copyWith(color: Colors.white),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        l10n.homeDueEmptyMessage,
                        style: AppTextStyles.caption.copyWith(
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  AppIcons.arrowRight,
                  color: Colors.white70,
                  size: 18,
                ),
              ],
            ),
    );

    return card
        .animate(delay: 120.ms)
        .fadeIn(duration: 300.ms)
        .slideY(begin: 0.1, end: 0);
  }
}

class _QuickActionsGrid extends StatelessWidget {
  const _QuickActionsGrid();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final actions = [
      _QuickAction(
        icon: AppIcons.wallet,
        label: l10n.quickActionKommunalka,
        color: AppColors.primary,
        onTap: () => context.go('/kommunalka'),
      ),
      _QuickAction(
        icon: AppIcons.documentUpload,
        label: l10n.quickActionNewApplication,
        color: AppColors.accent,
        onTap: () => context.go('/applications'),
      ),
      _QuickAction(
        icon: AppIcons.info,
        label: l10n.quickActionComplaint,
        color: AppColors.warning,
        onTap: () => context.go('/applications'),
      ),
      _QuickAction(
        icon: AppIcons.receipt,
        label: l10n.quickActionPaymentHistory,
        color: AppColors.accentDark,
        onTap: () => context.push('/payments-history'),
      ),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      // 1.6 edi — ikki qatorli (2-line) yorliq (masalan uzun ruscha matn)
      // uchun katak balandligi yetarli emas edi va kartani "toshib"
      // (overflow) ketkazardi. 1.25 icon+2 qatorli matn+karta bo'shlig'i
      // uchun yetarli balandlik beradi.
      childAspectRatio: 1.25,
      children: actions,
    ).animate(delay: 220.ms).fadeIn(duration: 300.ms);
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Icon(icon, color: color, size: 19),
          ),
          const SizedBox(height: 10),
          Text(
            label,
            style: AppTextStyles.bodyStrong,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

/// Yuklanish holati — shimmer bilan silliq "skeleton", hech qachon oq
/// ekran emas.
class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton({super.key});

  static Widget _box({
    required Color color,
    double height = 16,
    double? width,
    double radius = 10,
  }) {
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final glint = isDark ? AppColors.darkInkMuted : AppColors.surface;

    return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _box(height: 56, width: 56, radius: 28, color: line),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _box(height: 14, width: 100, color: line),
                        const SizedBox(height: 8),
                        _box(height: 18, width: 160, color: line),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 26),
              _box(height: 130, radius: 20, color: line),
              const SizedBox(height: 24),
              _box(height: 18, width: 140, color: line),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(child: _box(height: 92, radius: 18, color: line)),
                  const SizedBox(width: 12),
                  Expanded(child: _box(height: 92, radius: 18, color: line)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _box(height: 92, radius: 18, color: line)),
                  const SizedBox(width: 12),
                  Expanded(child: _box(height: 92, radius: 18, color: line)),
                ],
              ),
            ],
          ),
        )
        .animate(onPlay: (c) => c.repeat())
        .shimmer(duration: 1200.ms, color: glint);
  }
}

/// Xatolik holati — xabar + "Qayta urinish" tugmasi.
class _HomeErrorView extends StatelessWidget {
  const _HomeErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: l10n.dataLoadErrorTitle,
        message: message,
        action: AppButton(label: l10n.retry, expand: false, onPressed: onRetry),
      ),
    );
  }
}
