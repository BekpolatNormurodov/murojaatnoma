import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/presentation/bloc/attendance_cubit.dart';
import 'package:worker_app/features/attendance/presentation/widgets/mock_dashboard.dart';
import 'package:worker_app/features/attendance/presentation/widgets/today_status_card.dart';
import 'package:worker_app/features/attendance/presentation/widgets/weekly_mini_chart.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/face/data/services/face_photo_store.dart';
import 'package:worker_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:worker_app/injection.dart';

/// Bosh sahifa (davomat) dashboard — 5-tab shellning "home" branchi.
///
/// Konstruktor parametrsiz: kerakli hamma narsani (`AttendanceCubit`,
/// `AuthCubit`) CONTEXT orqali o'qiydi — ikkalasi ham shu sahifadan
/// yuqorida ta'minlangan (`AttendanceCubit` — router'ning home
/// branchida, `AuthCubit` — ilova ildizida). `AttendanceCubit.load()`ning
/// BARCHA holatlari (`loading`/`loaded`/`empty`/`error`) shu yerda
/// ko'rsatiladi — hech qachon oq/bo'sh ekran YO'Q.
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _checkingGeofence = false;

  /// Haftalik tahlil (`WeeklyMiniChart` + `_QuickStats`) bo'limining
  /// o'rnini belgilaydi — "Bo'limlar" to'ridagi "Tahlil" kartasi bosilganda
  /// shu bo'limga silliq skroll qilish uchun (qarang: `_scrollToAnalytics`).
  final _analyticsSectionKey = GlobalKey();

  /// "Tahlil" kartasi bosilganda haftalik tahlil bo'limiga silliq skroll
  /// qiladi. `AttendanceEmpty` holatida bu bo'lim umuman qurilmagan bo'ladi
  /// (`currentContext == null`) — bunday holda jim hech narsa qilmaydi,
  /// hech qachon throw qilmaydi.
  void _scrollToAnalytics() {
    final sectionContext = _analyticsSectionKey.currentContext;
    if (sectionContext == null) return;
    Scrollable.ensureVisible(
      sectionContext,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
    );
  }

  /// "Yuz bilan tasdiqlash" CTA bosilganda: joriy joylashuv + geofence
  /// tekshiruvi (`AttendanceCubit.checkGeofence()` — hech qachon throw
  /// qilmaydi), so'ng natijaga qarab ichkarida `/face/checkin`ga yoki
  /// tashqarida/aniqlanmasa mos `AppAlert`.
  Future<void> _onCheckInPressed() async {
    if (_checkingGeofence) return;
    setState(() => _checkingGeofence = true);
    bool? inside;
    try {
      inside = await context.read<AttendanceCubit>().checkGeofence();
    } finally {
      if (mounted) setState(() => _checkingGeofence = false);
    }
    if (!mounted) return;

    final l10n = context.l10n;
    if (inside ?? false) {
      context.go('/face/checkin');
    } else if (inside == false) {
      AppAlert.error(context, l10n.outsideGeofence);
    } else {
      // Joylashuv xizmati o'chirilgan/ruxsat berilmagan/boshqa xato —
      // qarang: `AttendanceCubit._defaultLocate`. Foydalanuvchi hech
      // qachon uncaught xato yoki jim qolgan tugmani ko'rmaydi.
      AppAlert.error(context, l10n.locationCheckFailed);
    }
  }

  /// "Ishdan chiqish" (ketdi) CTA — check-in bilan bir xil geofence
  /// tekshiruvi, so'ng `/face/checkout` (FaceCubit check-out rejimi, face
  /// lane). Faqat bugun kelgan, lekin hali ketmagan xodimga ko'rsatiladi.
  Future<void> _onCheckOutPressed() async {
    if (_checkingGeofence) return;
    setState(() => _checkingGeofence = true);
    bool? inside;
    try {
      inside = await context.read<AttendanceCubit>().checkGeofence();
    } finally {
      if (mounted) setState(() => _checkingGeofence = false);
    }
    if (!mounted) return;

    final l10n = context.l10n;
    if (inside ?? false) {
      context.go('/face/checkout');
    } else if (inside == false) {
      AppAlert.error(context, l10n.outsideGeofence);
    } else {
      AppAlert.error(context, l10n.locationCheckFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      body: SafeArea(
        child: BlocBuilder<AttendanceCubit, AttendanceState>(
          builder: (context, state) => switch (state) {
            AttendanceLoading() => const _HomeSkeleton(
              key: Key('home_skeleton'),
            ),
            AttendanceError(:final message) => _HomeErrorView(
              message: message,
              onRetry: () => context.read<AttendanceCubit>().load(),
            ),
            AttendanceEmpty() => _buildContent(
              context,
              today: null,
              week: const [],
              isEmpty: true,
            ),
            AttendanceLoaded(:final today, :final week) => _buildContent(
              context,
              today: today,
              week: week,
              isEmpty: false,
            ),
          },
        ),
      ),
    );
  }

  Widget _buildContent(
    BuildContext context, {
    required AttendanceDay? today,
    required List<AttendanceDay> week,
    required bool isEmpty,
  }) {
    final l10n = context.l10n;
    final session = context.watch<AuthCubit>().state.session;

    return LayoutBuilder(
      builder: (context, constraints) {
        final horizontalPadding = constraints.maxWidth > 640
            ? (constraints.maxWidth - 560) / 2
            : 20.0;

        return RefreshIndicator(
          onRefresh: () => context.read<AttendanceCubit>().load(),
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
              TodayStatusCard(today: today),
              const SizedBox(height: 16),
              if (today?.checkIn == null)
                AppButton(
                      label: l10n.homeCheckinCta,
                      icon: AppIcons.camera,
                      loading: _checkingGeofence,
                      onPressed: _onCheckInPressed,
                    )
                    .animate(delay: 120.ms)
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: 0.15, end: 0)
              else if (today?.checkOut == null)
                // Ketdi (check-out) — bugun kelgan, hali ketmagan. Label
                // hozircha uz; keyinroq app_core l10n `homeCheckoutCta`ga.
                AppButton(
                      label: 'Ishdan chiqish',
                      icon: AppIcons.camera,
                      loading: _checkingGeofence,
                      onPressed: _onCheckOutPressed,
                    )
                    .animate(delay: 120.ms)
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: 0.15, end: 0)
              else
                const SizedBox.shrink(),
              const SizedBox(height: 24),
              const _QuickActions(),
              const SizedBox(height: 24),
              if (isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: EmptyState(
                    icon: AppIcons.calendar,
                    title: l10n.attendanceEmptyTitle,
                    message: l10n.attendanceEmptyMessage,
                  ),
                )
              else ...[
                KeyedSubtree(
                  key: _analyticsSectionKey,
                  child: WeeklyMiniChart(week: week),
                ),
                const SizedBox(height: 16),
                _QuickStats(week: week),
              ],
              // Faza 3 qo'shimchalari ATAYLAB shu yerda — mavjud
              // bo'limlardan (yuqorida) KEYIN, shuning uchun ularning
              // pozitsiyasi/tartibi (va ular ustidagi eski testlar)
              // o'zgarmaydi. Sahifa o'zi allaqachon skroll qilinadigan
              // (`ListView`), shuning uchun bu qo'shimcha tarkib pastda
              // bo'lishi normal — foydalanuvchi shunchaki pastga suradi.
              const SizedBox(height: 24),
              _TodayOverviewStrip(today: today),
              const SizedBox(height: 24),
              _DashboardSections(onAnalyticsTap: _scrollToAnalytics),
              const SizedBox(height: 24),
              const _RecentActivitySection(),
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
  // Skanerlangan yuz rasmini bir marta (sahifa ochilishida) yuklaydi —
  // profil sarlavhasi bilan bir xil manba (`FacePhotoStore`), shu bois
  // bosh sahifadagi avatar ham foydalanuvchining haqiqiy yuzini ko'rsatadi.
  // `FacePhotoStore` DI'da ro'yxatdan o'tmagan bo'lsa (masalan widget
  // testida) xotirjam `null`ga tushadi — avatar initsiallarni ko'rsatadi,
  // hech qachon uncaught bo'lmaydi.
  late final Future<String?> _photoPath = getIt.isRegistered<FacePhotoStore>()
      ? getIt<FacePhotoStore>().currentPath()
      : Future<String?>.value();

  static String _formattedDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}.'
      '${d.month.toString().padLeft(2, '0')}.'
      '${d.year}';

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final name = widget.session?.name ?? '';
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

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
                style: AppTextStyles.body.copyWith(color: mutedColor),
              ),
              Text(
                name,
                style: AppTextStyles.h2,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                _formattedDate(DateTime.now()),
                style: AppTextStyles.caption.copyWith(color: mutedColor),
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
/// bo'lsa doiraviy foto, aks holda (yoki fayl yo'q/buzuq bo'lsa) initsial
/// harflarga qaytadi. `File.existsSync()` himoyasi + `AppAvatar`ning o'z
/// `errorBuilder`i tufayli hech qachon qulamaydi (profil sarlavhasidagi
/// `_FaceAvatar` bilan bir xil naqsh).
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

/// "Tezkor" harakatlar qatori — Majlislar/Takliflar/Ballarim sahifalariga
/// (5-tabli pastki navigatsiyada joy yo'q, shuning uchun bosh sahifadan
/// PUSH qilinadigan) tezkor kirish. Har bir karta o'zining to'liq ekranli
/// sahifasini ochadi (`context.push`) — manzil satrlari orqali, shuning
/// uchun bu fayl meetings/points/suggestions modullariga to'g'ridan-to'g'ri
/// bog'liq EMAS (`RequestsPage`/`ChatPage` bilan bir xil erkinlik darajasi).
class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.homeQuickActionsTitle,
          style: AppTextStyles.label.copyWith(color: mutedColor),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _QuickActionCard(
                icon: AppIcons.video,
                label: l10n.meetingsPageTitle,
                onTap: () => context.push('/meetings'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _QuickActionCard(
                icon: AppIcons.lampOn,
                label: l10n.suggestionsPageTitle,
                onTap: () => context.push('/suggestions'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _QuickActionCard(
                icon: AppIcons.coin,
                label: l10n.pointsPageTitle,
                onTap: () => context.push('/points'),
              ),
            ),
          ],
        ),
      ],
    ).animate(delay: 160.ms).fadeIn(duration: 300.ms);
  }
}

