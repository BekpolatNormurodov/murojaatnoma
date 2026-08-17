import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Bo'sh holat ko'rinishi — ro'yxat bo'sh bo'lganda.
class EmptyState extends StatelessWidget {
  const EmptyState({
    required this.icon,
    required this.title,
    super.key,
    this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.10),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, size: 44, color: AppColors.primary),
                )
                .animate()
                .scale(
                  duration: 420.ms,
                  curve: Curves.easeOutBack,
                  begin: const Offset(0.7, 0.7),
                  end: const Offset(1, 1),
                )
                .fadeIn(),
            const SizedBox(height: 20),
            Text(
              title,
              style: AppTextStyles.h3,
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
            if (action != null) ...[
              const SizedBox(height: 24),
              action!
                  .animate()
                  .fadeIn(delay: 260.ms)
                  .slideY(begin: 0.2, end: 0),
            ],
          ],
        ),
      ),
    );
  }
}
