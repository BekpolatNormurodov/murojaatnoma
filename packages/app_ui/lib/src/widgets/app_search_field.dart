import 'dart:async';

import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// Yagona dizaynli qidiruv maydoni — chapda lupa, o'ngda (matn bo'lsa)
/// tozalash tugmasi bilan.
///
/// [onChanged] darhol emas, [debounce] muddatida (standart 300ms) so'nggi
/// qiymat bilan chaqiriladi — har harf uchun ortiqcha so'rov yubormaslik
/// uchun.
class AppSearchField extends StatefulWidget {
  const AppSearchField({
    super.key,
    this.controller,
    this.hint = 'Qidirish',
    this.onChanged,
    this.onSubmitted,
    this.debounce = const Duration(milliseconds: 300),
    this.autofocus = false,
    this.enabled = true,
  });

  /// Matn boshqaruvchisi (berilmasa ichkarida yaratiladi va o'zi tozalanadi).
  final TextEditingController? controller;
  final String hint;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  /// [onChanged] chaqirilishidan oldingi kutish muddati.
  final Duration debounce;
  final bool autofocus;
  final bool enabled;

  @override
  State<AppSearchField> createState() => _AppSearchFieldState();
}

class _AppSearchFieldState extends State<AppSearchField> {
  late final TextEditingController _controller =
      widget.controller ?? TextEditingController();
  Timer? _debounceTimer;
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _hasText = _controller.text.isNotEmpty;
    _controller.addListener(_handleTextChange);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _controller.removeListener(_handleTextChange);
    if (widget.controller == null) {
      _controller.dispose();
    }
    super.dispose();
  }

  void _handleTextChange() {
    final hasText = _controller.text.isNotEmpty;
    if (hasText != _hasText) {
      setState(() => _hasText = hasText);
    }
  }

  void _onChanged(String value) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(
      widget.debounce,
      () => widget.onChanged?.call(value),
    );
  }

  void _clear() {
    _debounceTimer?.cancel();
    _controller.clear();
    widget.onChanged?.call('');
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    return TextField(
      controller: _controller,
      enabled: widget.enabled,
      autofocus: widget.autofocus,
      onChanged: _onChanged,
      onSubmitted: widget.onSubmitted,
      textInputAction: TextInputAction.search,
      style: AppTextStyles.bodyStrong,
      decoration: InputDecoration(
        hintText: widget.hint,
        filled: true,
        fillColor: surfaceAlt,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
        prefixIcon: Icon(
          IconsaxPlusLinear.search_normal_1,
          size: 20,
          color: inkMuted,
        ),
        suffixIcon: AnimatedSwitcher(
          duration: const Duration(milliseconds: 150),
          transitionBuilder: (child, animation) =>
              FadeTransition(opacity: animation, child: child),
          child: _hasText
              ? GestureDetector(
                  key: const ValueKey('clear'),
                  onTap: _clear,
                  child: Padding(
                    padding: const EdgeInsets.all(13),
                    child: Icon(
                      IconsaxPlusLinear.close_circle,
                      size: 18,
                      color: inkMuted,
                    ),
                  ),
                )
              : const SizedBox.shrink(key: ValueKey('empty')),
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
      ),
    );
  }
}