class _QuickActionCard extends StatelessWidget {
  const _QuickActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
    this.badgeText,
    this.reserveBadgeSlot = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  /// Ixtiyoriy kichik belgi (masalan `"3 yangi"`) — berilsa, yorliq
  /// ostida `AppBadge` sifatida ko'rsatiladi. `null` bo'lsa (standart —
  /// eski "Tezkor" qatoridagi kartalar uchun) hech narsa qo'shilmaydi,
  /// ko'rinish avvalgidek qoladi.
  final String? badgeText;

  /// `true` bo'lsa (masalan "Bo'limlar" to'ridagi kartalar), belgi uchun
  /// joy DOIM ajratiladi — badge bo'lmagan kartalar ham bir xil balandlikda
  /// bo'lib, to'r ritmi tekis ko'rinadi. `false` (standart) bo'lganda eski
  /// xatti-harakat: badge faqat mavjud bo'lsa qo'shiladi.
  final bool reserveBadgeSlot;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Icon(icon, size: 22, color: AppColors.primary),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: ink,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (reserveBadgeSlot) ...[
            const SizedBox(height: 6),
            // Badge'siz kartalar ham bir xil balandlikda bo'lishi uchun
            // belgi uchun joy DOIM band qilinadi — badge bo'lmasa
            // ko'rinmas, lekin o'lchamni saqlaydi (to'r ritmi tekis).
            Visibility(
              visible: badgeText != null,
              maintainSize: true,
              maintainAnimation: true,
              maintainState: true,
              child: AppBadge(label: badgeText ?? ''),
            ),
          ] else if (badgeText case final text?) ...[
            const SizedBox(height: 6),
            AppBadge(label: text),
          ],
        ],
      ),
    );
  }
}

