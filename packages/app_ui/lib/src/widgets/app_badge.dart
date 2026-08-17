import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

/// [AppBadge] semantik rangi.
enum AppBadgeVariant { primary, success, warning, danger, info, neutral }

/// Kichik son/holat belgisi — navigatsiya tab'lari, ro'yxat qatorlari uchun.
///
/// [dot] true bo'lsa faqat kichik nuqta (o'qilmagan/faol holat belgisi)
/// chiziladi; aks holda [count] yoki [label] matni bilan "pill" chiziladi.
class AppBadge extends StatelessWidget {
  const AppBadge({
    super.key,
    this.count,
    this.label,
    this.variant = AppBadgeVariant.primary,
    this.dot = false,
    this.maxCount = 99,
    this.showZero = false,
  });

  /// Ko'rsatiladigan son (masalan o'qilmagan xabarlar soni).
  final int? count;

  /// [count] o'rniga erkin matn (masalan `"Yangi"`).
  final String? label;
  final AppBadgeVariant variant;

  /// true bo'lsa son/matn o'rniga kichik nuqta chiziladi.
  final bool dot;

  /// Shu qiymatdan katta sonlar `"$maxCount+"` ko'rinishida qisqartiriladi.
  final int maxCount;

  /// `count == 0` bo'lganda ham belgini ko'rsatish (standart: yashiriladi).
  final bool showZero;

  Color _color() => switch (variant) {
    AppBadgeVariant.primary => AppColors.primary,
    AppBadgeVariant.success => AppColors.success,
    AppBadgeVariant.warning => AppColors.warning,
    AppBadgeVariant.danger => AppColors.danger,
    AppBadgeVariant.info => AppColors.info,
    AppBadgeVariant.neutral => AppColors.inkMuted,
  };

  @override
  Widget build(BuildContext context) {
    final color = _color();

    if (dot) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      return Container(
        width: 9,
        height: 9,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
          border: Border.all(
            color: isDark ? AppColors.darkSurface : AppColors.surface,
            width: 1.5,
          ),
        ),
      );
    }

    if (label == null) {
      final value = count;
      final hideEmpty = value == null || (value == 0 && !showZero);
      if (hideEmpty) {
        return const SizedBox.shrink();
      }
    }

    final text = label ?? (count! > maxCount ? '$maxCount+' : '$count');

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      constraints: const BoxConstraints(minWidth: 20),
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.caption.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 11,
          height: 1,
        ),
      ),
    );
  }
}
