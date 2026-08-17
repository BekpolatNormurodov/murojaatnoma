import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

enum AppAlertType { success, error, info, warning }

/// Yagona dizaynli bildirishnoma (toast/snackbar) — turi bo'yicha rang va
/// icon.
class AppAlert {
  AppAlert._();

  static void show(
    BuildContext context,
    String message, {
    AppAlertType type = AppAlertType.info,
  }) {
    final (color, icon) = switch (type) {
      AppAlertType.success => (AppColors.success, IconsaxPlusBold.tick_circle),
      AppAlertType.error => (AppColors.danger, IconsaxPlusBold.close_circle),
      AppAlertType.warning => (AppColors.warning, IconsaxPlusBold.warning_2),
      AppAlertType.info => (AppColors.accent, IconsaxPlusBold.info_circle),
    };

    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.ink,
          elevation: 0,
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          duration: const Duration(seconds: 3),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          content: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: AppTextStyles.bodyStrong.copyWith(color: Colors.white),
                ),
              ),
            ],
          ),
        ),
      );
  }

  static void success(BuildContext context, String message) =>
      show(context, message, type: AppAlertType.success);
  static void error(BuildContext context, String message) =>
      show(context, message, type: AppAlertType.error);
  static void info(BuildContext context, String message) =>
      show(context, message);
  static void warning(BuildContext context, String message) =>
      show(context, message, type: AppAlertType.warning);
}
