import 'dart:ui' show ImageFilter;

import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

/// Skanerlash ekranlari uchun animatsion ko'rsatma "pill"i — odatda
/// overlay pastida suzib turadigan, xira (frosted glass) fonli, joriy
/// bosqich ko'rsatmasini ko'rsatuvchi widget.
///
/// [message] o'zgarganda kontent (icon + matn) `AnimatedSwitcher` orqali
/// yumshoq tarzda (fade + biroz yuqoriga siljish + scale) almashadi —
/// foydalanuvchi har bir yangi ko'rsatmani "sezadi", lekin pill
/// chayqalmaydi. Kalit sifatida [message] matnining o'zi ishlatiladi.
///
/// Fon doim quyuq shisha (frosted dark glass) uslubida — kamera view
/// ustida suzganda bu ham yorug', ham qorong'i mavzuda eng barqaror
/// kontrastni beradi (`AppAlert` snackbar'idagi bilan bir xil mantiq),
/// aniq soya/rang esa `Theme.of(context).brightness`ga qarab `AppColors`
/// tokenlaridan olinadi.
class FaceScanMessage extends StatelessWidget {
  const FaceScanMessage({
    required this.message,
    super.key,
    this.icon,
    this.accentColor,
  });

  /// Ko'rsatiladigan ko'rsatma matni — o'zgarganda animatsiya bilan
  /// almashadi.
  final String message;

  /// Matn oldidagi ixtiyoriy icon (yumshoq rangli doira ichida).
  final IconData? icon;

  /// Icon doirasi rangi — `null` bo'lsa neytral (mavzuga mos) rang
  /// ishlatiladi. Chaqiruvchi joriy holat rangini (masalan skaner
  /// overlay'ining kontur rangini) uzatishi mumkin — shunda pill icon
  /// rangi kontur rangi bilan mos keladi.
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final glass = isDark ? AppColors.darkSurface : AppColors.ink;
    final onGlass = isDark ? AppColors.darkInk : AppColors.surface;
    final accent =
        accentColor ?? (isDark ? AppColors.darkInkMuted : AppColors.inkMuted);

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.xl),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.fromLTRB(14, 10, 20, 10),
          decoration: BoxDecoration(
            color: glass.withValues(alpha: 0.70),
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(color: onGlass.withValues(alpha: 0.12)),
            boxShadow: [
              BoxShadow(
                color: AppColors.ink.withValues(alpha: 0.18),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 280),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            transitionBuilder: (child, animation) {
              final slide = Tween<Offset>(
                begin: const Offset(0, 0.3),
                end: Offset.zero,
              ).animate(animation);
              final scale = Tween<double>(begin: 0.92, end: 1).animate(
                CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
              );
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: slide,
                  child: ScaleTransition(scale: scale, child: child),
                ),
              );
            },
            layoutBuilder: (currentChild, previousChildren) => Stack(
              alignment: Alignment.centerLeft,
              children: [
                ...previousChildren,
                if (currentChild != null) currentChild,
              ],
            ),
            child: Row(
              key: ValueKey<String>(message),
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: accent.withValues(alpha: 0.22),
                    ),
                    child: Icon(icon, size: 16, color: accent),
                  ),
                  const SizedBox(width: 10),
                ],
                Flexible(
                  child: Text(
                    message,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodyStrong.copyWith(color: onGlass),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
