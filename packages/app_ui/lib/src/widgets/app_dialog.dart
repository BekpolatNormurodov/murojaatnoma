import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:app_ui/src/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// Markazlashtirilgan dialog yordamchilari — tasdiq va muvaffaqiyat oynalari.
class AppDialog {
  AppDialog._();

  /// Umumiy dialog: animatsion icon + sarlavha + matn + tugmalar.
  static Future<T?> show<T>({
    required BuildContext context,
    required IconData icon,
    required String title,
    required List<Widget> actions,
    Color iconColor = AppColors.primary,
    String? message,
    bool barrierDismissible = true,
  }) {
    return showDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (_) => _DialogShell(
        icon: icon,
        iconColor: iconColor,
        title: title,
        message: message,
        actions: actions,
      ),
    );
  }

  /// Tasdiqlash oynasi — true/false qaytaradi.
  static Future<bool> confirm({
    required BuildContext context,
    required String title,
    String? message,
    String confirmLabel = 'Tasdiqlash',
    String cancelLabel = 'Bekor qilish',
    IconData icon = IconsaxPlusLinear.info_circle,
    bool danger = false,
  }) async {
    final color = danger ? AppColors.danger : AppColors.primary;
    final res = await show<bool>(
      context: context,
      icon: icon,
      iconColor: color,
      title: title,
      message: message,
      actions: [
        AppButton(
          label: confirmLabel,
          variant: danger ? AppButtonVariant.danger : AppButtonVariant.primary,
          onPressed: () => Navigator.of(context).pop(true),
        ),
        const SizedBox(height: 10),
        AppButton(
          label: cancelLabel,
          variant: AppButtonVariant.ghost,
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ],
    );
    return res ?? false;
  }

  /// Muvaffaqiyat oynasi.
  static Future<void> success({
    required BuildContext context,
    required String title,
    String? message,
    String buttonLabel = 'Yopish',
    VoidCallback? onClose,
  }) {
    return show<void>(
      context: context,
      icon: IconsaxPlusBold.tick_circle,
      title: title,
      message: message,
      actions: [
        AppButton(
          label: buttonLabel,
          onPressed: () {
            Navigator.of(context).pop();
            onClose?.call();
          },
        ),
      ],
    );
  }
}

class _DialogShell extends StatelessWidget {
  const _DialogShell({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.message,
    required this.actions,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String? message;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Dialog(
      backgroundColor: isDark ? AppColors.darkSurface : AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 32),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.xl),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, size: 36, color: iconColor),
                )
                .animate()
                .scale(
                  duration: 420.ms,
                  curve: Curves.easeOutBack,
                  begin: const Offset(0.6, 0.6),
                  end: const Offset(1, 1),
                )
                .fadeIn(duration: 220.ms),
            const SizedBox(height: 18),
            Text(
              title,
              style: AppTextStyles.h2,
              textAlign: TextAlign.center,
            ).animate().fadeIn(delay: 120.ms),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message!,
                style: AppTextStyles.body,
                textAlign: TextAlign.center,
              ).animate().fadeIn(delay: 180.ms),
            ],
            const SizedBox(height: 24),
            ...actions,
          ],
        ),
      ),
    );
  }
}
