import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/core/mock/mock_payments.dart';
import 'package:user_app/core/notifications/notification_service.dart';
import 'package:user_app/features/home/presentation/bloc/home_cubit.dart';
import 'package:user_app/features/payments/domain/entities/saved_card.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/presentation/bloc/pay_cubit.dart';
import 'package:user_app/features/payments/presentation/bloc/utilities_cubit.dart';
import 'package:user_app/features/payments/presentation/widgets/payment_otp_sheet.dart';
import 'package:user_app/features/payments/presentation/widgets/saved_card_carousel.dart';
import 'package:user_app/features/payments/presentation/widgets/utility_type_meta.dart';
import 'package:user_app/injection.dart';

/// Bitta kommunal xizmat bo'yicha to'lov sahifasi — summa (mingliklarga
/// ajratilgan), saqlangan (mock) kartalardan birini tanlash (yoki yangi
/// karta raqami + amal qilish muddati qo'lda kiritish) va SMS-tasdiqlash
/// bosqichi orqali o'tadi.
class PayPage extends StatefulWidget {
  const PayPage({required this.utility, super.key});

  final Utility utility;

  @override
  State<PayPage> createState() => _PayPageState();
}

class _PayPageState extends State<PayPage> {
  late final TextEditingController _amountController = TextEditingController(
    text: widget.utility.balanceDue > 0
        ? ThousandsAmountFormatter.format(widget.utility.balanceDue)
        : '',
  );
  final _cardController = TextEditingController();
  final _expiryController = TextEditingController();

  /// `null` bo'lsa foydalanuvchi yangi kartani qo'lda kiritmoqda — aks
  /// holda shu saqlangan (mock) kartadan to'lanadi. Boshlang'ich holatda
  /// birinchi saqlangan karta oldindan tanlangan (premium, kam-bosishli
  /// tajriba uchun).
  SavedCard? _selectedCard = mockSavedCards.first;

  @override
  void dispose() {
    _amountController.dispose();
    _cardController.dispose();
    _expiryController.dispose();
    super.dispose();
  }

  double get _amount {
    final digits = _amountController.text.replaceAll(RegExp(r'\D'), '');
    return digits.isEmpty ? 0 : double.parse(digits);
  }

  bool get _isManualCard => _selectedCard == null;

  String get _cardNumberForSubmit =>
      _isManualCard ? _cardController.text : _selectedCard!.fullNumber;

  bool get _cardValid =>
      !_isManualCard ||
      _cardController.text.replaceAll(RegExp(r'\D'), '').length == 16;

  bool get _expiryValid =>
      !_isManualCard ||
      CardExpiryInputFormatter.isValidExpiry(_expiryController.text);

  double? get _selectedBalance => _selectedCard?.balance;

  bool get _insufficientFunds =>
      _selectedBalance != null && _amount > _selectedBalance!;

  bool get _canSubmit =>
      _amount > 0 && _cardValid && _expiryValid && !_insufficientFunds;

  void _selectCard(SavedCard? card) => setState(() => _selectedCard = card);

  void _submit() {
    FocusScope.of(context).unfocus();
    context.read<PayCubit>().startPayment(
      type: widget.utility.type,
      amount: _amount,
      cardNumber: _cardNumberForSubmit,
    );
  }