class _QuickStats extends StatelessWidget {
  const _QuickStats({required this.week});

  final List<AttendanceDay> week;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final totalHours = week.fold<double>(0, (sum, d) => sum + d.hours);
    final presentDays = week
        .where((d) => d.status == AttendanceStatus.present)
        .length;
    final lateDays = week
        .where((d) => d.status == AttendanceStatus.late)
        .length;

    return Row(
      children: [
        Expanded(
          child: _StatCard(
            icon: AppIcons.timer,
            value: totalHours.toStringAsFixed(1),
            label: l10n.statHoursThisWeek,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            icon: AppIcons.tick,
            value: '$presentDays',
            label: l10n.statDaysPresent,
            color: AppColors.success,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            icon: AppIcons.clock,
            value: '$lateDays',
            label: l10n.statLateDays,
            color: AppColors.warning,
          ),
        ),
      ],
    ).animate(delay: 200.ms).fadeIn(duration: 300.ms);
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(value, style: AppTextStyles.h3),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(color: mutedColor),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

/// Bosh sahifadagi "Bugungi ko'rinish" — bugungi murojaat/chat/majlis
/// (MOCK, qarang: `mock_dashboard.dart`) sonlari va (bugungi yozuv mavjud
/// bo'lsa) joriy geofence holati. Gorizontal skroll ichida (`ListView`,
/// `scrollDirection: horizontal`) — shu tufayli ekran torligida yoki katta
/// tizim shrift o'lchamida ham HECH QACHON gorizontal overflow bo'lmaydi
/// (torlik holida chip'lar shunchaki skroll qilinadi, "toshib ketmaydi").
class _TodayOverviewStrip extends StatelessWidget {
  const _TodayOverviewStrip({required this.today});

