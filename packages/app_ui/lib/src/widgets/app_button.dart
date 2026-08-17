import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

enum AppButtonVariant { primary, secondary, ghost, danger }

/// Yagona dizaynli tugma — bosilganda animatsiya bilan.
class AppButton extends StatefulWidget {
  const AppButton({
    required this.label,
    super.key,
    this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.icon,
    this.loading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final IconData? icon;
  final bool loading;
  final bool expand;

  @override
  State<AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<AppButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isPrimary = widget.variant == AppButtonVariant.primary;
    final isGhost = widget.variant == AppButtonVariant.ghost;
    final isDanger = widget.variant == AppButtonVariant.danger;
    final disabled = widget.onPressed == null || widget.loading;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;

    final bg = isPrimary
        ? AppColors.primary
        : isDanger
        ? AppColors.danger
        : isGhost
        ? Colors.transparent
        : surfaceAlt;
    final fg = isPrimary || isDanger
        ? Colors.white
        : isGhost
        ? AppColors.primary
        : ink;

    return GestureDetector(
      onTapDown: disabled ? null : (_) => setState(() => _pressed = true),
      onTapUp: disabled ? null : (_) => setState(() => _pressed = false),
      onTapCancel: disabled ? null : () => setState(() => _pressed = false),
      onTap: disabled
          ? null
          : () {
              HapticFeedback.lightImpact();
              widget.onPressed!();
            },
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        child: AnimatedOpacity(
          opacity: disabled && !widget.loading ? 0.5 : 1,
          duration: const Duration(milliseconds: 150),
          child: Container(
            width: widget.expand ? double.infinity : null,
            height: 54,
            padding: const EdgeInsets.symmetric(horizontal: 24),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: widget.variant == AppButtonVariant.secondary
                  ? Border.all(color: line)
                  : null,
              boxShadow: isPrimary || isDanger
                  ? [
                      BoxShadow(
                        color: bg.withValues(alpha: 0.3),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: widget.loading
                  ? SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        valueColor: AlwaysStoppedAnimation(fg),
                      ),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.label,
                          style: AppTextStyles.button.copyWith(color: fg),
                        ),
                        if (widget.icon != null) ...[
                          const SizedBox(width: 8),
                          Icon(widget.icon, size: 20, color: fg),
                        ],
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
