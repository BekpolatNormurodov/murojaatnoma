import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// Xato holati ko'rinishi — tarmoq/server xatosi bo'lganda ro'yxat yoki
/// sahifa o'rnida ko'rsatiladi. `app_ui` rang/matn token'lari va
/// `AppButton`dan foydalanadi, shu bilan boshqa polish primitivlari
/// (`EmptyView`, `ShimmerList`) bilan bir xil vizual tilda qoladi.
class ErrorView extends StatelessWidget {
  const ErrorView({
    required this.message,
    super.key,
    this.onRetry,
    this.icon = IconsaxPlusBold.danger,
    this.retryLabel = 'Qayta urinish',
  });

  /// Foydalanuvchiga ko'rsatiladigan xato matni.
  final String message;

  /// `null` bo'lsa "Qayta urinish" tugmasi ko'rsatilmaydi.
  final VoidCallback? onRetry;

  final IconData icon;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final subtitle = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.10),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 40, color: AppColors.danger),
            ),
            const SizedBox(height: 20),
            Text(
              message,
              style: AppTextStyles.body.copyWith(color: subtitle),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              AppButton(
                label: retryLabel,
                icon: IconsaxPlusLinear.refresh,
                onPressed: onRetry,
                expand: false,
                variant: AppButtonVariant.secondary,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