  final AttendanceDay? today;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    final chips = <Widget>[
      _OverviewChip(
        icon: AppIcons.requests,
        value: '${MockDashboardData.newRequestsCount}',
        label: l10n.homeStripNewRequests,
        tint: AppColors.primary,
      ),
      _OverviewChip(
        icon: AppIcons.chat,
        value: '${MockDashboardData.unreadChatCount}',
        label: l10n.homeStripUnreadChat,
        tint: AppColors.info,
      ),
      _OverviewChip(
        icon: AppIcons.video,
        value: '${MockDashboardData.meetingsTodayCount}',
        label: l10n.homeStripMeetingsToday,
        tint: AppColors.accent,
      ),
      // `today` mavjud bo'lgandagina (haqiqiy ma'lumot, MOCK EMAS) —
      // `AttendanceDay.insideGeofence`da allaqachon bor, shuning uchun
      // "arzon" (qo'shimcha so'rov shart emas).
      if (today case final day?)
        _OverviewChip(
          icon: day.insideGeofence ? AppIcons.locationBold : AppIcons.location,
          label: day.insideGeofence
              ? l10n.homeGeofenceInside
              : l10n.homeGeofenceOutside,
          tint: day.insideGeofence ? AppColors.success : AppColors.warning,
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.homeTodayOverviewTitle,
          style: AppTextStyles.label.copyWith(color: mutedColor),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 104,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: chips.length,
            separatorBuilder: (context, index) => const SizedBox(width: 10),
            itemBuilder: (context, index) => chips[index],
          ),
        ),
      ],
    ).animate(delay: 230.ms).fadeIn(duration: 300.ms);
  }
}

