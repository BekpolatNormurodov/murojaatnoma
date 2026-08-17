import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/pin/presentation/bloc/pin_cubit.dart';

/// PIN kodni birinchi marta o'rnatish sahifasi (`/pin/set`) — Faza 3
/// oqimining uchinchi bosqichi: yuz ro'yxatdan o'tkazilgandan keyin,
/// bosh sahifaga o'tishdan oldin.
///
/// Ikki qadam, BITTA `AppPinInput` widget'i orqali: 1) yangi PIN kiritish,
/// 2) uni tasdiqlash. Qadamlar orasidagi farq to'liq `PinCubit.state`dan
/// olinadi — sahifa o'z holatini saqlamaydi (`PinAwaitingConfirmation`ga
/// qadar har qanday holatda tugagan kiritish "1-qadam" deb qaraladi,
/// qarang: `_handleCompleted`).
class PinSetPage extends StatefulWidget {
  const PinSetPage({super.key});

  @override
  State<PinSetPage> createState() => _PinSetPageState();
}

class _PinSetPageState extends State<PinSetPage> {
  final _pinKey = GlobalKey<AppPinInputState>();

  void _handleCompleted(BuildContext context, String pin) {
    final cubit = context.read<PinCubit>();
    if (cubit.state is PinAwaitingConfirmation) {
      unawaited(cubit.confirmEntry(pin));
    } else {
      cubit.submitFirstEntry(pin);
    }
  }

  /// Muvaffaqiyat animatsiyasi ko'rsatilgach bosh sahifaga o'tkazadi.
  ///
  /// Bu yerda (Faceдан farqli) redirect siyosati `pinSet`/`pinUnlocked`
  /// `true` bo'lgandan keyin ham `/pin/set`dan MAJBURAN olib chiqmaydi
  /// (qarang: `redirect_policy.dart` — faqat `/login`/`/otp` bosh
  /// sahifaga qaytariladi) — shuning uchun aniq `context.go('/home')`
  /// SHART (avtomatik redirect'ga tayanib bo'lmaydi).
  Future<void> _proceedToHome(BuildContext context) async {
    context.read<AuthCubit>().markPinSet();
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!context.mounted) return;
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocConsumer<PinCubit, PinState>(
        listener: (context, state) {
          switch (state) {
            case PinAwaitingConfirmation():
              _pinKey.currentState?.clear();
            case PinMismatch():
              _pinKey.currentState?.shakeAndClear();
            case PinSetSuccess():
              unawaited(_proceedToHome(context));
            case PinStorageError():
              AppAlert.error(context, context.l10n.pinStorageErrorMessage);
            case PinInitial():
            case PinSaving():
            case PinVerifying():
            case PinVerifySuccess():
            case PinVerifyError():
            case PinLockedOut():
              break;
          }
        },
        builder: (context, state) {
          if (state is PinSetSuccess) {
            return const _PinSetSuccessView();
          }
          return _PinEntryBody(
            pinKey: _pinKey,
            confirming: state is PinAwaitingConfirmation,
            busy: state is PinSaving,
            errorText: state is PinMismatch
                ? context.l10n.pinMismatchError
                : null,
            onCompleted: (pin) => _handleCompleted(context, pin),
          );
        },
      ),
    );
  }
}

class _PinEntryBody extends StatelessWidget {
  const _PinEntryBody({
    required this.pinKey,
    required this.confirming,
    required this.busy,
    required this.errorText,
    required this.onCompleted,
  });

  final GlobalKey<AppPinInputState> pinKey;
  final bool confirming;

  /// PIN xeshi xavfsiz xotiraga yozilmoqda (`PinSaving`) — shu payt
  /// klaviatura vaqtincha bloklanadi (qo'sh-yuborishning oldini olish
  /// uchun) va kichik yuklanish indikatori ko'rsatiladi.
  final bool busy;
  final String? errorText;
  final ValueChanged<String> onCompleted;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final title = confirming ? l10n.pinConfirmTitle : l10n.pinSetTitle;
    final subtitle = confirming ? l10n.pinConfirmSubtitle : l10n.pinSetSubtitle;

    return SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: constraints.maxHeight - 32,
              ),
              child: IntrinsicHeight(
                child: Column(
                  children: [
                    const SizedBox(height: 16),
                    const _HeaderIcon(icon: AppIcons.shield),
                    const SizedBox(height: 24),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      child: Text(
                        title,
                        key: ValueKey(title),
                        style: AppTextStyles.h2,
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 8),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      child: Text(
                        subtitle,
                        key: ValueKey(subtitle),
                        style: AppTextStyles.body.copyWith(color: inkMuted),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const Spacer(),
                    // Sobit balandlikdagi joy — `busy` paytida kichik
                    // spinner shu yerda paydo bo'ladi, pastdagi PIN
                    // kataklarini pastga surib qo'ymaydi (layout sakramaydi).
                    SizedBox(
                      height: 24,
                      child: Center(
                        child: AnimatedOpacity(
                          duration: const Duration(milliseconds: 150),
                          opacity: busy ? 1 : 0,
                          child: const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2.2),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    IgnorePointer(
                      // PIN xeshi saqlanayotganda klaviatura bloklanadi —
                      // ikki marta ketma-ket to'liq kiritish (masalan
                      // tasodifiy qo'shimcha bosish) ikkita parallel
                      // `confirmEntry` chaqiruviga olib kelmasligi uchun.
                      ignoring: busy,
                      child: AnimatedOpacity(
                        duration: const Duration(milliseconds: 150),
                        opacity: busy ? 0.5 : 1,
                        child: AppPinInput(
                          key: pinKey,
                          errorText: errorText,
                          onCompleted: onCompleted,
                        ),
                      ),
                    ).animate().fadeIn().slideY(begin: 0.08, end: 0),
                    const Spacer(flex: 2),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: AppColors.primary, size: 32),
        )
        .animate()
        .scale(
          duration: 380.ms,
          curve: Curves.easeOutBack,
          begin: const Offset(0.7, 0.7),
          end: const Offset(1, 1),
        )
        .fadeIn();
  }
}

class _PinSetSuccessView extends StatelessWidget {
  const _PinSetSuccessView();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    AppIcons.tick,
                    color: AppColors.primary,
                    size: 56,
                  ),
                )
                .animate()
                .scale(
                  duration: 420.ms,
                  curve: Curves.easeOutBack,
                  begin: const Offset(0.6, 0.6),
                  end: const Offset(1, 1),
                )
                .fadeIn(),
            const SizedBox(height: 24),
            Text(
              context.l10n.pinSetSuccessTitle,
              style: AppTextStyles.h3,
              textAlign: TextAlign.center,
            ).animate(delay: 150.ms).fadeIn(),
          ],
        ),
      ),
    );
  }
}
