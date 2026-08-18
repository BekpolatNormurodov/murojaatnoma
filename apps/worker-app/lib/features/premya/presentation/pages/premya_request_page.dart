import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/premya/domain/usecases/submit_premya.dart';
import 'package:worker_app/injection.dart';

/// "Premya so'rash" — xodim ishlagan mehnatiga (masalan reja bajarilgani
/// uchun) mukofot so'raydigan TO'LIQ EKRANLI sahifa.
///
/// `PremyaRepository.submit` HAQIQIY implementatsiyaga ega (Mock/Api seam —
/// `AppConfig.useMock` tanlaydi) — shuning uchun yuborish tugmasi HAQIQIY
/// `SubmitPremya` usecase'ini chaqiradi (stub/simulyatsiya EMAS).
///
/// Alohida Cubit shart emas — bitta martalik amal (`LeaveRequestPage` bilan
/// bir xil naqsh): usecase to'g'ridan-to'g'ri `getIt` orqali chaqiriladi.
class PremyaRequestPage extends StatefulWidget {
  const PremyaRequestPage({super.key});

  @override
  State<PremyaRequestPage> createState() => _PremyaRequestPageState();
}

class _PremyaRequestPageState extends State<PremyaRequestPage> {
  final _amountController = TextEditingController();
  final _reasonController = TextEditingController();

  String? _reasonError;
  var _submitting = false;

  @override
  void dispose() {
    _amountController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reasonText = _reasonController.text.trim();
    final valid = reasonText.isNotEmpty;
    setState(
      () => _reasonError = valid ? null : 'Sababni kiritish shart',
    );
    if (!valid) return;

    final amountText = _amountController.text.trim();
    final amount = amountText.isEmpty ? null : int.tryParse(amountText);

    setState(() => _submitting = true);
    final result = await getIt<SubmitPremya>()(
      SubmitPremyaParams(reason: reasonText, amount: amount),
    );
    if (!mounted) return;
    setState(() => _submitting = false);

    result.fold(
      (failure) => AppAlert.error(context, failure.message),
      (_) async {
        final l10n = context.l10n;
        await AppDialog.success(
          context: context,
          title: "So'rov yuborildi",
          message: "Premya so'rovingiz rahbariyatga yuborildi.",
          buttonLabel: l10n.closeLabel,
        );
        if (mounted) context.pop();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text("Premya so'rash", style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            const _SectionTitle("Mukofot summasi (so'mda)"),
            const SizedBox(height: 8),
            AppTextField(
              hint: 'Ixtiyoriy — masalan 500000',
              controller: _amountController,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            ),
            const SizedBox(height: 20),
            const _SectionTitle('Sabab'),
            const SizedBox(height: 8),
            AppTextField(
              hint:
                  "Nima uchun premya so'rayapsiz? Masalan: oylik reja "
                  "ortig'i bilan bajarildi",
              controller: _reasonController,
              maxLines: 5,
              errorText: _reasonError,
              onChanged: (_) {
                if (_reasonError != null) {
                  setState(() => _reasonError = null);
                }
              },
            ),
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(AppIcons.info, size: 16, color: mutedColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    "So'rovingiz rahbariyat tomonidan ko'rib chiqiladi va "
                    'natija haqida xabar olasiz.',
                    style: AppTextStyles.caption.copyWith(color: mutedColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),
            AppButton(
              label: 'Yuborish',
              icon: AppIcons.send,
              loading: _submitting,
              onPressed: _submitting ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}

/// Bo'lim sarlavhasi — `LeaveRequestPage._SectionTitle` bilan bir xil
/// naqsh.
class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      label,
      style: AppTextStyles.label.copyWith(
        color: isDark ? AppColors.darkInkSoft : AppColors.inkSoft,
      ),
    );
  }
}
