import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Ilova matn uslublari — Inter shrift oilasi (`google_fonts` orqali).
class AppTextStyles {
  AppTextStyles._();

  /// Shrift oilasi nomi ('Inter').
  static String get fontFamily => GoogleFonts.inter().fontFamily!;

  static TextStyle get h1 =>
      GoogleFonts.inter(fontSize: 28, fontWeight: FontWeight.w800);

  static TextStyle get h2 =>
      GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700);

  static TextStyle get h3 =>
      GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600);

  static TextStyle get body =>
      GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w400);

  static TextStyle get bodyStrong =>
      GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600);

  static TextStyle get caption =>
      GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w400);

  static TextStyle get label =>
      GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600);

  static TextStyle get button =>
      GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600);
}
