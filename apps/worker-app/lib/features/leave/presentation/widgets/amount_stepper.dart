import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// "−  [miqdor birlik]  +" ko'rinishidagi son stepper'i — `LeaveRequestPage`
/// dagi soat/kun miqdorini tanlash uchun. [min]/[max] chegarasidan
/// chiqarilmaydi — tugma chegarada avtomatik o'chiriladi (disabled).
class AmountStepper extends StatelessWidget {
  const AmountStepper({
    required this.value,
    required this.unitLabel,
    required this.min,
    required this.max,
    required this.onChanged,
    super.key,
  });

  final int value;
  final String unitLabel;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _StepButton(
          icon: IconsaxPlusLinear.minus,
          onTap: value > min ? () => onChanged(value - 1) : null,
        ),
        Expanded(
          child: Column(
            children: [
              Text('$value', style: AppTextStyles.h1),
              Text(unitLabel, style: AppTextStyles.caption),
            ],
          ),
        ),
        _StepButton(
          icon: AppIcons.add,
          onTap: value < max ? () => onChanged(value + 1) : null,
        ),
      ],
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final enabled = onTap != null;
    final bg = enabled ? AppColors.primary.withValues(alpha: 0.12) : line;
    final iconColor = enabled
        ? AppColors.primary
        : (isDark ? AppColors.darkInkMuted : AppColors.inkMuted);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
        child: Icon(icon, size: 20, color: iconColor),
      ),
    );
  }
}
