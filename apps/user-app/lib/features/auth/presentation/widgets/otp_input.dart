import 'dart:async';
import 'dart:math' as math;

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// 4 xonali OTP kiritish maydoni.
class OtpInput extends StatefulWidget {
  const OtpInput({
    required this.onCompleted,
    super.key,
    this.length = 4,
    this.onChanged,
  });

  final int length;
  final ValueChanged<String> onCompleted;
  final ValueChanged<String>? onChanged;

  @override
  State<OtpInput> createState() => OtpInputState();
}

/// [OtpInput]ning ochiq holati — noto'g'ri kod kiritilganda tashqaridan
/// (masalan `OtpPage`dan) [GlobalKey]<[OtpInputState]> orqali
/// [shakeAndClear] chaqirish uchun (`AppPinInputState.shakeAndClear` bilan
/// bir xil naqsh, qarang: `packages/app_ui/.../app_pin_input.dart`).
class OtpInputState extends State<OtpInput>
    with SingleTickerProviderStateMixin {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  late final AnimationController _shakeController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 480),
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _focusNode.requestFocus(),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  /// Barcha kiritilgan xonalarni tozalaydi (animatsiyasiz) — chaqiruvchi
  /// (`OtpPage`)ning o'z holatini ham sinxronlashi uchun
  /// [OtpInput.onChanged] bo'sh qiymat bilan chaqiriladi.
  void clear() {
    _controller.clear();
    setState(() {});
    widget.onChanged?.call('');
  }

  /// Noto'g'ri kod tasdiqdan o'tmaganda chaqiring — silkinish animatsiyasi
  /// ko'rsatadi, og'ir haptik beradi va xonalarni tozalaydi.
  void shakeAndClear() {
    HapticFeedback.heavyImpact();
    unawaited(_shakeController.forward(from: 0));
    clear();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    return Stack(
      children: [
        // Yashirin matn maydoni — haqiqiy klaviatura kirishini boshqaradi.
        Opacity(
          opacity: 0,
          child: TextField(
            controller: _controller,
            focusNode: _focusNode,
            keyboardType: TextInputType.number,
            maxLength: widget.length,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (value) {
              setState(() {});
              widget.onChanged?.call(value);
              if (value.length == widget.length) {
                widget.onCompleted(value);
              }
            },
          ),
        ),
        // Ko'rinadigan kataklar — xato holatida `_shakeController` orqali
        // butun qator silkinadi (PIN kiritish bilan bir xil taassurot).
        GestureDetector(
          onTap: _focusNode.requestFocus,
          child: AnimatedBuilder(
            animation: _shakeController,
            builder: (context, child) {
              final t = _shakeController.value;
              final dx = math.sin(t * math.pi * 6) * (1 - t) * 14;
              return Transform.translate(offset: Offset(dx, 0), child: child);
            },
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(widget.length, (i) {
                final filled = i < _controller.text.length;
                final active = i == _controller.text.length;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  margin: const EdgeInsets.symmetric(horizontal: 7),
                  width: 62,
                  height: 68,
                  decoration: BoxDecoration(
                    color: filled ? AppColors.primaryLight : surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: active || filled ? AppColors.primary : line,
                      width: active || filled ? 1.8 : 1,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    filled ? _controller.text[i] : '',
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      color: filled ? AppColors.primaryDark : ink,
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ],
    );
  }
}
