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
  State<OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends State<OtpInput> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();

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
    super.dispose();
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
        // Ko'rinadigan kataklar.
        GestureDetector(
          onTap: _focusNode.requestFocus,
          // `FittedBox` bilan o'ralgan: 4 katakli qator (~304px) tor
          // ekranlarda o'ralib turgan konteynerdan kengroq bo'lib,
          // gorizontal RenderFlex overflowga olib kelishi mumkin edi.
          // `mainAxisSize: MainAxisSize.min` MAJBURIY — `FittedBox`
          // o'lchashda `Row`ga cheksiz kengligi beradi.
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
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
