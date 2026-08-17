import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/auth/presentation/widgets/otp_input.dart';
import 'package:user_app/features/payments/presentation/bloc/pay_cubit.dart';

/// To'lovni yakunlashdan oldingi SMS-tasdiqlash bosqichi — auth
/// oqimidagi `OtpPage`/`OtpInput` bilan bir xil vizual tilni takrorlaydi
/// (qarang: `features/auth/presentation/pages/otp_page.dart`), lekin
/// pastki varaq (bottom sheet) sifatida ko'rsatiladi.
///
/// To'liq MOCK — haqiqiy SMS yuborilmaydi, [demoCode] shunchaki UI ostida
/// namuna sifatida ko'rsatiladi; istalgan 4 xonali kod qabul qilinadi.
class PaymentOtpSheet extends StatefulWidget {
  const PaymentOtpSheet({required this.demoCode, super.key});

  final String demoCode;

  @override
  State<PaymentOtpSheet> createState() => _PaymentOtpSheetState();
}

class _PaymentOtpSheetState extends State<PaymentOtpSheet> {
  String _code = '';

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    // Kod tasdiqlangach ("mock" — `PayCubit.confirmOtp`) natija
    // muvaffaqiyat/xatolikka o'zgarganda varaqni avtomatik yopadi — sahifa
    // darajasidagi `BlocConsumer` (`PayPage`) keyingi qadamni (muvaffaqiyat
    // dialogi yoki xatolik xabari) ko'rsatadi.
    return BlocListener<PayCubit, PayState>(
      listener: (context, state) {
        if (state is PaySuccess || state is PayFailure) {
          final navigator = Navigator.of(context);
          if (navigator.canPop()) navigator.pop();
        }
      },
      child: BlocBuilder<PayCubit, PayState>(
        builder: (context, state) {
          final submitting = state is PaySubmitting;
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: AbsorbPointer(
                  absorbing: submitting,
                  child: OtpInput(
                    onChanged: (v) => setState(() => _code = v),
                    onCompleted: (code) {
                      setState(() => _code = code);
                      context.read<PayCubit>().confirmOtp(code);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(AppIcons.info, size: 14, color: inkMuted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      l10n.smsDemoCodeHint(widget.demoCode),
                      style: AppTextStyles.caption.copyWith(color: inkMuted),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              AppButton(
                label: l10n.confirm,
                icon: AppIcons.tick,
                loading: submitting,
                onPressed: _code.length == 4 && !submitting
                    ? () => context.read<PayCubit>().confirmOtp(_code)
                    : null,
              ),
              const SizedBox(height: 4),
            ],
          );
        },
      ),
    );
  }
}
