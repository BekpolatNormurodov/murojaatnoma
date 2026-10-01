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
  /// Faqat har kadrda qayta chizish uchun. Porlash FAZASI soatdan olinadi
  /// (pastda [_phase]) — shu tufayli ekrandagi BARCHA skeletonlar bitta
  /// to'lqin bo'lib, bir xil tezlikda o'tadi. Ilgari har bo'lak o'z
  /// kontrolleri bilan, o'z kengligi bo'yicha porlardi: kichik bloklar
  /// tez, kattalari sekin, hammasi har xil fazada — "miltillash" tartibsiz
  /// ko'rinardi.
  late final AnimationController _ticker = AnimationController(
    vsync: this,
    duration: _period,
  );

  static const _period = Duration(milliseconds: 1500);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // "Animatsiyalarni kamaytirish" yoqilgan bo'lsa — statik plashka.
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      _ticker.stop();
    } else if (!_ticker.isAnimating) {
      _ticker.repeat();
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  static double _phase() {
    final ms = DateTime.now().millisecondsSinceEpoch;
    return (ms % _period.inMilliseconds) / _period.inMilliseconds;
  }

  @override
  Widget build(BuildContext context) {
    final radius = widget.circle
        ? BorderRadius.circular(widget.height / 2)
        : widget.borderRadius ?? BorderRadius.circular(AppRadii.xs);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Asos karta foni ustida aniq ko'rinadigan bo'lsin (ilgari line*0.55
    // oq kartada deyarli ko'rinmasdi).
    final base = isDark ? const Color(0xFF243044) : const Color(0xFFE8EDF3);
    final shine = isDark
        ? const Color(0xFF34425A)
        : Colors.white.withValues(alpha: 0.95);
    final screenWidth = MediaQuery.sizeOf(context).width;

    final block = DecoratedBox(
      decoration: BoxDecoration(color: base, borderRadius: radius),
    );

    return SizedBox(
      width: widget.circle ? widget.height : widget.width,
      height: widget.height,
      child: AnimatedBuilder(
        animation: _ticker,
        child: block,
        builder: (context, child) {
          if (!_ticker.isAnimating) return child!;
          final t = _phase();
          return ShaderMask(
            blendMode: BlendMode.srcATop,
            shaderCallback: (bounds) {
              // Porlash ekran koordinatalarida yuradi: bo'lakning global
              // X'ini ayirib, hamma bloklar bitta to'lqinni "kesib" ko'rsatadi.
              final box = context.findRenderObject() as RenderBox?;
              final dx = box != null && box.attached && box.hasSize
                  ? box.localToGlobal(Offset.zero).dx
                  : 0.0;
              final band = screenWidth * 0.55;
              final center = -band + t * (screenWidth + band * 2) - dx;
              return LinearGradient(
                colors: [base, shine, base],
              ).createShader(
                Rect.fromLTWH(center - band / 2, 0, band, bounds.height),
              );
            },
            child: child,
          );
        },
      ),
    );
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
