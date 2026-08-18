import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';

/// Xodim login+parol bilan kirish sahifasi.
///
/// Fuqarolar (user-app) faqat SMS/OTP orqali kiradi; xodimlar (worker-app)
/// login+parol orqali kiradi (`POST /auth/employee/login`). Muvaffaqiyatli
/// kirishdan keyin navigatsiyani `resolveAuthRedirect` (GoRouter `redirect`)
/// avtomatik boshqaradi — bu sahifa hech qayerga qo'lda `push` qilmaydi.
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();

  bool _obscure = true;
  bool _submitted = false;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  bool get _usernameValid => _username.text.trim().isNotEmpty;
  bool get _passwordValid => _password.text.isNotEmpty;

  void _submit() {
    setState(() => _submitted = true);
    if (!_usernameValid || !_passwordValid) return;
    FocusScope.of(context).unfocus();
    context.read<AuthCubit>().login(_username.text.trim(), _password.text);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      body: BlocConsumer<AuthCubit, AuthState>(
        listenWhen: (prev, curr) => prev.status != curr.status,
        listener: (context, state) {
          // Muvaffaqiyatli kirishda navigatsiya `resolveAuthRedirect` orqali
          // avtomatik bo'ladi (splash→face/home) — bu yerda faqat xatoni
          // ko'rsatamiz (forma tagida, quyida `builder`da ham).
          if (state.status == AuthStatus.error) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(
                  content: Text(state.errorMessage ?? l10n.errorGeneric),
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
                  // Brand header — gradient mavzudan qat'i nazar bir xil,
                  // ustidagi oq matn/ikon ATAYLAB `isDark`ga bog'liq emas.
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
                            AppIcons.shield,
                            color: AppColors.surface,
                            size: 34,
                          ),
                        ).animate().scale(
                          duration: 400.ms,
                          curve: Curves.easeOutBack,
                        ),
                        const SizedBox(height: 22),
                        Text(
                          l10n.welcomeGreeting,
                          style: AppTextStyles.body.copyWith(
                            color: AppColors.surface.withValues(alpha: 0.7),
                          ),
                        ).animate(delay: 150.ms).fadeIn(),
                        const SizedBox(height: 4),
                        Text(
                              l10n.workerAppName,
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
                          l10n.login,
                          style: AppTextStyles.h2,
                        ).animate(delay: 300.ms).fadeIn(),
                        const SizedBox(height: 6),
                        Text(
                          l10n.loginSubtitle,
                          style: AppTextStyles.caption,
                        ).animate(delay: 340.ms).fadeIn(),
                        const SizedBox(height: 28),
                        AppTextField(
                              label: l10n.usernameLabel,
                              hint: l10n.usernameHint,
                              icon: AppIcons.profile,
                              controller: _username,
                              autofocus: true,
                              textInputAction: TextInputAction.next,
                              inputFormatters: [
                                FilteringTextInputFormatter.deny(
                                  RegExp(r'\s'),
                                ),
                              ],
                              errorText: _submitted && !_usernameValid
                                  ? l10n.fieldRequired
                                  : null,
                              onChanged: (_) {
                                if (_submitted) setState(() {});
                              },
                              onSubmitted: (_) => _passwordFocus.requestFocus(),
                            )
                            .animate(delay: 400.ms)
                            .fadeIn()
                            .slideY(begin: 0.15, end: 0),
                        const SizedBox(height: 18),
                        AppTextField(
                              label: l10n.passwordLabel,
                              hint: l10n.passwordHint,
                              icon: AppIcons.lock,
                              controller: _password,
                              focusNode: _passwordFocus,
                              obscureText: _obscure,
                              textInputAction: TextInputAction.done,
                              errorText: _submitted && !_passwordValid
                                  ? l10n.fieldRequired
                                  : null,
                              onChanged: (_) {
                                if (_submitted) setState(() {});
                              },
                              onSubmitted: (_) => _submit(),
                              suffix: IconButton(
                                icon: Icon(
                                  _obscure
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  size: 20,
                                  color: isDark
                                      ? AppColors.darkInkMuted
                                      : AppColors.inkMuted,
                                ),
                                tooltip: l10n.passwordLabel,
                                onPressed: () =>
                                    setState(() => _obscure = !_obscure),
                              ),
                            )
                            .animate(delay: 460.ms)
                            .fadeIn()
                            .slideY(begin: 0.15, end: 0),
                        const SizedBox(height: 28),
                        AppButton(
                              label: l10n.login,
                              icon: AppIcons.arrowRight,
                              loading: loading,
                              onPressed: loading ? null : _submit,
                            )
                            .animate(delay: 520.ms)
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
                                l10n.helpLine,
                                style: AppTextStyles.caption,
                              ),
                            ],
                          ),
                        ).animate(delay: 560.ms).fadeIn(),
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
