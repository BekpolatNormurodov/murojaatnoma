import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/salary/domain/entities/salary.dart';

/// Butun sonli so'm miqdorini mingliklar oralig'ida bo'sh joy bilan
/// formatlaydi (masalan `5800000` -> `5 800 000`) — lokal sana-belgi
/// ma'lumotlarini yuklashni talab qilmaydigan, har qanday tilda barqaror
/// oddiy guruhlash.
String formatSom(int value) {
  final negative = value < 0;
  final digits = value.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i != 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(digits[i]);
  }
  return negative ? '-$buffer' : buffer.toString();
}

/// Oy raqamini (1..12) o'zbekcha oy nomiga o'giradi; diapazondan tashqarida
/// bo'lsa xom raqamni qaytaradi (himoya sifatida).
String monthNameUz(int month) {
  const names = [
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentabr',
    'Oktabr',
    'Noyabr',
    'Dekabr',
  ];
  return (month >= 1 && month <= 12) ? names[month - 1] : '$month';
}

/// `Salary.paidAt` ISO satrini inson o'qiy oladigan sanaga o'giradi;
/// parslab bo'lmasa `null` qaytaradi.
String? _formatPaidAt(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final parsed = DateTime.tryParse(iso);
  return parsed == null ? null : formatDate(parsed);
}

/// Bitta oylik maosh yozuvi kartasi — oy/yil sarlavhasi, to'langan/
/// to'lanmagan belgisi, sof maosh (yirik, qalin) va asosiy/ustama/ushlab
/// qolish tafsiloti.
class SalaryMonthCard extends StatelessWidget {
  const SalaryMonthCard({required this.salary, super.key});

  final Salary salary;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final paidDate = _formatPaidAt(salary.paidAt);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  '${monthNameUz(salary.month)} ${salary.year}',
                  style: AppTextStyles.bodyStrong,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 10),
              AppBadge(
                label: salary.isPaid ? "To'langan" : "To'lanmagan",
                variant: salary.isPaid
                    ? AppBadgeVariant.success
                    : AppBadgeVariant.neutral,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'Sof maosh',
            style: AppTextStyles.caption.copyWith(color: inkMuted),
          ),
          const SizedBox(height: 2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: Text(
                  formatSom(salary.net),
                  style: AppTextStyles.h2,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(
                  "so'm",
                  style: AppTextStyles.caption.copyWith(color: inkSoft),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Divider(height: 1, color: line),
          const SizedBox(height: 12),
          _AmountRow(
            label: 'Asosiy maosh',
            value: formatSom(salary.amount),
            valueColor: inkSoft,
          ),
          if (salary.bonus > 0) ...[
            const SizedBox(height: 8),
            _AmountRow(
              label: 'Ustama',
              value: '+${formatSom(salary.bonus)}',
              valueColor: AppColors.success,
            ),
          ],
          if (salary.penalty > 0) ...[
            const SizedBox(height: 8),
            _AmountRow(
              label: 'Ushlab qolish',
              value: '−${formatSom(salary.penalty)}',
              valueColor: AppColors.danger,
            ),
          ],
          if (paidDate != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(AppIcons.tick, size: 14, color: AppColors.success),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    "$paidDate — to'landi",
                    style: AppTextStyles.caption.copyWith(color: inkMuted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
          if (salary.note != null && salary.note!.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(AppIcons.info, size: 14, color: inkMuted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    salary.note!.trim(),
                    style: AppTextStyles.caption.copyWith(color: inkMuted),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Maosh tafsilotidagi bitta qator — chapda yorliq (muted), o'ngda qiymat
/// (qalin, rangli).
class _AmountRow extends StatelessWidget {
  const _AmountRow({
    required this.label,
    required this.value,
    required this.valueColor,
  });

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.body.copyWith(color: inkMuted),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 12),
        Text(
          value,
          style: AppTextStyles.bodyStrong.copyWith(color: valueColor),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
