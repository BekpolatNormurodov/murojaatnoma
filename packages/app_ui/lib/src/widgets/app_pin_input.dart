import 'dart:async';
import 'dart:math' as math;

import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// N-xonali PIN kiritish — berkitilgan nuqtalar + ixtiyoriy o'rnatilgan
/// raqamli klaviatura, xato holatida "silkinish" animatsiyasi bilan.
///
/// Fuqarolar ilovasining PIN qulf ekrani shu komponentdan foydalanadi.
/// Xato holatini tashqaridan ko'rsatish uchun [GlobalKey]<[AppPinInputState]>
/// orqali [AppPinInputState.shakeAndClear] chaqiring.
class AppPinInput extends StatefulWidget {
  const AppPinInput({
    super.key,
    this.length = 4,
    this.onCompleted,
    this.onChanged,
    this.showKeypad = true,
    this.errorText,
    this.obscure = true,
  }) : assert(length > 0, "length noldan katta bo'lishi kerak");

  /// PIN uzunligi (standart: 4).
  final int length;

  /// Barcha xonalar to'ldirilganda chaqiriladi.
  final ValueChanged<String>? onCompleted;

  /// Har bir raqam kiritilishi/o'chirilishida joriy qiymat bilan chaqiriladi.
  final ValueChanged<String>? onChanged;

  /// true bo'lsa o'rnatilgan raqamli klaviatura ham chiziladi.
  final bool showKeypad;
  final String? errorText;

  /// false bo'lsa nuqtalar o'rniga haqiqiy raqamlar ko'rsatiladi.
  final bool obscure;

  @override
  State<AppPinInput> createState() => AppPinInputState();
}

class AppPinInputState extends State<AppPinInput>
    with SingleTickerProviderStateMixin {
  final List<String> _digits = [];
  late final AnimationController _shakeController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 480),
  );

  @override
  void dispose() {
    _shakeController.dispose();
    super.dispose();
  }

  void _addDigit(String digit) {
    if (_digits.length >= widget.length) return;
    setState(() => _digits.add(digit));
    HapticFeedback.selectionClick();
    final value = _digits.join();
    widget.onChanged?.call(value);
    if (_digits.length == widget.length) {
      widget.onCompleted?.call(value);
    }
  }

  void _removeDigit() {
    if (_digits.isEmpty) return;
    setState(_digits.removeLast);
    HapticFeedback.selectionClick();
    widget.onChanged?.call(_digits.join());
  }

  /// Barcha xonalarni tozalaydi (animatsiyasiz).
  void clear() => setState(_digits.clear);

  /// Xato PIN kiritilganda chaqiring — silkinish animatsiyasi ko'rsatadi,
  /// og'ir haptik beradi va xonalarni tozalaydi.
  void shakeAndClear() {
    HapticFeedback.heavyImpact();
    unawaited(_shakeController.forward(from: 0));
    setState(_digits.clear);
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedBuilder(
          animation: _shakeController,
          builder: (context, child) {
            final t = _shakeController.value;
            final dx = math.sin(t * math.pi * 6) * (1 - t) * 14;
            return Transform.translate(offset: Offset(dx, 0), child: child);
          },
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < widget.length; i++) ...[
                if (i != 0) const SizedBox(width: 14),
                _PinDot(
                  filled: i < _digits.length,
                  error: hasError,
                  obscure: widget.obscure,
                  value: i < _digits.length ? _digits[i] : null,
                ),
              ],
            ],
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 14),
          Text(
            widget.errorText!,
            style: AppTextStyles.caption.copyWith(color: AppColors.danger),
          ),
        ],
        if (widget.showKeypad) ...[
          const SizedBox(height: 32),
          _Keypad(onDigit: _addDigit, onBackspace: _removeDigit),
        ],
      ],
    );
  }
}

class _PinDot extends StatelessWidget {
  const _PinDot({
    required this.filled,
    required this.error,
    required this.obscure,
    this.value,
  });

  final bool filled;
  final bool error;
  final bool obscure;
  final String? value;

  @override
  Widget build(BuildContext context) {
    final color = error ? AppColors.danger : AppColors.primary;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final line = isDark ? AppColors.darkLine : AppColors.line;

    if (!obscure) {
      return AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 44,
        height: 54,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: filled ? color.withValues(alpha: 0.08) : surfaceAlt,
          borderRadius: BorderRadius.circular(AppRadii.sm),
          border: Border.all(
            color: filled ? color : line,
            width: filled ? 1.5 : 1,
          ),
        ),
        child: Text(value ?? '', style: AppTextStyles.h2),
      );
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 16,
      height: 16,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: filled ? color : Colors.transparent,
        border: Border.all(
          color: filled ? color : line,
          width: filled ? 0 : 1.5,
        ),
      ),
    );
  }
}

class _Keypad extends StatelessWidget {
  const _Keypad({required this.onDigit, required this.onBackspace});

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;

  static const _rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final row in _rows) ...[
          _keypadRow([
            for (final digit in row)
              _KeypadButton(label: digit, onTap: () => onDigit(digit)),
          ]),
          const SizedBox(height: 12),
        ],
        _keypadRow([
          const SizedBox(width: 72, height: 72),
          _KeypadButton(label: '0', onTap: () => onDigit('0')),
          _KeypadButton.icon(
            icon: IconsaxPlusLinear.arrow_left_2,
            onTap: onBackspace,
          ),
        ]),
      ],
    );
  }

  Widget _keypadRow(List<Widget> items) {
    final children = <Widget>[];
    for (var i = 0; i < items.length; i++) {
      if (i != 0) children.add(const SizedBox(width: 20));
      children.add(items[i]);
    }
    // `FittedBox` bilan o'ralgan: bu qator (~256px) tor ekranlarda
    // (masalan kichik telefonlar) o'ralib turgan konteynerdan kengroq
    // bo'lib, gorizontal RenderFlex overflowga olib kelishi mumkin edi.
    // `mainAxisSize: MainAxisSize.min` MAJBURIY — `FittedBox` o'lchashda
    // `Row`ga cheksiz kengligi beradi, shu bois `MainAxisSize.max`
    // "BoxConstraints forces an infinite width" xatosini keltirib
    // chiqaradi.
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: children,
      ),
    );
  }
}

class _KeypadButton extends StatefulWidget {
  const _KeypadButton({required this.onTap, this.label, this.icon})
    : assert(label != null || icon != null, 'label yoki icon berilishi kerak');

  const _KeypadButton.icon({required this.icon, required this.onTap})
    : label = null;

  final String? label;
  final IconData? icon;
  final VoidCallback onTap;

  @override
  State<_KeypadButton> createState() => _KeypadButtonState();
}

class _KeypadButtonState extends State<_KeypadButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onTap();
      },
      child: AnimatedScale(
        scale: _pressed ? 0.92 : 1,
        duration: const Duration(milliseconds: 100),
        child: Container(
          width: 72,
          height: 72,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _pressed ? surfaceAlt : Colors.transparent,
            shape: BoxShape.circle,
          ),
          child: widget.icon != null
              ? Icon(widget.icon, size: 24, color: ink)
              : Text(widget.label!, style: AppTextStyles.h1),
        ),
      ),
    );
  }
}
