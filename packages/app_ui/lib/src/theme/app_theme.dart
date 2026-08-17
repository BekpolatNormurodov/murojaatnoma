import 'package:app_ui/src/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Ilova Material 3 mavzulari — och (light) va tun (dark) variantlari.
class AppTheme {
  AppTheme._();

  static ThemeData get light => _base(Brightness.light);
  static ThemeData get dark => _base(Brightness.dark);

  static ThemeData _base(Brightness b) {
    final dark = b == Brightness.dark;
    final canvas = dark ? AppColors.darkCanvas : AppColors.canvas;
    final surface = dark ? AppColors.darkSurface : AppColors.surface;
    final line = dark ? AppColors.darkLine : AppColors.line;
    final ink = dark ? AppColors.darkInk : AppColors.ink;
    final base = ThemeData(brightness: b, useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: canvas,
      colorScheme:
          ColorScheme.fromSeed(
            seedColor: AppColors.primary,
            brightness: b,
          ).copyWith(
            primary: AppColors.primary,
            secondary: AppColors.accent,
            surface: surface,
            error: AppColors.danger,
          ),
      textTheme: GoogleFonts.interTextTheme(
        base.textTheme,
      ).apply(bodyColor: ink, displayColor: ink),
      appBarTheme: AppBarTheme(
        backgroundColor: canvas,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: ink),
        systemOverlayStyle: dark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: line),
        ),
      ),
      dividerTheme: DividerThemeData(color: line, thickness: 1),
      splashColor: AppColors.primaryLight.withValues(alpha: 0.3),
      highlightColor: Colors.transparent,
    );
  }
}
