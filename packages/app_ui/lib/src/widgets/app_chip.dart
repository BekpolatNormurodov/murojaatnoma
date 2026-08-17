import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

/// Yagona dizaynli chip / status belgisi — rangli tint fon bilan.
class AppChip extends StatelessWidget {
  const AppChip({
    required this.label,
    super.key,
    this.color = AppColors.primary,
    this.icon,
    this.filled = false,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final Color color;
  final IconData? icon;
  final bool filled;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    final bg = selected
        ? color
        : filled
        ? color.withValues(alpha: 0.12)
        : surface;
    final fg = selected
        ? Colors.white
        : color == AppColors.primary && !filled
        ? inkSoft
        : color;
    final borderColor = selected ? color : line;

    final chip = AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      padding: EdgeInsets.symmetric(
        horizontal: icon != null ? 12 : 14,
        vertical: 9,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 15, color: fg),
            const SizedBox(width: 6),
          ],
          // MUHIM: bu yerda `Flexible` bilan O'RALMAYDI — `AppChip` ko'p
          // joyda `Wrap` ichida ishlatiladi (masalan `AppMultiSelect`,
          // biriktirma tanlagichlar) va `Wrap` o'z farzandlariga CHEKSIZ
          // kenglik konstraint beradi; shu kontekstda `Flexible`/`Expanded`
          // "RenderFlex children have non-zero flex but incoming width
          // constraints are unbounded" xatosini keltirib chiqaradi.
          // Cheklangan (bounded) joyda chipni siqishdan himoya qilish
          // uchun chaqiruv joyida (masalan `citizen_request_card.dart`)
          // CHIPNING O'ZINI `Flexible(fit: FlexFit.loose)`ga o'rang.
          Text(
            label,
            style: AppTextStyles.label.copyWith(
              color: fg,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );

    if (onTap == null) return chip;
    return GestureDetector(onTap: onTap, child: chip);
  }
}

/// Kichik status belgisi (badge) — rang bilan kodlangan.
class StatusBadge extends StatelessWidget {
  const StatusBadge({required this.label, required this.color, super.key});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadii.xs),
      ),
      child: Text(
        label,
        style: AppTextStyles.caption.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
