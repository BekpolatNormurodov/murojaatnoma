import 'dart:async';

import 'package:app_ui/src/constants/app_icons.dart';
import 'package:app_ui/src/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Premium, doiraviy "orqaga" tugmasi — barcha ichki/tafsilot sahifalarning
/// `AppBar.leading`sida standart Material orqaga strelkasi o'rniga
/// ishlatiladi.
///
/// Theme-aware (och/tun): yumshoq sirt foni + nozik ripple bilan. `onPressed`
/// berilmasa, standart ravishda joriy marshrutni yopadi
/// (`Navigator.maybePop`) — go_router'ning `context.pop()`i ham xuddi shu
/// `Navigator` mexanizmiga tayanadi, shuning uchun go_router yo'llarida ham,
/// oddiy `Navigator.push` oqimlarida ham bir xil ishlaydi.
class AppBackButton extends StatelessWidget {
  const AppBackButton({
    super.key,
    this.onPressed,
    this.size = 40,
    this.background,
    this.foreground,
  });

  /// Bosilganda chaqiriladi. Berilmasa: `Navigator.maybePop(context)`.
  final VoidCallback? onPressed;

  /// Doiraviy tugma diametri (piksel).
  final double size;

  /// Doira foni. Berilmasa: joriy mavzuga qarab theme-aware
  /// (`AppColors.surfaceAlt`/`darkSurfaceAlt`). Kamera oqimi kabi
  /// mavzudan mustaqil (har doim qorong'i) fon ustida ko'rsatilganda
  /// (masalan yuz ro'yxatdan o'tkazish/check-in sahifalari) qattiq
  /// qiymat bilan bekor qilinishi mumkin.
  final Color? background;

  /// Ikonka rangi. Berilmasa: joriy mavzuga qarab theme-aware
  /// (`AppColors.ink`/`darkInk`). [background] kabi bekor qilinishi mumkin.
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final resolvedBackground =
        background ??
        (isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt);
    final resolvedForeground =
        foreground ?? (isDark ? AppColors.darkInk : AppColors.ink);

    return Center(
      child: Material(
        color: resolvedBackground,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed ?? () => unawaited(Navigator.maybePop(context)),
          customBorder: const CircleBorder(),
          child: Tooltip(
            message: 'Orqaga',
            child: SizedBox(
              width: size,
              height: size,
              child: Icon(
                AppIcons.arrowLeft,
                size: size * 0.5,
                color: resolvedForeground,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
