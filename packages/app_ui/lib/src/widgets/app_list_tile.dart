import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// Premium ro'yxat qatori — ikon/avatar (leading), sarlavha, kichik matn,
/// trailing widget yoki chevron, va ixtiyoriy badge bilan.
///
/// Standart holatda shaffof fonda (ro'yxat/kartaga qo'yish uchun); [filled]
/// true qilinsa mustaqil karta ko'rinishida (chegara + fon) chiziladi.
class AppListTile extends StatefulWidget {
  const AppListTile({
    required this.title,
    super.key,
    this.subtitle,
    this.leading,
    this.leadingIcon,
    this.iconColor,
    this.trailing,
    this.showChevron = true,
    this.badge,
    this.onTap,
    this.enabled = true,
    this.filled = false,
    this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    this.titleMaxLines = 1,
  });

  final String title;
  final String? subtitle;

  /// [title] necha qatorgacha to'lib chiqishi mumkinligi (standart — 1,
  /// oldingi qattiq-kodlangan xatti-harakat bilan bir xil). Uzunroq
  /// nomlar (masalan kommunal xizmat yoki provayder nomi) kesib
  /// tashlanmasdan to'liq ko'rinishi kerak bo'lgan ro'yxatlar (masalan
  /// to'lovlar tarixi) uchun `2`ga oshiriladi.
  final int titleMaxLines;

  /// Chapdagi ixtiyoriy widget (masalan AppAvatar). Berilsa [leadingIcon]
  /// e'tiborga olinmaydi.
  final Widget? leading;

  /// Chapda doiraviy-kvadrat fonda ko'rsatiladigan ikon (oddiy holat).
  final IconData? leadingIcon;

  /// [leadingIcon] foni/rangi (standart: [AppColors.primary]).
  final Color? iconColor;

  /// O'ngdagi ixtiyoriy widget — berilsa avtomatik chevron ko'rsatilmaydi.
  final Widget? trailing;

  /// [trailing] berilmagan va [onTap] mavjud bo'lganda o'ng strelka
  /// ko'rsatish-ko'rsatmaslik.
  final bool showChevron;

  /// Sarlavha yonida ko'rsatiladigan ixtiyoriy belgi (masalan AppBadge).
  final Widget? badge;
  final VoidCallback? onTap;
  final bool enabled;

  /// true bo'lsa mustaqil karta ko'rinishida (fon + chegara) chiziladi.
  final bool filled;
  final EdgeInsetsGeometry padding;

  @override
  State<AppListTile> createState() => _AppListTileState();
}

class _AppListTileState extends State<AppListTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadii.md);
    final tappable = widget.enabled && widget.onTap != null;
    final color = widget.iconColor ?? AppColors.primary;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    final leadingWidget =
        widget.leading ??
        (widget.leadingIcon != null
            ? Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(widget.leadingIcon, size: 22, color: color),
              )
            : null);

    var trailingWidget = widget.trailing;
    trailingWidget ??= (tappable && widget.showChevron)
        ? Icon(IconsaxPlusLinear.arrow_right_3, size: 18, color: inkMuted)
        : null;

    final content = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: widget.padding,
      decoration: BoxDecoration(
        color: widget.filled ? surface : Colors.transparent,
        borderRadius: radius,
        border: widget.filled ? Border.all(color: line) : null,
      ),
      child: Opacity(
        opacity: widget.enabled ? 1 : 0.5,
        child: Row(
          // Ikki qatorli (subtitle bor) tile'larda kontent YUQORIDAN
          // tekislanadi — leading ikon/avatar sarlavhaning birinchi qatori
          // bilan bir chiziqda turadi va matn ustun (column) kabi ko'rinadi.
          // Bitta qatorli oddiy tile'lar esa markazda qoladi (shunda kichik
          // ikon matn bilan vertikal muvozanatda bo'ladi).
          crossAxisAlignment: widget.subtitle != null
              ? CrossAxisAlignment.start
              : CrossAxisAlignment.center,
          children: [
            if (leadingWidget != null) ...[
              leadingWidget,
              const SizedBox(width: 14),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          widget.title,
                          style: AppTextStyles.bodyStrong,
                          maxLines: widget.titleMaxLines,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (widget.badge != null) ...[
                        const SizedBox(width: 8),
                        widget.badge!,
                      ],
                    ],
                  ),
                  if (widget.subtitle != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      widget.subtitle!,
                      style: AppTextStyles.caption.copyWith(color: inkSoft),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            if (trailingWidget != null) ...[
              const SizedBox(width: 10),
              // `Flexible` MAJBURIY: `trailingWidget` `Expanded(title/
              // subtitle)`dan keyingi kengligi cheklanmagan birodar
              // (sibling) bo'lsa, keng trailing (masalan uzun matn/tugma)
              // sarlavhani siqib qo'yishi mumkin edi.
              Flexible(child: trailingWidget),
            ],
          ],
        ),
      ),
    );

    if (!tappable) return content;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.selectionClick();
        widget.onTap!();
      },
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1,
        duration: const Duration(milliseconds: 120),
        child: content,
      ),
    );
  }
}
