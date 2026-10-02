import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/face/data/services/face_photo_store.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';
import 'package:worker_app/core/session/session_service.dart';
import 'package:worker_app/features/attendance/data/attendance_history.dart';
import 'package:worker_app/injection.dart';

/// "Profil" tabi — sozlamalar ekrani: profil sarlavhasi (avatar/ism/lavozim/
/// hudud/ID), til va mavzu almashtirgichlari, ish ma'lumotlari, ilova haqida
/// va chiqish.
///
/// Konstruktor parametrsiz: kerakli hamma narsani (`AuthCubit`,
/// `LocaleCubit`, `ThemeCubit`) CONTEXT orqali o'qiydi — barchasi shu
/// sahifadan yuqorida, ilova ildizida (`WorkerApp`) allaqachon ta'minlangan
/// (`HomePage`/`RequestsPage` bilan bir xil naqsh).
class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  /// Ma'lumot yo'q qiymati uchun neytral belgi — hozircha faqat "Bo'lim"
  /// qatori uchun (backend `district` bo'sh bo'lsa). "Ish soatlari" qatori
  /// endi haqiqiy jadval soatlarini (`l10n.workScheduleHours`) ko'rsatadi.
  static const _emptyPlaceholder = '—';

  /// Ilova versiyasi — `pubspec.yaml`dagi `version:` bilan QO'LDA
  /// sinxronlanadi (`package_info_plus` kabi runtime-o'quvchi paket hali
  /// bog'liqlik sifatida qo'shilmagan, shuning uchun bu yerda o'z-o'zidan
  /// o'qilmaydi). Fabrikatsiya qilingan '4.8' reyting kabi ХАТО qiymat
  /// EMAS — bu haqiqiy release versiyasi, faqat statik konstanta sifatida.
  static const _appVersion = 'v1.0.8';

  /// [session]dan "Bo'lim" qatori uchun eng yaqin haqiqiy ma'lumot —
  /// backendda alohida "bo'lim nomi" maydoni yo'q, shuning uchun tuman
  /// ko'rsatiladi. Loyiha hozircha FAQAT Mirzo Ulug'bek uchun ishlagani
  /// sababli region (viloyat/shahar) ko'rsatilmaydi.
  static String _departmentValue(AuthSession? session) {
    final district = session?.district ?? '';
    return district.isEmpty ? _emptyPlaceholder : district;
  }

  Future<void> _logout(BuildContext context) async {
    final l10n = context.l10n;
    // Tasodifiy chiqib ketishning oldini olish uchun tasdiqlash modali —
    // "Ha, chiqish" tanlanmasa hech narsa qilinmaydi.
    final confirmed = await AppDialog.confirm(
      context: context,
      icon: AppIcons.logout,
      title: l10n.logoutConfirmTitle,
      message: l10n.logoutConfirmMessage,
      confirmLabel: l10n.logoutConfirmCta,
      cancelLabel: l10n.cancel,
      danger: true,
    );
    if (!confirmed || !context.mounted) return;

    // Saqlangan JWT/sessiyani ham tozalash kerak — aks holda
    // `AuthInterceptor` keyingi so'rovlarga eskirgan tokenni qo'shib
    // yuboraveradi. `logout()` xato tashlasa ham (masalan saqlash
    // xizmati muvaffaqiyatsiz bo'lsa) chiqish HECH QACHON ilovani
    // qulatmasligi kerak — shuning uchun bu yerda ushlanadi va
    // navigatsiya baribir davom etadi.
    // To'liq tozalash: server (refresh revoke + FCM), lokatsiya navbati, yuz
    // shabloni, oflayn kesh. Har qadam himoyalangan — hech qachon xato
    // bermaydi va internet yo'q bo'lsa ham ~6 s ichida tugaydi.
    await SessionService().logout();
    if (!context.mounted) return;
    final auth = context.read<AuthCubit>();
    final router = GoRouter.of(context);
    final rootNav = Navigator.of(context, rootNavigator: true);
    // QORA EKRAN tuzatildi (web-admin "hard redirect" bilan bir xil sabab):
    // logout'da YOPILMAY qolgan popup/dialog/sheet route'ining barrier'i
    // (showDialog 0.45-qora barrier, yoki qo'ng'iroq overlay'i) ekran ustida
    // osilib qolardi — soft `go('/login')` uni olib tashlamaydi. Shuning uchun
    // avval BARCHA popup route'larini tozalaymiz (GoRouter sahifalari
    // `PopupRoute` EMAS — saqlanadi), keyin sessiyani reset qilib `/login`ga
    // aniq o'tamiz. Endi hech qanday overlay osilib qolmaydi.
    auth.reset();
    rootNav.popUntil((route) => route is! PopupRoute);
    router.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final session = context.watch<AuthCubit>().state.session;
    final locale = context.watch<LocaleCubit>().state;
    final themeMode = context.watch<ThemeCubit>().state;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final horizontalPadding = constraints.maxWidth > 640
                ? (constraints.maxWidth - 560) / 2
                : 20.0;

            return ListView(
              padding: EdgeInsets.fromLTRB(
                horizontalPadding,
                20,
                horizontalPadding,
                32,
              ),
              children: [
                Text(l10n.profile, style: AppTextStyles.h1),
                const SizedBox(height: 18),
                _ProfileHeaderCard(session: session)
                    .animate()
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: -0.06, end: 0),
                const SizedBox(height: 12),
                const _MonthStatsRow()
                    .animate(delay: 40.ms)
                    .fadeIn(duration: 300.ms),
                const SizedBox(height: 24),
                // Til + Mavzu — bitta ixcham kartada (avval 2 ta katta bo'sh
                // karta edi, sahifa siyrak ko'rinardi).
                AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _SectionTitle(l10n.profileLanguageTitle),
                          const SizedBox(height: 8),
                          AppSegmented<Locale>(
                            value: locale,
                            segments: [
                              AppSegment(
                                value: const Locale('uz'),
                                label: l10n.languageNameUzbek,
                              ),
                              AppSegment(
                                value: const Locale('ru'),
                                label: l10n.languageNameRussian,
                              ),
                            ],
                            onChanged: (value) => unawaited(
                              context.read<LocaleCubit>().setLocale(value),
                            ),
                          ),
                          const SizedBox(height: 18),
                          _SectionTitle(l10n.profileThemeTitle),
                          const SizedBox(height: 8),
                          AppSegmented<ThemeMode>(
                            value: themeMode == ThemeMode.dark
                                ? ThemeMode.dark
                                : ThemeMode.light,
                            segments: [
                              AppSegment(
                                value: ThemeMode.light,
                                label: l10n.profileThemeOptionLight,
                                icon: AppIcons.sun,
                              ),
                              AppSegment(
                                value: ThemeMode.dark,
                                label: l10n.profileThemeOptionDark,
                                icon: AppIcons.moon,
                              ),
                            ],
                            onChanged: (value) => unawaited(
                              context.read<ThemeCubit>().setMode(value),
                            ),
                          ),
                        ],
                      ),
                    )
                    .animate(delay: 60.ms)
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: 0.06, end: 0),
                const SizedBox(height: 24),
                _SectionTitle(_t(context, 'Mening ishim', 'Моя работа')),
                const SizedBox(height: 8),
                _MenuCard(
                      items: [
                        _MenuItem(
                          _t(context, 'Mening davomatim', 'Моя посещаемость'),
                          AppIcons.calendar,
                          () => context.push('/my-attendance'),
                          hint: _t(
                            context,
                            'Kalendar va skan rasmlari',
                            'Календарь и фото',
                          ),
                          accent: true,
                        ),
                        _MenuItem(
                          l10n.profileWorkingHoursLabel,
                          AppIcons.timer,
                          () => context.push('/schedule'),
                          trailing: l10n.workScheduleHours,
                        ),
                        _MenuItem(
                          'Oyliklarim',
                          AppIcons.wallet,
                          () => context.push('/salaries'),
                        ),
                        _MenuItem(
                          _t(context, 'Ballarim', 'Мои баллы'),
                          AppIcons.medal,
                          () => context.push('/points'),
                        ),
                      ],
                    )
                    .animate(delay: 100.ms)
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: 0.06, end: 0),
                const SizedBox(height: 20),
                _SectionTitle(_t(context, "So'rovlar", 'Заявки')),
                const SizedBox(height: 8),
                _MenuCard(
                      items: [
                        _MenuItem(
                          l10n.leaveRequestTileLabel,
                          AppIcons.calendar,
                          () => context.push('/leave-request'),
                        ),
                        _MenuItem(
                          l10n.premyaRequestTileLabel,
                          AppIcons.gift,
                          () => context.push('/premya-request'),
                        ),
                        _MenuItem(
                          _t(context, 'Takliflar', 'Предложения'),
                          AppIcons.lampOn,
                          () => context.push('/suggestions'),
                        ),
                      ],
                    )
                    .animate(delay: 140.ms)
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: 0.06, end: 0),
                const SizedBox(height: 20),
                _SectionTitle(_t(context, "Ma'lumotlar", 'Информация')),
                const SizedBox(height: 8),
                _MenuCard(
                      items: [
                        _MenuItem(
                          _t(context, "Shaxsiy ma'lumotlar", 'Личные данные'),
                          AppIcons.profile,
                          () => context.push('/profile/info'),
                          trailing:
                              _departmentValue(session) == _emptyPlaceholder
                              ? null
                              : _departmentValue(session),
                        ),
                        _MenuItem(
                          l10n.profileNewsTileLabel,
                          AppIcons.notification,
                          () => context.push('/news'),
                        ),
                        _MenuItem(
                          l10n.profileDocumentsTileLabel,
                          IconsaxPlusLinear.document_text,
                          () => context.push('/documents'),
                        ),
                      ],
                    )
                    .animate(delay: 160.ms)
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: 0.06, end: 0),
                const SizedBox(height: 24),
                _SectionTitle(l10n.profileAboutTitle),
                const SizedBox(height: 8),
                AppCard(
                      padding: const EdgeInsets.symmetric(
                        vertical: 4,
                        horizontal: 8,
                      ),
                      child: AppListTile(
                        title: l10n.profileAppVersionLabel,
                        leadingIcon: AppIcons.info,
                        trailing: const _TrailingValue(_appVersion),
                      ),
                    )
                    .animate(delay: 180.ms)
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: 0.06, end: 0),
                const SizedBox(height: 28),
                AppButton(
                  label: l10n.logout,
                  icon: AppIcons.logout,
                  variant: AppButtonVariant.danger,
                  onPressed: () => unawaited(_logout(context)),
                ).animate(delay: 220.ms).fadeIn(duration: 300.ms),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Bo'lim sarlavhasi — ro'yxat kartalari ustida kichik, xira label
