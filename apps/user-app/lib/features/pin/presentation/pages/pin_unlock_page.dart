import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/pin/presentation/bloc/pin_cubit.dart';

/// Ilova-qulf ekrani (`/pin/unlock`) — sessiya tiklangan (auto-login,
/// qurilma sovuq ishga tushirilgan) HAR safar ko'rsatiladi. `pinUnlocked`
/// SESSIYA-ICHI (in-memory, `AuthState`) bayroq — doim `false`dan
/// boshlanadi, faqat to'g'ri PIN kiritilgach `true`ga o'tadi (qarang:
/// `redirect_policy.dart`, `AuthCubit.markPinUnlocked`).
class PinUnlockPage extends StatefulWidget {
  const PinUnlockPage({super.key});

  @override
  State<PinUnlockPage> createState() => _PinUnlockPageState();
}

class _PinUnlockPageState extends State<PinUnlockPage> {
  final _pinKey = GlobalKey<AppPinInputState>();

  /// Qulf ochilgach bosh sahifaga o'tkazadi.
  ///
  /// `PinSetPage._proceedToHome` bilan bir xil sabab: redirect siyosati
  /// `pinUnlocked=true` bo'lgandan keyin ham `/pin/unlock`dan MAJBURAN
  /// olib chiqmaydi (faqat `/login`/`/otp` bosh sahifaga qaytariladi) —
  /// shuning uchun aniq `context.go('/home')` SHART.
  Future<void> _proceedToHome(BuildContext context) async {
    context.read<AuthCubit>().markPinUnlocked();
    await Future<void>.delayed(const Duration(milliseconds: 250));
    if (!context.mounted) return;
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocConsumer<PinCubit, PinState>(
        listener: (context, state) {
          switch (state) {
            case PinVerifyError():
            case PinStorageError():
            case PinLockedOut():
              _pinKey.currentState?.shakeAndClear();
            case PinVerifySuccess():
              unawaited(_proceedToHome(context));
            case PinInitial():
            case PinVerifying():
            case PinAwaitingConfirmation():
            case PinMismatch():
            case PinSaving():
            case PinSetSuccess():
              break;
          }
        },
        builder: (context, state) {
          final l10n = context.l10n;
          final isDark = Theme.of(context).brightness == Brightness.dark;
          final inkMuted = isDark
              ? AppColors.darkInkMuted
              : AppColors.inkMuted;
          final errorText = switch (state) {
            PinVerifyError() => l10n.pinWrongError,
            PinStorageError() => l10n.pinStorageErrorMessage,
            PinLockedOut() => l10n.pinLockedOutMessage,
            _ => null,
          };

          return SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 16,
                  ),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight - 32,
                    ),
                    child: IntrinsicHeight(
                      child: Column(
                        children: [
                          const SizedBox(height: 24),
                          const _HeaderIcon(icon: AppIcons.lock),
                          const SizedBox(height: 24),
                          Text(
                            l10n.pinUnlockTitle,
                            style: AppTextStyles.h2,
                            textAlign: TextAlign.center,
                          ).animate().fadeIn(),
                          const SizedBox(height: 8),
                          Text(
                            l10n.pinUnlockSubtitle,
                            style: AppTextStyles.body.copyWith(
                              color: inkMuted,
                            ),
                            textAlign: TextAlign.center,
                          ).animate(delay: 80.ms).fadeIn(),
                          const Spacer(),
                          AppPinInput(
                            key: _pinKey,
                            errorText: errorText,
                            onCompleted: (pin) =>
                                context.read<PinCubit>().verifyPin(pin),
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
