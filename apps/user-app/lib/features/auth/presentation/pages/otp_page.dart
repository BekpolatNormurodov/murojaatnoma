import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/auth/presentation/widgets/otp_input.dart';

/// SMS orqali yuborilgan tasdiqlash kodini kiritish sahifasi.
class OtpPage extends StatefulWidget {
  const OtpPage({required this.phone, super.key});

  /// `PhoneInputPage`dan kod yuborilgan telefon raqami.
  final String phone;

  @override
  State<OtpPage> createState() => _OtpPageState();
}

class _OtpPageState extends State<OtpPage> {
  /// Qayta yuborishlar orasidagi eng kam kutish vaqti (soniya) — SMS
  /// spamini oldini olish va foydalanuvchiga aniq kutish muddatini
  /// ko'rsatish uchun.
  static const _resendCooldownSeconds = 30;

  final _otpKey = GlobalKey<OtpInputState>();
  String _code = '';
  Timer? _resendTimer;
  int _secondsLeft = _resendCooldownSeconds;

  @override
  void initState() {
    super.initState();
    // `PhoneInputPage` bu sahifaga o'tishdan OLDIN kodni allaqachon
    // yuborgan — shuning uchun sovutish taymeri darhol, sahifa ochilishi
    // bilan boshlanadi.
    _startResendCooldown();
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    super.dispose();
  }

  void _startResendCooldown() {
    _resendTimer?.cancel();
    setState(() => _secondsLeft = _resendCooldownSeconds);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft <= 1) {
        timer.cancel();
        setState(() => _secondsLeft = 0);
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  void _handleResend(BuildContext context) {
    _otpKey.currentState?.clear();
    setState(() => _code = '');
    context.read<AuthCubit>().requestOtp(widget.phone);
    _startResendCooldown();
  }

  /// "Qayta yuborish" tugmasi matni — sovutish davom etayotganda qolgan
  /// vaqtni (`0:ss`) qavs ichida ko'rsatadi.
  String _resendLabel(AppLocalizations l10n) {
    if (_secondsLeft <= 0) return l10n.resendCode;
    final seconds = _secondsLeft.toString().padLeft(2, '0');
    return '${l10n.resendCode} (0:$seconds)';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton()),
      body: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state.status == AuthStatus.authenticated) {
            context.go('/home');
          } else if (state.status == AuthStatus.error) {
            // Noto'g'ri/eskirgan kod — PIN oqimidagi `shakeAndClear` bilan
            // bir xil taassurot: kataklar silkinadi, tozalanadi va
            // foydalanuvchi darhol qayta kirita boshlashi mumkin.
            _otpKey.currentState?.shakeAndClear();
            setState(() => _code = '');
            AppAlert.error(
              context,
              state.errorMessage ?? context.l10n.errorGeneric,
            );
          }
        },
        builder: (context, state) {
          final loading = state.status == AuthStatus.loading;
          final isDark = Theme.of(context).brightness == Brightness.dark;
          // `SafeArea` + scrollable + `ConstrainedBox`/`IntrinsicHeight` so
          // the confirm button never gets pushed off-screen (or the layout
          // never overflows) when the on-screen keyboard is open on short
          // devices — same pattern as `PinSetPage`/`PinUnlockPage`.
          return SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight - 48,
                    ),
                    child: IntrinsicHeight(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 8),
                          Text(
                            context.l10n.enterCode,
                            style: AppTextStyles.h1,
                          ).animate().fadeIn().slideY(begin: 0.2, end: 0),
                          const SizedBox(height: 10),
                          Text(
                            context.l10n.otpSentTo(widget.phone),
                            style: AppTextStyles.body,
                          ).animate(delay: 120.ms).fadeIn(),
                          const SizedBox(height: 40),
                          OtpInput(
                                key: _otpKey,
                                // `OtpInput.length` standart qiymati (6) real
                                // backend (`/auth/request-otp`)ning
                                // `randomInt(100000, 999999)` kod uzunligiga
                                // mos — qarang:
                                // `apps/backend/src/modules/auth/auth.service.ts`.
                                onChanged: (v) => setState(() => _code = v),
                                onCompleted: (code) {
                                  setState(() => _code = code);
                                  context.read<AuthCubit>().verifyOtp(
                                    widget.phone,
                                    code,
                                  );
                                },
                              )
                              .animate(delay: 280.ms)
                              .fadeIn()
                              .slideY(begin: 0.2, end: 0),
                          const SizedBox(height: 28),
                          Center(
                            child: TextButton(
                              onPressed: (loading || _secondsLeft > 0)
                                  ? null
                                  : () => _handleResend(context),
                              child: AnimatedSwitcher(
                                duration: const Duration(milliseconds: 200),
                                child: Text(
                                  _resendLabel(context.l10n),
                                  key: ValueKey(_secondsLeft > 0),
                                  style: AppTextStyles.label.copyWith(
                                    color: isDark
                                        ? AppColors.darkInkMuted
                                        : AppColors.inkMuted,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const Spacer(),
                          AppButton(
                            label: context.l10n.confirm,
                            icon: AppIcons.tick,
                            loading: loading,
                            onPressed: _code.length == 6
                                ? () => context.read<AuthCubit>().verifyOtp(
                                    widget.phone,
                                    _code,
                                  )
                                : null,
                          ),
                          const SizedBox(height: 16),
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
