import 'package:app_ui/src/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Ikonka fonining rangi — bo'limlar bir qarashda ajralib turadi.
enum AppTone { teal, blue, indigo, violet, pink, orange, amber, green, red, slate }

extension AppToneColors on AppTone {
  /// Gradientning yorqin va to'q uchi.
  (Color, Color) get colors => switch (this) {
    AppTone.teal => (const Color(0xFF14B8A6), const Color(0xFF0F766E)),
    AppTone.blue => (const Color(0xFF3B82F6), const Color(0xFF1D4ED8)),
    AppTone.indigo => (const Color(0xFF6366F1), const Color(0xFF4338CA)),
    AppTone.violet => (const Color(0xFF8B5CF6), const Color(0xFF6D28D9)),
    AppTone.pink => (const Color(0xFFEC4899), const Color(0xFFBE185D)),
    AppTone.orange => (const Color(0xFFFB923C), const Color(0xFFEA580C)),
    AppTone.amber => (const Color(0xFFFBBF24), const Color(0xFFD97706)),
    AppTone.green => (const Color(0xFF22C55E), const Color(0xFF15803D)),
    AppTone.red => (const Color(0xFFF87171), const Color(0xFFDC2626)),
    AppTone.slate => (const Color(0xFF64748B), const Color(0xFF334155)),
  };

  Color get solid => colors.$2;

  /// Berilgan rangga eng yaqin ohang (standart — brend rangi).
  static AppTone of(Color color) {
    // Ma'no ranglari aniq moslanadi: "muvaffaqiyat" brend rangiga
    // aylanib qolmasin.
    final semantic = <Color, AppTone>{
      AppColors.primary: AppTone.teal,
      AppColors.success: AppTone.green,
      AppColors.warning: AppTone.amber,
      AppColors.danger: AppTone.red,
      AppColors.accent: AppTone.blue,
      AppColors.accentDark: AppTone.indigo,
    }[color];
    if (semantic != null) return semantic;
    var best = AppTone.teal;
    var distance = double.infinity;
    for (final tone in AppTone.values) {
      final (light, dark) = tone.colors;
      for (final candidate in [light, dark]) {
        final dr = candidate.r - color.r;
        final dg = candidate.g - color.g;
        final db = candidate.b - color.b;
        final d = dr * dr + dg * dg + db * db;
        if (d < distance) {
          distance = d;
          best = tone;
        }
      }
    }
    return best;
  }
}

/// To'yingan gradient fonda oq ikonka.
class AppIconTile extends StatelessWidget {
  const AppIconTile({
    required this.icon,
    this.tone = AppTone.teal,
    this.size = 42,
    super.key,
  });

  final IconData icon;
  final AppTone tone;
  final double size;

  @override
  Widget build(BuildContext context) {
    final (light, dark) = tone.colors;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.32),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [light, dark],
        ),
        boxShadow: [
          BoxShadow(
            color: dark.withValues(alpha: 0.28),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Icon(icon, size: size * 0.52, color: Colors.white),
    );
  }
}
