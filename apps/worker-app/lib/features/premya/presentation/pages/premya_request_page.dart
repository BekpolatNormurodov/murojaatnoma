import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:dartz/dartz.dart' show Either;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/premya/domain/usecases/submit_premya.dart';
import 'package:worker_app/injection.dart';
import 'package:worker_app/core/utils/error_text.dart';

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

  String? _amountError;

  /// Ixtiyoriy summa: bo'sh — `null`; aks holda musbat butun son
  /// (juda katta son `int.tryParse`da jim yo'qolib ketmasin).
  static const _maxAmount = 1000000000;

  Future<void> _submit() async {
    if (_submitting) return;
    FocusScope.of(context).unfocus();
    final l10n = context.l10n;
    final reasonText = _reasonController.text.trim();
    final valid = reasonText.isNotEmpty;

    final amountText = _amountController.text.trim();
    final amount = amountText.isEmpty ? null : int.tryParse(amountText);
    final amountValid =
        amountText.isEmpty ||
        (amount != null && amount > 0 && amount <= _maxAmount);
    setState(() {
      _reasonError = valid ? null : l10n.premyaReasonRequired;
      _amountError = amountValid
          ? null
          : "Summa 1 dan 1 000 000 000 so'mgacha bo'lishi kerak";
    });
    if (!valid || !amountValid) return;

    setState(() => _submitting = true);
    final Either<Failure, Object?> result;
    try {
      result = await getIt<SubmitPremya>()(
        SubmitPremyaParams(reason: reasonText, amount: amount),
      );
    } on Object catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      AppAlert.error(context, unexpectedError(e));
      return;
    }
    if (!mounted) return;
    setState(() => _submitting = false);

    await result.fold<Future<void>>(
      (failure) async => AppAlert.error(context, failure.message),
      (_) async {
        await AppDialog.success(
          context: context,
          title: l10n.premyaSuccessTitle,
          message: l10n.premyaSuccessMessage,
          buttonLabel: l10n.closeLabel,
        );
        if (mounted) context.pop();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
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
        title: Text(l10n.premyaRequestTileLabel, style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            _SectionTitle(l10n.premyaAmountLabel),
            const SizedBox(height: 8),
            AppTextField(
              hint: l10n.premyaAmountHint,
              controller: _amountController,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              maxLength: 10,
              errorText: _amountError,
              onChanged: (_) {
                if (_amountError != null) {
                  setState(() => _amountError = null);
                }
              },
            ),
            const SizedBox(height: 20),
            _SectionTitle(l10n.premyaReasonLabel),
            const SizedBox(height: 8),
            AppTextField(
              hint: l10n.premyaReasonHint,
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
                    l10n.premyaInfoNote,
                    style: AppTextStyles.caption.copyWith(color: mutedColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),
            AppButton(
              label: l10n.premyaSubmit,
              icon: AppIcons.send,
              loading: _submitting,
              onPressed: _submitting ? null : () => unawaited(_submit()),
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
