import 'dart:io';
import 'dart:ui' as ui;

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/presentation/widgets/utility_type_meta.dart';

/// Bitta to'lovning "cheki" — premium ko'rinishdagi kvitansiya kartasi +
/// uni rasm sifatida ulashish ("Ulashish" tugmasi).
///
/// Chek [RepaintBoundary] bilan o'ralgan — "Ulashish" bosilganda shu
/// bo'lak `toImage()` orqali PNG'ga aylantiriladi, vaqtinchalik faylga
/// yoziladi va OS ulashish varag'i (`share_plus`) orqali ochiladi. To'liq
/// MOCK oqim — hech qanday real backend/pul harakati yo'q.
class PaymentReceiptPage extends StatefulWidget {
  const PaymentReceiptPage({required this.payment, super.key});

  final Payment payment;

  @override
  State<PaymentReceiptPage> createState() => _PaymentReceiptPageState();
}

class _PaymentReceiptPageState extends State<PaymentReceiptPage> {
  final GlobalKey _receiptKey = GlobalKey();
  bool _sharing = false;

  Future<void> _share() async {
    if (_sharing) return;
    setState(() => _sharing = true);
    try {
      final boundary =
          _receiptKey.currentContext?.findRenderObject()
              as RenderRepaintBoundary?;
      if (boundary == null) {
        throw StateError('Receipt boundary not found');
      }

      final image = await boundary.toImage(pixelRatio: 3);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) {
        throw StateError('Failed to encode receipt image');
      }

      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/chek_${widget.payment.id}.png');
      await file.writeAsBytes(byteData.buffer.asUint8List());

      await Share.shareXFiles([XFile(file.path)]);
    } on Exception {
      if (mounted) {
        AppAlert.error(context, context.l10n.receiptShareError);
      }
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(l10n.receiptPageTitle),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              RepaintBoundary(
                key: _receiptKey,
                child: _ReceiptCard(payment: widget.payment)
                    .animate()
                    .fadeIn(duration: 250.ms)
                    .slideY(begin: 0.05, end: 0),
              ),
              const SizedBox(height: 28),
              AppButton(
                label: l10n.receiptShareButton,
                icon: AppIcons.share,
                loading: _sharing,
                onPressed: _sharing ? null : _share,
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReceiptCard extends StatelessWidget {
  const _ReceiptCard({required this.payment});

  final Payment payment;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final color = UtilityTypeMeta.color(payment.type);
    final paidAt = DateTime.tryParse(payment.paidAt) ?? DateTime.now();
    final time =
        '${paidAt.hour.toString().padLeft(2, '0')}:'
        '${paidAt.minute.toString().padLeft(2, '0')}';
    final (variant, statusLabel) = switch (payment.status) {
      PaymentStatus.success => (
        AppBadgeVariant.success,
        l10n.paymentStatusSuccess,
      ),
      PaymentStatus.failed => (
        AppBadgeVariant.danger,
        l10n.paymentStatusFailed,
      ),
      _ => (AppBadgeVariant.warning, l10n.paymentStatusPending),
    };

    return Container(
      // Chekning o'zi rasmga olinadigan yagona narsa — shuning uchun ORQA
      // FON ATAYLAB shaffof EMAS (bittalik, aniq rangli), aks holda
      // ulashilgan PNG shaffof/qora fon bilan chiqib qolardi.
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        border: Border.all(color: line),
      ),
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(
              UtilityTypeMeta.icon(payment.type),
              color: color,
              size: 30,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            UtilityTypeMeta.label(l10n, payment.type),
            style: AppTextStyles.h3,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          AppBadge(variant: variant, label: statusLabel),
          const SizedBox(height: 20),
          Text(formatSom(payment.amount), style: AppTextStyles.h1),
          const SizedBox(height: 24),
          _DashedDivider(color: line),
          const SizedBox(height: 20),
          _ReceiptRow(
            label: l10n.receiptDateLabel,
            value: '${formatDate(paidAt)}, $time',
          ),
          if (payment.cardLast4 case final last4?) ...[
            const SizedBox(height: 12),
            _ReceiptRow(
              label: l10n.cardNumberLabel,
              value: l10n.paidWithCard(last4),
            ),
          ],
          const SizedBox(height: 12),
          _ReceiptRow(
            label: l10n.receiptTransactionIdLabel,
            value: payment.id,
            valueColor: inkMuted,
          ),
        ],
      ),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTextStyles.caption.copyWith(color: inkMuted)),
        const Spacer(),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: AppTextStyles.bodyStrong.copyWith(color: valueColor ?? ink),
          ),
        ),
      ],
    );
  }
}

class _DashedDivider extends StatelessWidget {
  const _DashedDivider({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const dashWidth = 6.0;
        const dashSpace = 5.0;
        final count = (constraints.maxWidth / (dashWidth + dashSpace)).floor();
        return SizedBox(
          height: 1,
          child: Row(
            children: List.generate(
              count,
              (_) => Container(
                width: dashWidth,
                height: 1,
                margin: const EdgeInsets.only(right: dashSpace),
                color: color,
              ),
            ),
          ),
        );
      },
    );
  }
}
