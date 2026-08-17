import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/auth/presentation/widgets/otp_input.dart';

/// SMS orqali yuborilgan tasdiqlash kodini kiritish sahifasi.
class OtpPage extends StatefulWidget {
  const OtpPage({required this.phone, super.key});

  /// `PhoneInputPage`dan kod yuborilgan telefon raqami.
  final String phone;

  @override
  State<OtpPage> createState() => _OtpPageState();
}

class _OtpPageState extends State<OtpPage> {
  String _code = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton()),
      body: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
          // `authenticated` uchun bu yerda QO'LDA navigatsiya YO'Q (Vazifa
          // 18dan oldin `context.go('/home')` bor edi): `AppRouter`ning
          // `refreshListenable`i `AuthCubit.stream`ga obuna bo'lgan —
          // shu `emit` avtomatik ravishda joriy manzil uchun
          // `resolveAuthRedirect`ni qayta ishga tushiradi va foydalanuvchini
          // haqiqiy holatga qarab (`faceEnrolled`ga bog'liq) `/face/enroll`
          // yoki `/home`ga to'g'ri yo'naltiradi. Bu yerda `/home`ga
          // qo'lda o'tish keraksiz bosqich (va faceEnrolled=false bo'lsa,
          // darhol `/face/enroll`ga qaytarilib, ortiqcha miltillashga
          // olib kelar edi).
          if (state.status == AuthStatus.error) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.errorMessage ?? context.l10n.errorGeneric),
                backgroundColor: AppColors.danger,
              ),
            );
          }
        },
        builder: (context, state) {
          final loading = state.status == AuthStatus.loading;
          final isDark = Theme.of(context).brightness == Brightness.dark;
          final l10n = context.l10n;
          // `otpSentTo`ning `{phone}` o'rnini so'z tartibi lokaldan-lokalga
          // farq qilishi mumkin bo'lgani uchun ANIQ formatlangan matn ichida
          // qidirib topamiz — shu orqali faqat telefon raqami qalin
          // (bold) qilib ko'rsatiladi, har qanday tilda to'g'ri ishlaydi.
          final otpSentText = l10n.otpSentTo(widget.phone);
          final otpSentIndex = otpSentText.indexOf(widget.phone);
          final otpSentSpans = otpSentIndex < 0
              ? [TextSpan(text: otpSentText)]
              : [
                  TextSpan(text: otpSentText.substring(0, otpSentIndex)),
                  TextSpan(text: widget.phone, style: AppTextStyles.bodyStrong),
                  TextSpan(
                    text: otpSentText.substring(
                      otpSentIndex + widget.phone.length,
                    ),
                  ),
                ];
          // `SafeArea` + scrollable + `ConstrainedBox`/`IntrinsicHeight` so
          // the confirm button never gets pushed off-screen (or the layout
          // never overflows) when the on-screen keyboard is open on short
          // devices — same pattern as `PinSetPage`/`PinUnlockPage` and the
          // user-app `OtpPage`.
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
                            l10n.enterCode,
                            style: AppTextStyles.h1,
                          ).animate().fadeIn().slideY(begin: 0.2, end: 0),
                          const SizedBox(height: 10),
                          RichText(
                            // MUHIM: `RichText` (`Text`dan farqli) mavzu matn
                            // rangini meros OLMAYDI — rang berilmasa matn oq
                            // chiqib, light mavzuda ko'rinmay qoladi. Shu bois
                            // aniq mavzu-mos rang beriladi.
                            text: TextSpan(
                              style: AppTextStyles.body.copyWith(
                                color: isDark
                                    ? AppColors.darkInk
                                    : AppColors.ink,
                              ),
                              children: otpSentSpans,
                            ),
                          ).animate(delay: 120.ms).fadeIn(),
                          const SizedBox(height: 40),
                          OtpInput(
                            onChanged: (v) => setState(() => _code = v),
                            onCompleted: (code) {
                              setState(() => _code = code);
                              context.read<AuthCubit>().verifyOtp(
                                widget.phone,
                                code,
                              );
                            },
                          ).animate(delay: 280.ms).fadeIn().slideY(
                            begin: 0.2,
                            end: 0,
                          ),
                          const SizedBox(height: 28),
                          Center(
                            child: TextButton(
                              onPressed: () {},
                              child: Text(
                                '${l10n.resendCode} (00:59)',
                                style: AppTextStyles.label.copyWith(
                                  color: isDark
                                      ? AppColors.darkInkMuted
                                      : AppColors.inkMuted,
                                ),
                              ),
                            ),
                          ),
                          const Spacer(),
                          AppButton(
                            label: l10n.confirm,
                            icon: AppIcons.tick,
                            loading: loading,
                            onPressed: _code.length == 4
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