/// Bitta ixcham "statistika" kartasi — [value] berilsa raqam+yorliq
/// (masalan "3" / "Yangi murojaat"), berilmasa (geofence holati kabi
/// bool-based holatlar uchun) faqat qalin, rangli holat matni.
class _OverviewChip extends StatelessWidget {
  const _OverviewChip({
    required this.icon,
    required this.label,
    required this.tint,
    this.value,
  });

  final IconData icon;
  final String? value;
  final String label;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return SizedBox(
      // ~2.3 karta ko'rinadigan kenglik — gorizontal skroll borligini
      // bildiradi va yorliqlar (2 qatorgacha) so'z o'rtasidan kesilmaydi.
      width: 140,
      child: AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Icon(icon, size: 18, color: tint),
            if (value case final numericValue?)
              Text(
                numericValue,
                style: AppTextStyles.h3,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              )
            else
              Text(
                label,
                style: AppTextStyles.bodyStrong.copyWith(color: tint),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            if (value != null)
              Text(
                label,
                style: AppTextStyles.caption.copyWith(color: mutedColor),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
      ),
    );
  }
}

/// Bosh sahifadagi "Bo'limlar" — asosiy 5 tabli qobiqning boshqa
/// filiallariga (`/requests`, `/chat`, `/map` — `context.go`, sababi
/// `main_shell.dart`dagi kabi shell filiali almashtiriladi) va "Majlis"ga
/// (`/meetings` — `context.push`, eski `_QuickActions`dagi bilan bir xil
/// naqsh) tezkor o'tish to'ri. "Tahlil" kartasi esa hech qanday marshrutga
/// EMAS, balki shu sahifaning o'zidagi haftalik tahlil bo'limiga silliq
/// skroll qiladi (`onAnalyticsTap`, qarang: `_HomePageState`). Ikkita
/// `IntrinsicHeight` qator — badge'li (masalan "3 yangi") va badge'siz
/// (masalan "Xarita") kartalar bir xil qatorda bo'lganda balandligi bir xil
/// bo'lishi uchun (aks holda badge'siz kartalar pastroq/notekis ko'rinardi).
class _DashboardSections extends StatelessWidget {
  const _DashboardSections({required this.onAnalyticsTap});