/// (`RequestDetailPage._SectionTitle` bilan bir xil naqsh).
class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      label,
      style: AppTextStyles.label.copyWith(
        color: isDark ? AppColors.darkInkSoft : AppColors.inkSoft,
      ),
    );
  }
}

/// `AppListTile.trailing`da ko'rsatiladigan qiymat matni — uzun mock/real
/// qiymatlar (masalan bo'lim nomi) qatorni yorib chiqmasligi uchun kengligi
/// cheklangan va bitta qatorga qisqartiriladi (ellipsis).
class _TrailingValue extends StatelessWidget {
  const _TrailingValue(this.value);

  final String value;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 130),
      child: Text(
        value,
        style: AppTextStyles.bodyStrong,
        textAlign: TextAlign.right,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

/// Profil sarlavha kartasi — avatar (initsiallar) + ism + lavozim + hudud +
/// ishchi ID. [session] `null` bo'lishi mumkin (nazariy jihatdan — bu sahifa
/// har doim auth-gated shell ichida ko'rsatiladi, lekin himoya sifatida
/// `_GreetingHeader` (`HomePage`) bilan bir xil naqsh: bo'sh qiymatlarga
/// tushadi, hech qachon null-check xatosi bermaydi).
class _ProfileHeaderCard extends StatefulWidget {
  const _ProfileHeaderCard({required this.session});

  final AuthSession? session;

  @override
  State<_ProfileHeaderCard> createState() => _ProfileHeaderCardState();
}

class _ProfileHeaderCardState extends State<_ProfileHeaderCard> {
  // Bir marta (sahifa ochilishida) yuklanadi — tema/til almashganda
  // qayta so'ralmasligi uchun `Future` keshlanadi.
  late final Future<_EnrollInfo> _enrollInfo = _loadEnrollInfo();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    // Lavozim (rol) — ismdan keyingi ASOSIY subtitr, shuning uchun eng xira
    // "muted" emas, biroz to'yingroq "soft" rang bilan (qo'shimcha yarim
    // qalinlik pastda) ajratiladi. Ro'yxatdan o'tgan sana esa eng yengil
    // (uchinchi darajali) bo'lib qoladi.
    final roleColor = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final name = widget.session?.name ?? '';
    final position = widget.session?.position ?? '';

    return AppCard(
      shadow: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FutureBuilder<_EnrollInfo>(
            future: _enrollInfo,
            builder: (context, snapshot) => _FaceAvatar(
              name: name.isEmpty ? '?' : name,
              size: 68,
              photoPath: snapshot.data?.photoPath,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: AppTextStyles.h2,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  position,
                  style: AppTextStyles.body.copyWith(
                    color: roleColor,
                    fontWeight: FontWeight.w600,
                  ),
                  // Lavozimlar uzun ("Kommunal xizmat mutaxassisi") — 2 qator.
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                FutureBuilder<_EnrollInfo>(
                  future: _enrollInfo,
                  builder: (context, snapshot) {
                    final enrolledAt = snapshot.data?.enrolledAt;
                    if (enrolledAt == null) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        l10n.profileEnrolledOn(formatDate(enrolledAt)),
                        style: AppTextStyles.caption.copyWith(
                          color: mutedColor,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  },
                ),
                // Xodim ID (`workerId`) ATAYLAB ko'rsatilmaydi — bu xom UUID
                // (masalan "2e17c07b-0b4f-465…"), qisqartirilgan holda
                // foydalanuvchiga hech qanday ma'no bermaydi va foydali
                // "xodim raqami" mavjud emas. Region ham ko'rsatilmaydi
                // (loyiha hozircha faqat Mirzo Ulug'bek uchun) — tuman
                // "Bo'lim" qatorida (`_departmentValue`) chiqadi.
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Profil sarlavha avatari: saqlangan (skanerlangan) yuz rasmi mavjud
/// bo'lsa doiraviy foto, aks holda (yoki fayl yo'q/buzuq bo'lsa) mavjud
/// `AppAvatar` initsiallariga qaytadi — hech qachon qulamaydi
/// (`File.existsSync()` himoyasi + `AppAvatar`ning o'z `errorBuilder`i).
/// Rasm-chizish mantig'ining o'zi endi `AppAvatar.image` ichida (bir marta,
/// ikkala ilova uchun ham) — bu widget faqat fayl mavjudligini tekshirib,
/// `FileImage`ni uzatadi.
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

/// Profil sarlavhasi uchun ro'yxatdan o'tkazish ma'lumoti — saqlangan
/// yuz shablonining `enrolledAt` sanasi va (mavjud bo'lsa) yuz-rasm yo'li.
class _EnrollInfo {
  const _EnrollInfo({this.enrolledAt, this.photoPath});

  final DateTime? enrolledAt;
  final String? photoPath;
}

/// Saqlangan yuz shabloni (`enrolledAt`) va yuz-rasm yo'lini o'qiydi.
/// Har qanday xato (jumladan `getIt` ro'yxatdan o'tmagan holat) jimgina
/// bo'sh ma'lumotga aylanadi — profil initsial-avatarga qaytadi.
Future<_EnrollInfo> _loadEnrollInfo() async {
  try {
    final templateResult = await getIt<FaceRepository>().getTemplate();
    final enrolledAt = templateResult.fold<DateTime?>(
      (_) => null,
      (template) => template?.enrolledAt,
    );
    if (enrolledAt == null) return const _EnrollInfo();
    final photoPath = await getIt<FacePhotoStore>().currentPath();
    return _EnrollInfo(enrolledAt: enrolledAt, photoPath: photoPath);
  } on Object {
    return const _EnrollInfo();
  }
}

String _t(BuildContext context, String uz, String ru) =>
    Localizations.localeOf(context).languageCode == 'ru' ? ru : uz;

class _MenuItem {
  const _MenuItem(
    this.title,
    this.icon,
    this.onTap, {
    this.trailing,
    this.hint,
    this.accent = false,
  });

  final String title;
  final IconData icon;
  final VoidCallback onTap;
  final String? trailing;
  final String? hint;

  /// Yangi/asosiy bo'lim — ikonkasi rangli fon bilan ajratiladi.
  final bool accent;
}

/// Guruhlangan menyu kartasi — har qatorda rangli ikonka, nom, ixtiyoriy
/// izoh/qiymat va o'q.
class _MenuCard extends StatelessWidget {
  const _MenuCard({required this.items});

  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const Divider(height: 1, indent: 60),
            InkWell(
              onTap: items[i].onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: items[i].accent
                            ? AppColors.primary
                            : AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        items[i].icon,
                        size: 19,
                        color: items[i].accent
                            ? Colors.white
                            : AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(items[i].title, style: AppTextStyles.bodyStrong),
                          if (items[i].hint != null)
                            Text(
                              items[i].hint!,
                              style: AppTextStyles.caption.copyWith(
                                color: inkMuted,
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (items[i].trailing != null)
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 120),
                        child: Text(
                          items[i].trailing!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.right,
                          style: AppTextStyles.caption.copyWith(
                            color: inkMuted,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    const SizedBox(width: 4),
                    Icon(AppIcons.arrowRight, size: 18, color: inkMuted),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Bu oy: kelgan kunlar, kechikishlar, soat — bosilsa "Mening davomatim".
class _MonthStatsRow extends StatefulWidget {
  const _MonthStatsRow();

  @override
  State<_MonthStatsRow> createState() => _MonthStatsRowState();
}

class _MonthStatsRowState extends State<_MonthStatsRow> {
  List<AttendanceHistoryDay>? _days;

  @override
  void initState() {
    super.initState();
    if (getIt.isRegistered<AttendanceHistorySource>()) {
      getIt<AttendanceHistorySource>()
          .load(days: 31)
          .then((d) {
            if (mounted) setState(() => _days = d);
          })
          .catchError((Object _) {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final month = (_days ?? const <AttendanceHistoryDay>[]).where(
      (d) => d.date.month == now.month && d.date.year == now.year,
    );
    final came = month.where((d) => d.came).length;
    final late = month.where((d) => d.isLate).length;
    final hours = month.fold<double>(0, (s, d) => s + (d.hours ?? 0));
    final loading = _days == null;
    Widget tile(String value, String label, Color color) => Expanded(
      child: AppCard(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              loading ? '—' : value,
              style: AppTextStyles.h3.copyWith(color: color),
            ),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption,
            ),
          ],
        ),
      ),
    );
    return Semantics(
      button: true,
      label: _t(context, 'Bu oygi davomat', 'Посещаемость за месяц'),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => context.push('/my-attendance'),
        child: Row(
          children: [
            tile('$came', _t(context, 'kun keldi', 'дней'), AppColors.success),
            const SizedBox(width: 8),
            tile(
              '$late',
              _t(context, 'kechikish', 'опозданий'),
              AppColors.warning,
            ),
            const SizedBox(width: 8),
            tile(
              hours.toStringAsFixed(0),
              _t(context, 'soat (bu oy)', 'часов'),
              AppColors.info,
            ),
          ],
        ),
      ),
    );
  }
}
