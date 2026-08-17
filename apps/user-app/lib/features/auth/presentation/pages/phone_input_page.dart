import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';

/// Telefon raqamini kiritish sahifasi — OTP oqimining birinchi qadami.
class PhoneInputPage extends StatefulWidget {
  const PhoneInputPage({super.key});

  @override
  State<PhoneInputPage> createState() => _PhoneInputPageState();
}

class _PhoneInputPageState extends State<PhoneInputPage> {
  final _phone = TextEditingController();
  bool _valid = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  void _validate() {
    final digits = _phone.text.replaceAll(RegExp(r'\D'), '');
    setState(() => _valid = digits.length == 9);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state.status == AuthStatus.otpSent) {
            context.push('/otp', extra: '+998 ${_phone.text}');
          } else if (state.status == AuthStatus.error) {
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
          return SafeArea(
            top: false,
            child: SingleChildScrollView(
              child: Column(
                children: [
                  // Brand header — brend gradienti mavzudan qat'i nazar doim
                  // bir xil (tungi mavzuda ham), shuning uchun ustidagi oq
                  // matn/ikonlar ATAYLAB `isDark`ga bog'liq emas (worker-app
                  // `PhoneInputPage`i bilan bir xil naqsh).
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(28, 90, 28, 48),
                    decoration: const BoxDecoration(
                      gradient: AppColors.brandGradient,
                      borderRadius: BorderRadius.only(
                        bottomLeft: Radius.circular(40),
                        bottomRight: Radius.circular(40),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 68,
                          height: 68,
                          decoration: BoxDecoration(
                            color: AppColors.surface.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Icon(
                            AppIcons.sms,
                            color: AppColors.surface,
                            size: 34,
                          ),
                        ).animate().scale(
                          duration: 400.ms,
                          curve: Curves.easeOutBack,
                        ),
                        const SizedBox(height: 22),
                        Text(
                          context.l10n.welcomeGreeting,
                          style: AppTextStyles.body.copyWith(
                            color: AppColors.surface.withValues(alpha: 0.7),
                          ),
                        ).animate(delay: 150.ms).fadeIn(),
                        const SizedBox(height: 4),
                        Text(
                              context.l10n.appName,
                              style: AppTextStyles.h1.copyWith(
                                color: AppColors.surface,
                              ),
                            )
                            .animate(delay: 220.ms)
                            .fadeIn()
                            .slideX(begin: -0.1, end: 0),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          context.l10n.phoneNumber,
                          style: AppTextStyles.h2,
                        ).animate(delay: 300.ms).fadeIn(),
                        const SizedBox(height: 6),
                        Text(
                          context.l10n.otpChannelInfo,
                          style: AppTextStyles.caption,
                        ).animate(delay: 340.ms).fadeIn(),
                        const SizedBox(height: 28),
                        AppPhoneField(
                              controller: _phone,
                              autofocus: true,
                              textInputAction: TextInputAction.done,
                              onChanged: (_) => _validate(),
                            )
                            .animate(delay: 400.ms)
                            .fadeIn()
                            .slideY(begin: 0.15, end: 0),
                        const SizedBox(height: 28),
                        AppButton(
                              label: context.l10n.sendCode,
                              icon: AppIcons.arrowRight,
                              loading: loading,
                              onPressed: _valid
                                  ? () {
                                      FocusScope.of(context).unfocus();
                                      context.read<AuthCubit>().requestOtp(
                                        '+998 ${_phone.text}',
                                      );
                                    }
                                  : null,
                            )
                            .animate(delay: 460.ms)
                            .fadeIn()
                            .slideY(begin: 0.3, end: 0),
                        const SizedBox(height: 18),
                        Center(
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                AppIcons.call,
                                size: 16,
                                color: isDark
                                    ? AppColors.darkInkMuted
                                    : AppColors.inkMuted,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                context.l10n.helpLine,
                                style: AppTextStyles.caption,
                              ),
                            ],
                          ),
                        ).animate(delay: 520.ms).fadeIn(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
