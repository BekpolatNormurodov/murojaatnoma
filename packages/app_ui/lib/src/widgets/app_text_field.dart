import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// Yagona dizaynli matn maydoni — icon, label, xato/disabled holatlari
/// bilan.
///
/// E'tibor (focus) olganda chegara rangi jonlanadi (`AppColors.primary`),
/// xatolik bo'lsa esa `AppColors.danger`ga o'tadi — barcha ranglar
/// yorug'lik/tun (brightness-aware) rejimiga moslashadi. Balandligi
/// qattiq belgilanmagan, shuning uchun aylanuvchi (scroll) formalar
/// ichida ham erkin ishlaydi.
class AppTextField extends StatefulWidget {
  const AppTextField({
    super.key,
    this.label,
    this.hint,
    this.icon,
    this.controller,
    this.keyboardType,
    this.obscureText = false,
    this.suffix,
    this.prefixText,
    this.inputFormatters,
    this.onChanged,
    this.errorText,
    this.maxLines = 1,
    this.maxLength,
    this.textInputAction,
    this.onSubmitted,
    this.focusNode,
    this.enabled = true,
    this.autofocus = false,
    this.helperText,
  });

  final String? label;
  final String? hint;
  final IconData? icon;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final bool obscureText;
  final Widget? suffix;
  final String? prefixText;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;
  final String? errorText;
  final int maxLines;
  final int? maxLength;

  /// Klaviatura harakat tugmasi (masalan [TextInputAction.next] yoki
  /// [TextInputAction.done]) — forma maydonlari orasida "Keyingi"/"Tayyor"
  /// oqimini yaratish uchun.
  final TextInputAction? textInputAction;

  /// Klaviatura harakat tugmasi bosilganda (yoki matn topshirilganda)
  /// chaqiriladi.
  final ValueChanged<String>? onSubmitted;

  /// Tashqi e'tibor (focus) boshqaruvchisi — berilmasa ichkarida
  /// yaratiladi va widget tozalanganda o'zi ham tozalanadi.
  final FocusNode? focusNode;

  /// `false` bo'lsa maydon o'chirilgan (disabled) holatda — xiralashgan
  /// va kiritib bo'lmaydigan — ko'rsatiladi.
  final bool enabled;

  /// Ekran ochilishi bilanoq e'tiborni shu maydonga o'tkazadimi.
  final bool autofocus;

  /// Xatolik yo'q bo'lganda maydon ostida ko'rsatiladigan yordamchi matn.
  final String? helperText;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  FocusNode? _internalFocusNode;
  bool _focused = false;

  FocusNode get _effectiveFocusNode =>
      widget.focusNode ?? (_internalFocusNode ??= FocusNode());

  @override
  void initState() {
    super.initState();
    _effectiveFocusNode.addListener(_handleFocusChange);
  }

  @override
  void didUpdateWidget(AppTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.focusNode != widget.focusNode) {
      final oldNode = oldWidget.focusNode ?? _internalFocusNode;
      oldNode?.removeListener(_handleFocusChange);
      if (widget.focusNode != null && _internalFocusNode != null) {
        _internalFocusNode!.dispose();
        _internalFocusNode = null;
      }
      _effectiveFocusNode.addListener(_handleFocusChange);
      _focused = _effectiveFocusNode.hasFocus;
    }
  }

  void _handleFocusChange() {
    final hasFocus = _effectiveFocusNode.hasFocus;
    if (hasFocus != _focused) {
      setState(() => _focused = hasFocus);
    }
  }

  @override
  void dispose() {
    _effectiveFocusNode.removeListener(_handleFocusChange);
    _internalFocusNode?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    final activeColor = hasError ? AppColors.danger : AppColors.primary;
    final labelColor = hasError
        ? AppColors.danger
        : _focused
        ? AppColors.primary
        : inkSoft;
    final radius = BorderRadius.circular(AppRadii.md);

    OutlineInputBorder borderOf(Color color, double width) =>
        OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: color, width: width),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 150),
            style: AppTextStyles.label.copyWith(color: labelColor),
            child: Text(widget.label!),
          ),
          const SizedBox(height: 8),
        ],
        AnimatedOpacity(
          opacity: widget.enabled ? 1 : 0.6,
          duration: const Duration(milliseconds: 150),
          child: TextField(
            controller: widget.controller,
            focusNode: _effectiveFocusNode,
            keyboardType: widget.keyboardType,
            obscureText: widget.obscureText,
            inputFormatters: widget.inputFormatters,
            onChanged: widget.onChanged,
            onSubmitted: widget.onSubmitted,
            textInputAction: widget.textInputAction,
            enabled: widget.enabled,
            autofocus: widget.autofocus,
            maxLines: widget.obscureText ? 1 : widget.maxLines,
            maxLength: widget.maxLength,
            cursorColor: AppColors.primary,
            style: AppTextStyles.bodyStrong.copyWith(
              color: widget.enabled ? ink : inkMuted,
            ),
            decoration: InputDecoration(
              hintText: widget.hint,
              hintStyle: AppTextStyles.body.copyWith(color: inkMuted),
              prefixText: widget.prefixText,
              counterText: '',
              filled: true,
              fillColor: widget.enabled ? surface : surfaceAlt,
              // `isDense`: standart `InputDecorator` `contentPadding`dan
              // tashqari ham o'zining ichki minimal-balandlik/label-joy
              // hisобини qo'shadi — shu qo'shimcha (yashirin) bo'shliqsiz
              // maydon `AppSelect`ning qo'lda chizilgan konteyneri bilan
              // (bir xil 16/14 padding, lekin qo'shimcha "dense"siz)
              // balandlikda TENG bo'ladi. Formada ikkalasi yonma-yon
              // ishlatilganda (masalan `SubmitRequestPage`) bir xil,
              // izchil balandlikda ko'rinishi uchun MUHIM.
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 14,
              ),
              prefixIcon: widget.icon != null
                  ? Icon(
                      widget.icon,
                      size: 20,
                      color: _focused ? AppColors.primary : inkMuted,
                    )
                  : null,
              suffixIcon: widget.suffix,
              border: borderOf(line, 1),
              enabledBorder: borderOf(
                hasError ? AppColors.danger : line,
                hasError ? 1.5 : 1,
              ),
              focusedBorder: borderOf(activeColor, 1.5),
              disabledBorder: borderOf(line.withValues(alpha: 0.5), 1),
              errorBorder: borderOf(AppColors.danger, 1.5),
              focusedErrorBorder: borderOf(AppColors.danger, 1.5),
            ),
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(
                IconsaxPlusLinear.info_circle,
                size: 14,
                color: AppColors.danger,
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  widget.errorText!,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.danger,
                  ),
                ),
              ),
            ],
          ),
        ] else if (widget.helperText != null) ...[
          const SizedBox(height: 6),
          Text(
            widget.helperText!,
            style: AppTextStyles.caption.copyWith(color: inkMuted),
          ),
        ],
      ],
    );
  }
}
