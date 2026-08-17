import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:flutter/material.dart';

/// Bitta skeleton (shimmer) bo'lagi — matn qatori, avatar yoki ixtiyoriy
/// o'lchamdagi to'rtburchak o'rnini bosuvchi, animatsion "porlash" chizig'i
/// bilan.
///
/// Ekran yuklanayotganda oq/bo'sh holat ko'rsatmaslik uchun ishlatiladi.
class AppSkeleton extends StatefulWidget {
  const AppSkeleton({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius,
    this.circle = false,
  });

  /// Kenglik (`null` bo'lsa mavjud joyni to'ldiradi).
  final double? width;
  final double height;

  /// Burchak radiusi (standart: [AppRadii.xs]). [circle] true bo'lsa e'tibor
  /// berilmaydi.
  final BorderRadius? borderRadius;

  /// true bo'lsa doira (masalan avatar o'rni) sifatida chiziladi.
  final bool circle;

  @override
  State<AppSkeleton> createState() => _AppSkeletonState();
}

class _AppSkeletonState extends State<AppSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1300),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final radius = widget.circle
        ? BorderRadius.circular(widget.height / 2)
        : widget.borderRadius ?? BorderRadius.circular(AppRadii.xs);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final glint = isDark ? AppColors.darkInkMuted : AppColors.surface;

    return ClipRRect(
      borderRadius: radius,
      child: SizedBox(
        width: widget.circle ? widget.height : widget.width,
        height: widget.height,
        child: ColoredBox(
          color: line.withValues(alpha: 0.55),
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      line.withValues(alpha: 0),
                      glint.withValues(alpha: 0.75),
                      line.withValues(alpha: 0),
                    ],
                    stops: const [0.3, 0.5, 0.7],
                    transform: _SweepTransform(_controller.value),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// [AppSkeleton] uchun gradientni chapdan o'ngga suradi — `t` 0..1 bo'ylab
/// belgi to'liq chap tashqarisidan to'liq o'ng tashqarisiga o'tadi.
class _SweepTransform extends GradientTransform {
  const _SweepTransform(this.t);

  final double t;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(bounds.width * (t * 3 - 1.5), 0, 0);
  }
}

/// Ro'yxat ekranlari uchun tayyor skeleton qatorlar ustuni (avatar + ikki
/// matn qatori), [AppSkeleton]lardan yig'ilgan.
class AppSkeletonList extends StatelessWidget {
  const AppSkeletonList({
    super.key,
    this.itemCount = 6,
    this.itemHeight = 64,
    this.spacing = 14,
    this.padding = const EdgeInsets.all(16),
    this.avatar = true,
  });

  final int itemCount;
  final double itemHeight;
  final double spacing;
  final EdgeInsetsGeometry padding;

  /// true bo'lsa har qatorda doira (avatar) skeleton ham chiziladi.
  final bool avatar;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: padding,
      itemCount: itemCount,
      separatorBuilder: (context, index) => SizedBox(height: spacing),
      itemBuilder: (context, index) => SizedBox(
        height: itemHeight,
        child: Row(
          children: [
            if (avatar) ...[
              const AppSkeleton(circle: true, height: 44),
              const SizedBox(width: 14),
            ],
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AppSkeleton(width: double.infinity, height: 15),
                  SizedBox(height: 10),
                  AppSkeleton(width: 140, height: 12),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
