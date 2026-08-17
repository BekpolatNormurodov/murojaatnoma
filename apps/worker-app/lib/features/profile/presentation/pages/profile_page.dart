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
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/face/data/services/face_photo_store.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';
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

  /// Backendda hali "ish soatlari"ga alohida maydon yo'q (`AuthSession`da
  /// yo'q) — soxta qiymat o'ylab topmaslik uchun neytral belgi ko'rsatiladi,
  /// qator o'zi baribir `/schedule`ga olib boradi (haqiqiy jadval o'sha
  /// yerda).
  static const _workingHoursPlaceholder = '—';

  /// Ilova versiyasi — `pubspec.yaml`dagi `version:` bilan QO'LDA
  /// sinxronlanadi (`package_info_plus` kabi runtime-o'quvchi paket hali
  /// bog'liqlik sifatida qo'shilmagan, shuning uchun bu yerda o'z-o'zidan
  /// o'qilmaydi). Fabrikatsiya qilingan '4.8' reyting kabi ХАТО qiymat
  /// EMAS — bu haqiqiy release versiyasi, faqat statik konstanta sifatida.
  static const _appVersion = 'v1.0.8';

  /// [session]dan "Bo'lim" qatori uchun eng yaqin haqiqiy ma'lumot —
  /// backendda alohida "bo'lim nomi" maydoni yo'q, shuning uchun
  /// hudud/tuman birlashtirilib ko'rsatiladi (soxta bo'lim nomi
  /// o'ylab topilmaydi). Ikkalasi ham bo'sh bo'lsa — neytral belgi.
  static String _departmentValue(AuthSession? session) {
    final region = session?.region ?? '';
    final district = session?.district ?? '';
    if (region.isEmpty && district.isEmpty) return _workingHoursPlaceholder;
    if (district.isEmpty) return region;
    if (region.isEmpty) return district;
    return '$region, $district';
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
    try {
      await getIt<AuthRepository>().logout();
    } on Object catch (_) {
      // Xato e'tiborsiz qoldiriladi — quyidagi navigatsiya baribir sodir
      // bo'ladi.
    }
    if (!context.mounted) return;
    // MUHIM: tasdiqlash oynasi (dialog) pop transaksiyasi TO'LIQ tugashini
    // kutamiz — aks holda `reset()` -> `refreshListenable` -> redirect dialog
    // pop bilan bir vaqtda ishlab (Navigator qulflangan holatda), GoRouter
    // `currentConfiguration.isNotEmpty` / `!_debugLocked` assert bilan
    // chiqishdan keyin QORA ekran berardi. Kadr yakunlangach navigator
    // qulfi bo'shaydi va redirect toza `/login`ga o'tadi.
    await Future<void>.delayed(const Duration(milliseconds: 220));
    if (!context.mounted) return;
    // `reset()` -> unauthenticated -> `refreshListenable` -> redirect
    // AVTOMATIK `/login`ga yo'naltiradi (qo'lda `go` shart emas).
    context.read<AuthCubit>().reset();
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
                const SizedBox(height: 24),
                _SectionTitle(l10n.profileLanguageTitle),
                const SizedBox(height: 8),
                AppCard(
                      child: AppSegmented<Locale>(
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
                    )
                    .animate(delay: 60.ms)
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: 0.06, end: 0),
                const SizedBox(height: 24),
                _SectionTitle(l10n.profileThemeTitle),
                const SizedBox(height: 8),
                AppCard(
                      child: AppSegmented<ThemeMode>(
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
                    )
                    .animate(delay: 100.ms)
                    .fadeIn(duration: 300.ms)
                    .slideY(begin: 0.06, end: 0),
                const SizedBox(height: 24),
                _SectionTitle(l10n.profileWorkInfoTitle),
                const SizedBox(height: 8),
                AppCard(
                      padding: const EdgeInsets.symmetric(
                        vertical: 4,
                        horizontal: 8,
                      ),
                      child: Column(
                        children: [
                          AppListTile(
                            title: l10n.profileWorkingHoursLabel,
                            leadingIcon: AppIcons.timer,
                            trailing: const _TrailingValue(
                              _workingHoursPlaceholder,
                            ),
                            onTap: () => context.push('/schedule'),
                          ),
                          const Divider(height: 1),
                          AppListTile(
                            title: l10n.profileDepartmentLabel,
                            leadingIcon: AppIcons.building,
                            trailing: _TrailingValue(
                              _departmentValue(session),
                            ),
                          ),
                          const Divider(height: 1),
                          AppListTile(
                            title: l10n.leaveRequestTileLabel,
                            leadingIcon: AppIcons.calendar,
                            onTap: () => context.push('/leave-request'),
                          ),
                          const Divider(height: 1),
                          AppListTile(
                            title: l10n.profileNewsTileLabel,
                            leadingIcon: AppIcons.notification,
                            onTap: () => context.push('/news'),
                          ),
                          const Divider(height: 1),
                          AppListTile(
                            title: l10n.profileDocumentsTileLabel,
                            leadingIcon: IconsaxPlusLinear.document_text,
                            onTap: () => context.push('/documents'),
                          ),
                        ],
                      ),
                    )
                    .animate(delay: 140.ms)
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
    final name = widget.session?.name ?? '';
    final position = widget.session?.position ?? '';
    final region = widget.session?.region ?? '';
    final workerId = widget.session?.workerId ?? '';

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
                  style: AppTextStyles.body.copyWith(color: mutedColor),
                  maxLines: 1,
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
                const SizedBox(height: 10),
                Wrap(
                  spacing: 14,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _IconLabel(
                      icon: AppIcons.location,
                      text: region,
                      color: mutedColor,
                    ),
                    _IconLabel(
                      icon: AppIcons.key,
                      text: l10n.profileWorkerIdLabel(workerId),
                      color: mutedColor,
                    ),
                  ],
                ),
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

/// Kichik ikon+matn juftligi (masalan hudud, ishchi ID) — uzun matn
/// atrofdagi `Wrap`ni yorib chiqmasligi uchun kengligi cheklangan.
class _IconLabel extends StatelessWidget {
  const _IconLabel({
    required this.icon,
    required this.text,
    required this.color,
  });

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 160),
          child: Text(
            text,
            style: AppTextStyles.caption.copyWith(color: color),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
