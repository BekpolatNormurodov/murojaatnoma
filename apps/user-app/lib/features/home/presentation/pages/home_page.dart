import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/core/format/phone_format.dart';
import 'package:user_app/core/widgets/app_shimmer.dart';
import 'package:user_app/core/widgets/error_view.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/face/data/services/face_photo_store.dart';
import 'package:user_app/features/home/presentation/bloc/home_cubit.dart';
import 'package:user_app/features/news/presentation/widgets/news_section.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/injection.dart';
import 'package:user_app/core/widgets/test_mode_banner.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

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
            HomeError(:final message) => Padding(
              padding: const EdgeInsets.all(24),
              child: ErrorView(
                message: message,
                onRetry: () => context.read<HomeCubit>().load(),
              ),
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
          onRefresh: () {
            // E'lonlar bo'limi o'z holatini o'zi yuklaydi — qayta quriladi.
            _newsRevision.value++;
            return context.read<HomeCubit>().load();
          },
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
              // To'lov shlyuzi ulanmagan: summa namoyish uchun.
              if (AppConfig.useMock) ...[
                const TestModeBanner(),
                const SizedBox(height: 8),
              ],
              _TotalDueCard(totalDue: totalDue, isEmpty: isEmpty),
              const SizedBox(height: 26),
              Text(
                l10n.quickActionsTitle,
                style: AppTextStyles.h3,
              ).animate(delay: 160.ms).fadeIn(duration: 300.ms),
              const SizedBox(height: 14),
              const _QuickActionsGrid(),
              const SizedBox(height: 26),
              ValueListenableBuilder<int>(
                valueListenable: _newsRevision,
                builder: (context, revision, _) =>
                    NewsSection(key: ValueKey(revision)),
              ),
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
    final inkMuted = Colors.white.withValues(alpha: 0.82);
    final name = widget.session?.name ?? '';
    final phone = widget.session?.phone ?? '';
    // Ism hali yo'q bo'lsa u telefonning o'zi — ikki marta chiqmasin.
    final subtitleParts = <String>[
      if (phone.isNotEmpty && phone != name) formatPhone(phone),
      formatDate(DateTime.now()),
    ];

    final row = Row(
      children: [
        FutureBuilder<String?>(
          future: _photoPath,
          builder: (context, snapshot) => _ringed(
            _FaceAvatar(
              name: name.isEmpty ? '?' : name,
              size: 52,
              photoPath: snapshot.data,
            ),
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
                formatPhone(name),
                style: AppTextStyles.h3.copyWith(
                  height: 1.25,
                  color: Colors.white,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              // Alohida qatorlar: katta shriftda sana kesilib ketmasin.
              for (final part in subtitleParts)
                Text(
                  part,
                  style: AppTextStyles.caption.copyWith(color: inkMuted),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        const _NotificationBell(),
      ],
    );
    return AppHero(
      padding: const EdgeInsets.all(16),
      child: row,
    ).animate().fadeIn(duration: 350.ms).slideY(begin: -0.08, end: 0);
  }

  /// Yashil fonda avatar oq halqa bilan ajralib turadi.
  static Widget _ringed(Widget child) => Container(
    padding: const EdgeInsets.all(2),
    decoration: const BoxDecoration(
      color: Colors.white,
      shape: BoxShape.circle,
    ),
    child: child,
  );
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
class _NotificationBell extends StatefulWidget {
  const _NotificationBell();

  @override
  State<_NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<_NotificationBell> {
  @override
  void initState() {
    super.initState();
    // Login'dan keyin birinchi marta shu yerda yuklanadi; keyin har daqiqada
    // fonda yangilanadi (fuqaroda socket yo'q).
    final cubit = context.read<NotificationsCubit>();
    unawaited(cubit.load(silent: cubit.state is! NotificationsLoading));
    cubit.startAutoRefresh();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<NotificationsCubit>();
    final unread = context.read<NotificationsCubit>().unreadCount;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;

    return Semantics(
      button: true,
      label: unread > 0
          ? 'Bildirishnomalar, $unread ta yangi'
          : 'Bildirishnomalar',
      child: GestureDetector(
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
              Positioned(
                top: -5,
                right: -5,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 18),
                  height: 18,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.danger,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: surface, width: 2),
                  ),
                  child: Text(
                    unread > 9 ? '9+' : '$unread',
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 10,
                      height: 1,
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// "Yangilash" tortilganda oshadi.
final ValueNotifier<int> _newsRevision = ValueNotifier(0);

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
        icon: AppIcons.walletBold,
        label: l10n.quickActionKommunalka,
        color: AppColors.primary,
        onTap: () => context.go('/kommunalka'),
      ),
      _QuickAction(
        icon: IconsaxPlusBold.document_upload,
        label: l10n.quickActionNewApplication,
        color: AppColors.accent,
        onTap: () =>
            context.push('/applications/submit', extra: RequestKind.ariza),
      ),
      _QuickAction(
        icon: IconsaxPlusBold.warning_2,
        label: l10n.quickActionComplaint,
        color: AppColors.warning,
        onTap: () =>
            context.push('/applications/submit', extra: RequestKind.shikoyat),
      ),
      _QuickAction(
        icon: IconsaxPlusBold.receipt_item,
        label: l10n.quickActionPaymentHistory,
        color: const Color(0xFF7C3AED),
        onTap: () => context.push('/payments-history'),
      ),
    ];

    // Katak balandligi matnga moslashadi (qat'iy nisbat katta shriftda
    // nomni kesib tashlardi); juftlik doim bir xil balandlikda.
    return Column(
      children: [
        for (var i = 0; i < actions.length; i += 2) ...[
          if (i > 0) const SizedBox(height: 12),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: actions[i]),
                const SizedBox(width: 12),
                Expanded(child: actions[i + 1]),
              ],
            ),
          ),
        ],
      ],
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
        // Yuqoridan: juft kartaning biri ikki qatorli bo'lsa ham ikonkalar
        // bir chiziqda turadi.
        children: [
          const SizedBox(width: double.infinity, height: 6),
          AppIconTile(icon: icon, tone: AppToneColors.of(color), size: 44),
          const SizedBox(height: 10),
          Text(
            label,
            style: AppTextStyles.bodyStrong,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 6),
        ],
      ),
    );
  }
}

/// Yuklanish holati — bosh sahifaning haqiqiy joylashuviga mos "shaped"
/// skeleton (avatar+ism, jami-qarz kartasi, tezkor xizmatlar katakchalari),
/// [ShimmerBox]lardan yig'ilgan — hech qachon oq/bo'sh ekran emas.
class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ShimmerBox(circle: true, height: 56),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ShimmerBox(width: 100, height: 14),
                    SizedBox(height: 8),
                    ShimmerBox(width: 160, height: 18),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 26),
          ShimmerBox(width: double.infinity, height: 130, radius: 20),
          SizedBox(height: 24),
          ShimmerBox(width: 140, height: 18),
          SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ShimmerBox(
                  width: double.infinity,
                  height: 92,
                  radius: 18,
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: ShimmerBox(
                  width: double.infinity,
                  height: 92,
                  radius: 18,
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ShimmerBox(
                  width: double.infinity,
                  height: 92,
                  radius: 18,
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: ShimmerBox(
                  width: double.infinity,
                  height: 92,
                  radius: 18,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
