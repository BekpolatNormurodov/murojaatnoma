import 'package:flutter/material.dart';

/// Ilova rang palitrasi — web-admin bilan 1:1 brend ranglar (light + dark).
class AppColors {
  AppColors._();

  // Brand (O'zbekiston yashil)
  static const Color primary = Color(0xFF10B981);
  static const Color primaryDark = Color(0xFF059669);
  static const Color primaryDeep = Color(0xFF047857);
  static const Color primaryLight = Color(0xFFD1FAE5);

  // Accent (Hokimiyat ko'k)
  static const Color accent = Color(0xFF3B82F6);
  static const Color accentDark = Color(0xFF2563EB);

  // Semantic
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);
  static const Color info = Color(0xFF3B82F6);

  // Surfaces — light
  static const Color canvas = Color(0xFFF6F8FB);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceAlt = Color(0xFFF9FAFB);
  static const Color line = Color(0xFFEAEEF3);

  // Ink (text) — light
  static const Color ink = Color(0xFF0F172A);
  static const Color inkSoft = Color(0xFF475569);
  static const Color inkMuted = Color(0xFF94A3B8);

  // Surfaces — dark
  static const Color darkCanvas = Color(0xFF0B1220);
  static const Color darkSurface = Color(0xFF141C2B);
  static const Color darkSurfaceAlt = Color(0xFF1B2536);
  static const Color darkLine = Color(0xFF29344A);

  // Ink (text) — dark
  static const Color darkInk = Color(0xFFE6ECF5);
  static const Color darkInkSoft = Color(0xFF9AA8BD);
  static const Color darkInkMuted = Color(0xFF677488);

  // Gradients
  /// 150° brend gradienti (web-admin CSS bilan bir xil) — splash/login fon.
  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment(-0.5, -0.8660254037844387),
    end: Alignment(0.5, 0.8660254037844387),
    colors: [
      Color(0xFF064E3B),
      Color(0xFF047857),
      Color(0xFF059669),
      Color(0xFF0D9488),
    ],
  );

  /// Karta/CTA gradienti.
  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF10B981), Color(0xFF0EA5E9)],
  );

  /// Yumshoq "porlash" (glow) soyasi — brend rangida.
  static const List<BoxShadow> glowShadow = [
    BoxShadow(
      color: Color.fromRGBO(16, 185, 129, 0.25),
      offset: Offset(0, 8),
      blurRadius: 30,
    ),
  ];
}
