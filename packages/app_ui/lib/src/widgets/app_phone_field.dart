import 'package:app_ui/src/constants/app_icons.dart';
import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:app_ui/src/utils/input_formatters.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// O'zbekiston telefon raqami uchun premium, YAGONA (bitta) dizaynli kirish
/// maydoni: bitta yaxlit ramka ichida `[📞]  +998 │ 95 064 28 27`.
///
/// Uch qism endi UCH alohida quti emas — bitta silliq, e'tibor (focus) olganda
/// chegara rangi jonlanadigan konteynerda: chapda brend ikonkasi, o'zgarmas
/// `+998` yorlig'i, ingichka ajratgich, so'ng FAQAT mahalliy 9 xonani
/// (`PhoneUzInputFormatter` orqali `XX XXX XX XX` guruhlarida) qabul qiluvchi
/// chegarasiz matn maydoni.
///
/// [controller]dagi matn doim FAQAT mahalliy raqam (bo'sh joylar bilan
/// guruhlangan, masalan `95 064 28 27`) — `+998` hech qachon matn ichiga
/// yozilmaydi. To'liq raqamni yig'ish uchun `'+998 ${controller.text}'` kifoya.
///
/// `worker_app`/`user_app`dagi `PhoneInputPage`larda ishlatiladi — ikkala
/// ilova o'rtasida bitta manba, bitta ko'rinish.
class AppPhoneField extends StatefulWidget {
  const AppPhoneField({
    required this.controller,
    super.key,
    this.onChanged,
    this.focusNode,
    this.autofocus = false,
    this.textInputAction,
    this.onSubmitted,
    this.countryCode = '+998',
    this.hint = '95 064 28 27',
    this.errorText,
  });

  /// Mahalliy 9 xonani (guruhlangan matn shaklida) ushlab turuvchi
  /// kontroller.
  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  final FocusNode? focusNode;
  final bool autofocus;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;

  /// Chapda ko'rsatiladigan, o'zgarmas davlat kodi.
  final String countryCode;

  /// Bo'sh maydonda ko'rsatiladigan namuna matn (faqat mahalliy qism).
  final String hint;

  final String? errorText;

  @override
  State<AppPhoneField> createState() => _AppPhoneFieldState();
}

class _AppPhoneFieldState extends State<AppPhoneField> {
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
  void didUpdateWidget(AppPhoneField oldWidget) {
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
    if (hasFocus != _focused) setState(() => _focused = hasFocus);
  }

  @override
  void dispose() {
    _effectiveFocusNode.removeListener(_handleFocusChange);
    _internalFocusNode?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    final hasError =
        widget.errorText != null && widget.errorText!.isNotEmpty;
    final borderColor = hasError
        ? AppColors.danger
        : _focused
        ? AppColors.primary
        : line;
    final borderWidth = (hasError || _focused) ? 1.5 : 1.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: _effectiveFocusNode.requestFocus,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: Border.all(color: borderColor, width: borderWidth),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Row(
              children: [
                Icon(
                  AppIcons.call,
                  size: 20,
                  color: _focused ? AppColors.primary : inkMuted,
                ),
                const SizedBox(width: 10),
                Text(
                  widget.countryCode,
                  style: AppTextStyles.bodyStrong.copyWith(color: ink),
                ),
                const SizedBox(width: 10),
                Container(width: 1, height: 24, color: line),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: widget.controller,
                    focusNode: _effectiveFocusNode,
                    autofocus: widget.autofocus,
                    keyboardType: TextInputType.phone,
                    textInputAction: widget.textInputAction,
                    onSubmitted: widget.onSubmitted,
                    onChanged: widget.onChanged,
                    cursorColor: AppColors.primary,
                    // `PhoneUzInputFormatter` 9 xonadan keyin o'zi kesadi.
                    inputFormatters: const [PhoneUzInputFormatter()],
                    style: AppTextStyles.bodyStrong.copyWith(
                      color: ink,
                      letterSpacing: 0.5,
                    ),
                    decoration: InputDecoration(
                      isCollapsed: true,
                      contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      hintText: widget.hint,
                      hintStyle: AppTextStyles.body.copyWith(color: inkMuted),
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                    ),
                  ),
                ),
              ],
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
        ],
      ],
    );
  }
}