  /// SMS-tasdiqlash varag'ini ochadi. Foydalanuvchi kod kiritmasdan
  /// yopsa (masalan pastga suring/orqa fon bosilsa), `PayCubit`ni
  /// [PayIdle]ga qaytaradi — aks holda tugma "osilib" qolgan holatda
  /// ko'rinardi.
  Future<void> _openOtpSheet(BuildContext context, String demoCode) async {
    final cubit = context.read<PayCubit>();
    await showAppSheet<void>(
      context: context,
      title: context.l10n.smsConfirmTitle,
      subtitle: context.l10n.smsConfirmMessage,
      child: BlocProvider.value(
        value: cubit,
        child: PaymentOtpSheet(demoCode: demoCode),
      ),
    );
    if (cubit.state is PayAwaitingOtp) {
      cubit.cancelOtp();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(l10n.payPageTitle),
      ),
      body: SafeArea(
        child: BlocConsumer<PayCubit, PayState>(
          listener: (context, state) async {
            if (state is PayAwaitingOtp) {
              await _openOtpSheet(context, state.demoCode);
            } else if (state is PaySuccess) {
              // To'lov muvaffaqiyatli bo'lgach bosh sahifa va kommunalka
              // ro'yxatini (ular lazy-singleton — qarang: injection.dart)
              // to'g'ridan-to'g'ri yangilaymiz, chunki bu sahifa ular bilan
              // bir xil widget subtree'da emas (ildiz navigatorida ochilgan).
              unawaited(getIt<HomeCubit>().load());
              unawaited(getIt<UtilitiesCubit>().load());
              // Haqiqiy (on-device) mahalliy bildirishnoma — to'lov
              // muvaffaqiyatli bo'lganini tasdiqlaydi. `NotificationService`
              // DI'da ro'yxatdan o'tmagan bo'lsa (masalan widget testda)
              // yoki ruxsat rad etilgan bo'lsa `show()` xotirjam hech
              // narsa qilmaydi — bu yerda hech qachon uncaught bo'lmaydi.
              if (getIt.isRegistered<NotificationService>()) {
                unawaited(
                  getIt<NotificationService>().show(
                    title: "To'lov muvaffaqiyatli",
                    body:
                        '${formatSom(state.payment.amount)} miqdorida '
                        "to'lov muvaffaqiyatli amalga oshirildi.",
                  ),
                );
              }
              await AppDialog.success(
                context: context,
                title: l10n.paySuccessTitle,
                message: l10n.paySuccessMessage,
                buttonLabel: l10n.closeLabel,
                onClose: () {
                  if (context.mounted) context.pop();
                },
              );
            } else if (state is PayFailure) {
              AppAlert.error(context, state.message);
            }
          },
          builder: (context, state) {
            final submitting =
                state is PaySubmitting || state is PayAwaitingOtp;
            return SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _UtilitySummary(
                    utility: widget.utility,
                  ).animate().fadeIn(duration: 250.ms),
                  const SizedBox(height: 28),
                  AppTextField(
                    label: l10n.amountLabel,
                    hint: l10n.amountHint,
                    controller: _amountController,
                    keyboardType: TextInputType.number,
                    // 12 xona — 999 999 999 999 so'mgacha (real to'lov
                    // summalari uchun yetarli, tasodifiy cheksiz kiritishni
                    // cheklaydi).
                    inputFormatters: const [
                      ThousandsAmountFormatter(maxDigits: 12),
                    ],
                    suffix: Padding(
                      padding: const EdgeInsets.only(right: 14),
                      child: Text(
                        l10n.amountSuffix,
                        style: AppTextStyles.bodyStrong.copyWith(
                          color: inkMuted,
                        ),
                      ),
                    ),
                    errorText: _insufficientFunds
                        ? l10n.insufficientFundsMessage
                        : null,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    l10n.savedCardsSectionLabel,
                    style: AppTextStyles.label.copyWith(color: inkMuted),
                  ),
                  const SizedBox(height: 12),
                  SavedCardCarousel(
                    cards: mockSavedCards,
                    selected: _selectedCard,
                    onSelect: _selectCard,
                  ),
                  const SizedBox(height: 20),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 220),
                    child: _isManualCard
                        ? _ManualCardFields(
                            key: const ValueKey('manual-card'),
                            cardController: _cardController,
                            expiryController: _expiryController,
                            onChanged: () => setState(() {}),
                          )
                        : _SelectedCardSummary(
                            key: const ValueKey('selected-card'),
                            card: _selectedCard!,
                          ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(AppIcons.info, size: 14, color: inkMuted),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          l10n.cardMockNotice,
                          style: AppTextStyles.caption.copyWith(
                            color: inkMuted,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  AppButton(
                    label: l10n.payConfirmButton,
                    icon: AppIcons.tick,
                    loading: submitting,
                    onPressed: _canSubmit && !submitting ? _submit : null,
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _UtilitySummary extends StatelessWidget {
  const _UtilitySummary({required this.utility});

  final Utility utility;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final color = UtilityTypeMeta.color(utility.type);
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Icon(UtilityTypeMeta.icon(utility.type), color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  utility.provider,
                  style: AppTextStyles.bodyStrong,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '${l10n.accountNumberLabel}: ${utility.accountNumber}',
                  style: AppTextStyles.caption.copyWith(color: inkMuted),
                ),
              ],
            ),
          ),
          if (utility.balanceDue > 0)
            Text(
              formatSom(utility.balanceDue),
              style: AppTextStyles.bodyStrong.copyWith(color: AppColors.danger),
            ),
        ],
      ),
    );
  }
}

/// Yangi karta qo'lda kiritilganda ko'rsatiladigan maydonlar — karta
/// raqami + amal qilish muddati (`MM/YY`).
class _ManualCardFields extends StatelessWidget {
  const _ManualCardFields({
    required this.cardController,
    required this.expiryController,
    required this.onChanged,
    super.key,
  });

  final TextEditingController cardController;
  final TextEditingController expiryController;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppTextField(
          label: l10n.cardNumberLabel,
          hint: l10n.cardNumberHint,
          icon: AppIcons.card,
          controller: cardController,
          keyboardType: TextInputType.number,
          inputFormatters: const [CardNumberInputFormatter()],
          onChanged: (_) => onChanged(),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: 160,
          child: AppTextField(
            label: l10n.cardExpiryLabel,
            hint: l10n.cardExpiryHint,
            icon: AppIcons.calendar,
            controller: expiryController,
            keyboardType: TextInputType.number,
            inputFormatters: const [CardExpiryInputFormatter()],
            onChanged: (_) => onChanged(),
          ),
        ),
      ],
    );
  }
}

/// Saqlangan karta tanlanganda ko'rsatiladigan qisqa xulosa — maskalangan
/// raqam, amal qilish muddati va balans.
class _SelectedCardSummary extends StatelessWidget {
  const _SelectedCardSummary({required this.card, super.key});

  final SavedCard card;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: const Icon(AppIcons.card, color: AppColors.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${card.maskedNumber} • ${card.expiry}',
                  style: AppTextStyles.bodyStrong,
                ),
                const SizedBox(height: 2),
                Text(
                  '${l10n.cardBalanceLabel}: ${formatSom(card.balance)}',
                  style: AppTextStyles.caption.copyWith(color: inkMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
