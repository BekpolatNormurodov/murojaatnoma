import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:flutter/material.dart';

/// Sahifa boshidagi brend rangli "qahramon" karta: gradient va yumshoq
/// doiralar. Ichidagi matn oq rangda bo'lishi kerak.
class AppHero extends StatelessWidget {
  const AppHero({
    required this.child,
    this.padding = const EdgeInsets.all(18),
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadii.lg + 4);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            Color(0xFF0E7490),
            AppColors.accentDark,
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.accentDark.withValues(alpha: 0.30),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          children: [
            const Positioned(top: -42, right: -28, child: _Bubble(130, 0.12)),
            const Positioned(bottom: -50, right: 70, child: _Bubble(96, 0.08)),
            Padding(padding: padding, child: child),
          ],
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble(this.size, this.alpha);

  final double size;
  final double alpha;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: alpha),
      ),
    ),
  );
}
