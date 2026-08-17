import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:user_app/core/widgets/app_shimmer.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/face/data/services/face_photo_store.dart';
import 'package:user_app/features/face/domain/repositories/face_repository.dart';
import 'package:user_app/injection.dart';

/// "Profil" tabi — fuqaro ma'lumotlari (avatar/ism/telefon) va sozlamalar
/// ro'yxati: til (uz/ru), tema (light/dark), PIN o'zgartirish (stub),
/// yordam (stub), hisobotlar va chiqish.
class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthCubit>().state.session;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          children: [
            _ProfileHeader(session: session),
            const SizedBox(height: 28),
            const _SettingsCard(),
            const SizedBox(height: 20),
            const _LogoutButton(),
          ],
        ),
      ),
    );
  }
}

class _ProfileHeader extends StatefulWidget {
  const _ProfileHeader({required this.session});

  final AuthSession? session;

  @override
  State<_ProfileHeader> createState() => _ProfileHeaderState();
}

class _ProfileHeaderState extends State<_ProfileHeader> {
  // Bir marta (sahifa ochilishida) yuklanadi — tema/til almashganda
  // qayta so'ralmasligi uchun `Future` keshlanadi.
  late final Future<_EnrollInfo> _enrollInfo = _loadEnrollInfo();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final name = widget.session?.name ?? '';
    final phone = widget.session?.phone ?? '';
    final region = widget.session?.region ?? '';

    return Column(
      children: [
        FutureBuilder<_EnrollInfo>(
          future: _enrollInfo,
          builder: (context, snapshot) => _FaceAvatar(
            name: name.isEmpty ? '?' : name,
            size: 84,
            photoPath: snapshot.data?.photoPath,
          ),
        ),
        const SizedBox(height: 14),
        Text(name, style: AppTextStyles.h2, textAlign: TextAlign.center),
        FutureBuilder<_EnrollInfo>(
          future: _enrollInfo,
          builder: (context, snapshot) {
            // Best-effort ma'lumot yuklanayotganda joy "sakramasligi" uchun
            // kichik shimmer o'rinbosar — natija kelgach yo sana matniga,
            // yo (bo'lmasa) hech narsaga almashadi.
            if (snapshot.connectionState != ConnectionState.done) {
              return const Padding(
                padding: EdgeInsets.only(top: 6),
                child: ShimmerBox(width: 170, height: 12),
              );
            }
            final enrolledAt = snapshot.data?.enrolledAt;
            if (enrolledAt == null) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                context.l10n.profileEnrolledOn(formatDate(enrolledAt)),
                style: AppTextStyles.caption.copyWith(color: inkMuted),
                textAlign: TextAlign.center,
              ),
            );
          },
        ),
        if (phone.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            phone,
            style: AppTextStyles.body.copyWith(color: inkMuted),
          ),
        ],
        if (region.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              region,
              style: AppTextStyles.caption.copyWith(
                color: AppColors.primaryDark,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ],
    ).animate().fadeIn(duration: 300.ms).slideY(begin: -0.06, end: 0);
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

class _SettingsCard extends StatelessWidget {
  const _SettingsCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final locale = context.watch<LocaleCubit>().state;
    final themeMode = context.watch<ThemeCubit>().state;
    final isDark = themeMode == ThemeMode.dark;

    return AppCard(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
          child: Column(
            children: [
              AppListTile(
                title: l10n.profileLanguageLabel,
                subtitle: locale.languageCode == 'ru'
                    ? l10n.profileLanguageRu
                    : l10n.profileLanguageUz,
                leadingIcon: IconsaxPlusLinear.translate,
                onTap: () => context.read<LocaleCubit>().setLocale(
                  Locale(locale.languageCode == 'ru' ? 'uz' : 'ru'),
                ),
              ),
              AppListTile(
                title: l10n.profileThemeLabel,
                subtitle: isDark
                    ? l10n.profileThemeDark
                    : l10n.profileThemeLight,
                leadingIcon: IconsaxPlusLinear.moon,
                onTap: () => context.read<ThemeCubit>().setMode(
                  isDark ? ThemeMode.light : ThemeMode.dark,
                ),
              ),
              AppListTile(
                title: l10n.profilePinLabel,
                leadingIcon: AppIcons.lock,
                onTap: () => AppAlert.info(context, l10n.comingSoonMessage),
              ),
              AppListTile(
                title: l10n.profileHelpLabel,
                leadingIcon: AppIcons.info,
                onTap: () => AppAlert.info(context, l10n.comingSoonMessage),
              ),
              AppListTile(
                title: l10n.profileReportsLabel,
                leadingIcon: IconsaxPlusLinear.chart_2,
                onTap: () => context.push('/reports'),
              ),
            ],
          ),
        )
        .animate(delay: 120.ms)
        .fadeIn(duration: 300.ms)
        .slideY(begin: 0.06, end: 0);
  }
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppButton(
          label: l10n.logout,
          variant: AppButtonVariant.secondary,
          icon: AppIcons.logout,
          onPressed: () async {
            // Tasodifiy chiqib ketishning oldini olish uchun tasdiqlash
            // modali — "Ha, chiqish" tanlanmasa hech narsa qilinmaydi.
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
            // `AuthInterceptor` keyingi so'rovlarga eskirgan tokenni
            // qo'shib yuboraveradi.
            await getIt<AuthRepository>().logout();
            if (!context.mounted) return;
            // MUHIM: tasdiqlash oynasi pop transaksiyasi TO'LIQ tugashini
            // kutamiz — aks holda reset()->redirect dialog pop bilan poyga
            // qilib (Navigator qulflangan), GoRouter assert bilan chiqishdan
            // keyin QORA ekran berardi.
            await Future<void>.delayed(const Duration(milliseconds: 220));
            if (!context.mounted) return;
            // `reset()` -> unauthenticated -> `refreshListenable` -> router
            // AVTOMATIK `/login`ga yo'naltiradi.
            context.read<AuthCubit>().reset();
          },
        )
        .animate(delay: 200.ms)
        .fadeIn(duration: 300.ms)
        .slideY(begin: 0.06, end: 0);
  }
}
