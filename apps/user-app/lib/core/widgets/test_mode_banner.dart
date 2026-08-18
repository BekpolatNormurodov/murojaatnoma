import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';

/// "Test jarayonida" ogohlantirish banneri.
///
/// Kommunal to'lovlar bo'limi hozircha MOCK — haqiqiy to'lov shlyuzi (bank/
/// billing) ulanmagan. Foydalanuvchi haqiqiy pul o'tkazilmasligini aniq
/// bilishi uchun to'lov ekranlari tepasida ko'rsatiladi. Real shlyuz
/// ulanganda bu banner olib tashlanadi.
class TestModeBanner extends StatelessWidget {
  const TestModeBanner({this.message, super.key});

  /// Ixtiyoriy maxsus matn; berilmasa standart to'lov-test matni ko'rsatiladi.
  final String? message;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: AppColors.warning.withValues(alpha: isDark ? 0.20 : 0.12),
      child: Row(
        children: [
          const Icon(AppIcons.info, size: 18, color: AppColors.warning),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message ??
                  "Test jarayonida — namoyish rejimi. Haqiqiy to'lov amalga "
                      'oshmaydi.',
              style: AppTextStyles.caption.copyWith(
                color: AppColors.warning,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
