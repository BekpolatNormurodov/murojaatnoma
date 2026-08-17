import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';

/// Ilova-darajasidagi shimmer/skeleton yuklash primitivlari.
///
/// Animatsion "porlash" (sweep) chizig'i `app_ui`ning [AppSkeleton]/
/// [AppSkeletonList] ustida qurilgan — shu tufayli animatsiya mantiqi
/// bitta joyda (design-system paketida) qoladi va yangi pub bog'liqlik
/// (masalan `shimmer` paketi) qo'shilmaydi.

/// Bitta shimmer to'rtburchak — matn qatori, avatar yoki ixtiyoriy
/// o'lchamdagi to'ldiruvchi uchun. Radius `double` sifatida qulay
/// beriladi (ichkarida [BorderRadius.circular]ga aylantiriladi).
class ShimmerBox extends StatelessWidget {
  const ShimmerBox({
    super.key,
    this.width,
    this.height = 16,
    this.radius,
    this.circle = false,
  });

  /// Kenglik (`null` bo'lsa mavjud joyni to'ldiradi).
  final double? width;

  /// Balandlik.
  final double height;

  /// Burchak radiusi (`null` bo'lsa [AppSkeleton]ning standart qiymati
  /// ishlatiladi). [circle] `true` bo'lsa e'tibor berilmaydi.
  final double? radius;

  /// `true` bo'lsa doira (masalan avatar o'rni) sifatida chiziladi.
  final bool circle;

  @override
  Widget build(BuildContext context) {
    return AppSkeleton(
      width: width,
      height: height,
      circle: circle,
      borderRadius: radius != null ? BorderRadius.circular(radius!) : null,
    );
  }
}

/// Ro'yxat qatori skeletoni — ixtiyoriy dumaloq avatar + ikki matn
/// qatori (sarlavha + kichik subtitle). [ShimmerList] shundan yig'iladi,
/// lekin alohida ham (masalan bitta kartaning ichida) ishlatilishi mumkin.
class ShimmerListTile extends StatelessWidget {
  const ShimmerListTile({
    super.key,
    this.height = 64,
    this.avatar = true,
    this.padding = EdgeInsets.zero,
  });

  final double height;

  /// `true` bo'lsa qator boshida dumaloq avatar-o'rni chiziladi.
  final bool avatar;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: SizedBox(
        height: height,
        child: Row(
          children: [
            if (avatar) ...[
              const ShimmerBox(circle: true, height: 44),
              const SizedBox(width: 14),
            ],
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ShimmerBox(width: double.infinity, height: 15),
                  SizedBox(height: 10),
                  ShimmerBox(width: 140, height: 12),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Ro'yxat ekranlari uchun tayyor shimmer skelet ro'yxati — "cache-then-
/// network" naqshida ma'lumot hali kelmagan/yangilanayotgan paytda
/// ko'rsatiladi. Birinchi pozitsion parametr — qator soni.
class ShimmerList extends StatelessWidget {
  const ShimmerList(
    this.count, {
    super.key,
    this.itemHeight = 64,
    this.spacing = 14,
    this.padding = const EdgeInsets.all(16),
    this.avatar = true,
  });

  /// Ko'rsatiladigan skeleton qatorlar soni.
  final int count;
  final double itemHeight;
  final double spacing;
  final EdgeInsetsGeometry padding;
  final bool avatar;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: padding,
      itemCount: count,
      separatorBuilder: (context, index) => SizedBox(height: spacing),
      itemBuilder: (context, index) =>
          ShimmerListTile(height: itemHeight, avatar: avatar),
    );
  }
}
