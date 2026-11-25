import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/core/session/logout_service.dart';
import 'package:user_app/core/widgets/confirm_dialog.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/pin/presentation/bloc/pin_cubit.dart';
import 'package:user_app/injection.dart';

/// Ilova-qulf ekrani (`/pin/unlock`) — sessiya tiklangan (auto-login,
/// qurilma sovuq ishga tushirilgan) HAR safar ko'rsatiladi. `pinUnlocked`
/// SESSIYA-ICHI (in-memory, `AuthState`) bayroq — doim `false`dan
/// boshlanadi, faqat to'g'ri PIN kiritilgach `true`ga o'tadi (qarang:
/// `redirect_policy.dart`, `AuthCubit.markPinUnlocked`).
class PinUnlockPage extends StatefulWidget {
  const PinUnlockPage({this.lockoutDelay = _defaultLockoutDelay, super.key});

  static const _defaultLockoutDelay = Duration(milliseconds: 1800);

  /// Urinishlar tugagach xabar shuncha ko'rinib turadi, so'ng chiqariladi.
  final Duration lockoutDelay;

  @override
  State<PinUnlockPage> createState() => _PinUnlockPageState();
}

class _PinUnlockPageState extends State<PinUnlockPage> {
  final _pinKey = GlobalKey<AppPinInputState>();
  Timer? _lockoutTimer;
  bool _loggingOut = false;

  @override
  void dispose() {
    _lockoutTimer?.cancel();
    super.dispose();
  }

  /// PIN o'chiriladi va to'liq chiqiladi — qayta kirish SMS kod orqali.
  Future<void> _logoutForgettingPin() async {
    if (_loggingOut || !mounted) return;
    // Server javobi kutilayotganda klaviatura va tugma bloklanadi.
    setState(() => _loggingOut = true);
    _lockoutTimer?.cancel();
    await getIt<LogoutService>().logout(
      router: GoRouter.of(context),
      forgetPin: true,
    );
    if (mounted) setState(() => _loggingOut = false);
  }

  Future<void> _confirmForgotPin() async {
    final ru = Localizations.localeOf(context).languageCode == 'ru';
    final confirmed = await showConfirmDialog(
      context: context,
      icon: AppIcons.logout,
      title: ru ? 'Забыли PIN-код?' : 'PIN kodni unutdingizmi?',
      message: ru
          ? 'Вы выйдете из аккаунта. Войдите по SMS-коду и задайте новый PIN.'
          : 'Hisobdan chiqasiz. SMS kod bilan qayta kirib, yangi PIN '
                "o'rnatasiz.",
      confirmLabel: context.l10n.logoutConfirmCta,
      cancelLabel: context.l10n.cancel,
      danger: true,
    );
    if (confirmed) await _logoutForgettingPin();
  }

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
              _pinKey.currentState?.shakeAndClear();
            case PinLockedOut():
              _pinKey.currentState?.shakeAndClear();
              _lockoutTimer ??= Timer(
                widget.lockoutDelay,
                () => unawaited(_logoutForgettingPin()),
              );
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
          final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
          final errorText = switch (state) {
            PinVerifyError() => l10n.pinWrongError,
            PinStorageError() => l10n.pinStorageErrorMessage,
            PinLockedOut() => l10n.pinLockedOutMessage,
            _ => null,
          };
          // Kiritilgan PIN saqlangan xesh bilan solishtirilayotgan qisqa
          // oraliq — klaviatura shu payt bloklanadi (`PinSetPage`dagi
          // `PinSaving` bilan bir xil naqsh) va kichik spinner ko'rsatiladi.
          final busy = state is PinVerifying || _loggingOut;
          final locked = state is PinLockedOut;
          final ru = Localizations.localeOf(context).languageCode == 'ru';

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
                            style: AppTextStyles.body.copyWith(color: inkMuted),
                            textAlign: TextAlign.center,
                          ).animate(delay: 80.ms).fadeIn(),
                          const Spacer(),
                          // Sobit balandlikdagi joy — `busy` paytida kichik
                          // spinner shu yerda paydo bo'ladi, PIN kataklari
                          // pastga surilib qolmaydi (layout sakramaydi).
                          SizedBox(
                            height: 24,
                            child: Center(
                              // Spinner faqat `busy`da daraxtda — ko'rinmas
                              // holda ham aylanib turmasin.
                              child: busy
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.2,
                                      ),
                                    )
                                  : null,
                            ),
                          ),
                          const SizedBox(height: 12),
                          IgnorePointer(
                            // Tekshirish davom etayotganda klaviatura
                            // bloklanadi — ikkita parallel `verifyPin`
                            // chaqiruvining (poyga sharoiti) oldini oladi.
                            ignoring: busy || locked,
                            child: AnimatedOpacity(
                              duration: const Duration(milliseconds: 150),
                              opacity: busy ? 0.5 : 1,
                              child: AppPinInput(
                                key: _pinKey,
                                errorText: errorText,
                                onCompleted: (pin) =>
                                    context.read<PinCubit>().verifyPin(pin),
                              ),
                            ),
                          ).animate().fadeIn().slideY(begin: 0.08, end: 0),
                          const Spacer(flex: 2),
                          TextButton(
                            onPressed: _loggingOut ? null : _confirmForgotPin,
                            child: Text(
                              ru
                                  ? 'Забыли PIN? Выйти'
                                  : 'PIN kodni unutdingizmi? Chiqish',
                              textAlign: TextAlign.center,
                            ),
                          ),
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
