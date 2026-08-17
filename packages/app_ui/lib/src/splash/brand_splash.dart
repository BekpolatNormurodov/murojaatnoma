import 'dart:async';

import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// Brendlangan splash ekrani — ilova ochilganda ko'rsatiladi.
///
/// `AppColors.brandGradient` fon, qalqib turuvchi (pulse) halqali ShieldTick
/// logotip va harf-harf paydo bo'luvchi ilova nomi bilan (web-admin'ning
/// `SplashScreen.tsx`'iga mos). Taxminan 2500ms so'ng [onFinished] chaqiriladi.
///
/// `app_ui` `app_core`'ga (va uning l10n'iga) bog'lanmaydi — shuning uchun
/// [tagline] va [appName] matn sifatida parametr orqali uzatiladi; chaqiruvchi
/// ilova, masalan, `context.l10n.splashTagline`ni beradi.
class BrandSplash extends StatefulWidget {
  const BrandSplash({
    required this.tagline,
    super.key,
    this.appName = 'Hokimiyat',
    this.onFinished,
  });

  /// Logotip ostida ko'rsatiladigan shior.
  final String tagline;

  /// Harf-harf animatsiya bilan chiqadigan ilova nomi.
  final String appName;

  /// Splash tugagach (taxminan 2500ms) chaqiriladi.
  final VoidCallback? onFinished;

  @override
  State<BrandSplash> createState() => _BrandSplashState();
}

class _BrandSplashState extends State<BrandSplash> {
  static const _splashDuration = Duration(milliseconds: 2500);

  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(_splashDuration, () => widget.onFinished?.call());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.brandGradient),
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const _PulsingLogo(),
                  const SizedBox(height: 28),
                  _StaggeredTitle(text: widget.appName),
                  const SizedBox(height: 14),
                  _TaglinePill(text: widget.tagline),
                ],
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 40,
              child: Center(
                child: Text(
                  "© 2026 O'zbekiston Respublikasi",
                  style: AppTextStyles.caption.copyWith(
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                ).animate().fadeIn(delay: 900.ms, duration: 400.ms),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// ShieldTick logotipi — orqasida takrorlanuvchi (pulse) halqa animatsiyasi.
class _PulsingLogo extends StatelessWidget {
  const _PulsingLogo();

  static const _boxSize = 108.0;
  static const _ringSize = 132.0;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _ringSize,
      height: _ringSize,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
                width: _boxSize,
                height: _boxSize,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.28),
                  borderRadius: BorderRadius.circular(AppRadii.xl),
                ),
              )
              .animate(onPlay: (controller) => controller.repeat())
              .scale(
                begin: const Offset(1, 1),
                end: const Offset(1.55, 1.55),
                duration: 1800.ms,
                curve: Curves.easeOut,
              )
              .fadeOut(duration: 1800.ms, curve: Curves.easeOut),
          Container(
                width: _boxSize,
                height: _boxSize,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadii.xl),
                  boxShadow: const [
                    BoxShadow(
                      color: Color.fromRGBO(0, 0, 0, 0.25),
                      blurRadius: 40,
                      offset: Offset(0, 20),
                    ),
                  ],
                ),
                child: const Icon(
                  IconsaxPlusBold.shield_tick,
                  size: 54,
                  color: AppColors.primaryDark,
                ),
              )
              .animate()
              .scale(
                begin: const Offset(0.5, 0.5),
                end: const Offset(1, 1),
                duration: 550.ms,
                curve: Curves.easeOutBack,
              )
              .fadeIn(duration: 300.ms),
        ],
      ),
    );
  }
}

/// [text]ni harf-harf, ketma-ket kechikish (stagger) bilan chizadi.
class _StaggeredTitle extends StatelessWidget {
  const _StaggeredTitle({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final letters = text.split('');
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < letters.length; i++)
          Text(
                letters[i],
                style: AppTextStyles.h1.copyWith(
                  color: Colors.white,
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                ),
              )
              .animate(delay: (450 + i * 45).ms)
              .fadeIn(duration: 380.ms)
              .slideY(begin: 0.4, end: 0, curve: Curves.easeOutCubic),
      ],
    );
  }
}

/// Logotip ostidagi shior — yumaloq "pill" konteynerda.
class _TaglinePill extends StatelessWidget {
  const _TaglinePill({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
          ),
          child: Text(
            text,
            style: AppTextStyles.caption.copyWith(
              color: Colors.white.withValues(alpha: 0.9),
              fontWeight: FontWeight.w600,
            ),
          ),
        )
        .animate()
        .fadeIn(delay: 950.ms, duration: 400.ms)
        .slideY(begin: 0.3, end: 0, curve: Curves.easeOutCubic);
  }
}
