import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';

/// Tasdiqlash oynasi — `true`/`false` qaytaradi.
///
/// `AppDialog.confirm`dan farqi: tugmalar DIALOGNING O'Z konteksti bilan
/// yopadi. `AppDialog.confirm` chaqiruvchi kontekstida `pop` qiladi — shell
/// tabi (masalan Profil) ichidan chaqirilganda bu dialogni emas, tabning
/// sahifasini yopib yuborardi (qora ekran, logout umuman ishlamasdi).
Future<bool> showConfirmDialog({
  required BuildContext context,
  required String title,
  required String confirmLabel,
  required String cancelLabel,
  required IconData icon,
  String? message,
  bool danger = false,
}) async {
  Widget action(
    String label,
    AppButtonVariant variant, {
    required bool value,
  }) => Builder(
    builder: (dialogContext) => AppButton(
      label: label,
      variant: variant,
      onPressed: () => Navigator.of(dialogContext).pop(value),
    ),
  );

  final result = await AppDialog.show<bool>(
    context: context,
    icon: icon,
    iconColor: danger ? AppColors.danger : AppColors.primary,
    title: title,
    message: message,
    actions: [
      action(
        confirmLabel,
        danger ? AppButtonVariant.danger : AppButtonVariant.primary,
        value: true,
      ),
      const SizedBox(height: 10),
      action(cancelLabel, AppButtonVariant.ghost, value: false),
    ],
  );
  return result ?? false;
}
