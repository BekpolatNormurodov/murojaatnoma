import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Yagona dizaynli karta — bosilganda yengil animatsiya bilan.
class AppCard extends StatefulWidget {
  const AppCard({
    required this.child,
    super.key,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
    this.color,
    this.gradient,
    this.borderRadius,
    this.border = true,
    this.shadow = false,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final Gradient? gradient;
  final BorderRadius? borderRadius;
  final bool border;
  final bool shadow;

  @override
  State<AppCard> createState() => _AppCardState();
}

class _AppCardState extends State<AppCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final radius = widget.borderRadius ?? BorderRadius.circular(AppRadii.lg);
    final tappable = widget.onTap != null;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;

    final card = AnimatedScale(
      scale: _pressed ? 0.98 : 1.0,
      duration: const Duration(milliseconds: 120),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: widget.padding,
        decoration: BoxDecoration(
          color: widget.gradient == null
              ? (widget.color ?? surface)
              : null,
          gradient: widget.gradient,
          borderRadius: radius,
          border: widget.border && widget.gradient == null
              ? Border.all(
                  color: _pressed ? AppColors.primary : line,
                  width: _pressed ? 1.2 : 1,
                )
              : null,
          boxShadow: widget.shadow
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: widget.child,
      ),
    );

    if (!tappable) return card;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.selectionClick();
        widget.onTap!();
      },
      child: card,
    );
  }
}