  final VoidCallback onAnalyticsTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.homeSectionsTitle,
          style: AppTextStyles.label.copyWith(color: mutedColor),
        ),
        const SizedBox(height: 10),
        IntrinsicHeight(
          child: Row(
            children: [
              Expanded(
                child: _QuickActionCard(
                  icon: AppIcons.requests,
                  label: l10n.requests,
                  reserveBadgeSlot: true,
                  badgeText: l10n.homeNewRequestsBadge(
                    MockDashboardData.newRequestsCount,
                  ),
                  onTap: () => context.go('/requests'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _QuickActionCard(
                  icon: AppIcons.chat,
                  label: l10n.chat,
                  reserveBadgeSlot: true,
                  badgeText: l10n.homeUnreadChatBadge(
                    MockDashboardData.unreadChatCount,
                  ),
                  onTap: () => context.go('/chat'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _QuickActionCard(
                  icon: AppIcons.map,
                  label: l10n.map,
                  reserveBadgeSlot: true,
                  onTap: () => context.go('/map'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        IntrinsicHeight(
          child: Row(
            children: [
              Expanded(
                child: _QuickActionCard(
                  icon: AppIcons.trendUp,
                  label: l10n.homeAnalyticsTile,
                  reserveBadgeSlot: true,
                  onTap: onAnalyticsTap,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _QuickActionCard(
                  icon: AppIcons.video,
                  label: l10n.meetingsPageTitle,
                  reserveBadgeSlot: true,
                  badgeText: l10n.homeMeetingsTodayBadge(
                    MockDashboardData.meetingsTodayCount,
                  ),
                  onTap: () => context.push('/meetings'),
                ),
              ),
              const SizedBox(width: 12),
              // Uchinchi ustun — haftalik ish jadvali (Faza: "Ish jadvali"
              // to'liq ekranli sahifasiga PUSH, qarang: `WorkSchedulePage`).
              // Ilgari bu yerda faqat tekislash uchun ko'rinmas bo'sh joy
              // bor edi — endi haqiqiy tezkor kirish kartasi.
              Expanded(
                child: _QuickActionCard(
                  icon: AppIcons.calendar,
                  label: l10n.workScheduleTileLabel,
                  reserveBadgeSlot: true,
                  onTap: () => context.push('/schedule'),
                ),
              ),
            ],
          ),
        ),
      ],
    ).animate(delay: 260.ms).fadeIn(duration: 300.ms);
  }
}

/// Bosh sahifadagi "So'nggi faoliyat" — 3 ta MOCK yozuv (qarang:
/// `MockDashboardData.recentActivity`), bosh sahifaga jonlanish beradi.
/// Sof taqdimot qatlami — hech qanday feature moduliga bog'liq emas.
class _RecentActivitySection extends StatelessWidget {
  const _RecentActivitySection();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    const items = MockDashboardData.recentActivity;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.homeRecentActivityTitle,
          style: AppTextStyles.label.copyWith(color: mutedColor),
        ),
        const SizedBox(height: 10),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) Divider(height: 1, color: line, indent: 60),
                _ActivityRow(item: items[i]),
              ],
            ],
          ),
        ),
      ],
    ).animate(delay: 290.ms).fadeIn(duration: 300.ms);
  }
}

/// [_RecentActivitySection] ichidagi bitta qator — icon (turga qarab
/// rangli), sarlavha (1 qator, ellipsis) va o'ngda vaqt.
class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.item});

  final MockActivityItem item;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;

    final (icon, title, color) = switch (item.kind) {
      MockActivityKind.request => (
        AppIcons.requests,
        l10n.homeActivityNewRequest,
        AppColors.primary,
      ),
      MockActivityKind.message => (
        AppIcons.chat,
        l10n.homeActivityNewMessage,
        AppColors.info,
      ),
      MockActivityKind.meeting => (
        AppIcons.video,
        l10n.homeActivityMeetingStarting,
        AppColors.accent,
      ),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: AppTextStyles.body.copyWith(color: ink),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            item.time,
            style: AppTextStyles.caption.copyWith(color: mutedColor),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

/// Yuklanish holati — shimmer bilan silliq "skeleton", HECH QACHON oq
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
    final lineColor = isDark ? AppColors.darkLine : AppColors.line;
    final shimmerColor = isDark ? AppColors.darkSurface : AppColors.surface;

    return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _box(color: lineColor, height: 56, width: 56, radius: 28),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _box(color: lineColor, height: 14, width: 100),
                        const SizedBox(height: 8),
                        _box(color: lineColor, height: 18, width: 160),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 26),
              _box(color: lineColor, height: 84, radius: 20),
              const SizedBox(height: 16),
              _box(color: lineColor, height: 54, radius: 16),
              const SizedBox(height: 24),
              Row(
                children: [
                  for (var i = 0; i < 3; i++) ...[
                    if (i > 0) const SizedBox(width: 12),
                    Expanded(
                      child: _box(color: lineColor, height: 84, radius: 16),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 24),
              _box(color: lineColor, height: 180, radius: 20),
            ],
          ),
        )
        .animate(onPlay: (c) => c.repeat())
        .shimmer(duration: 1200.ms, color: shimmerColor);
  }
}

/// Xatolik holati — xabar + "Qayta urinish" tugmasi (hech qachon
/// tupikka olib kelmaydi).
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
        title: l10n.attendanceErrorTitle,
        message: message,
        action: AppButton(label: l10n.retry, expand: false, onPressed: onRetry),
      ),
    );
  }
}
