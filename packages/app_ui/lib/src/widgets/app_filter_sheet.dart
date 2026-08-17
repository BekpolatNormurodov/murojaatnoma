import 'package:app_ui/src/widgets/app_button.dart';
import 'package:app_ui/src/widgets/app_sheet.dart';
import 'package:flutter/material.dart';

/// [showAppFilterSheet] yopilish sababi.
enum AppFilterSheetResult {
  /// "Qo'llash" bosildi.
  applied,

  /// "Tozalash" bosildi.
  reset,
}

/// [AppFilterSheet]ni [showAppSheet] orqali ochadi.
///
/// [sections] — chaqiruvchi ilova o'z filtr widget'larini (masalan
/// AppSelect, AppSegmented, sana oralig'i va h.k.) joylashtiradigan
/// slot'lar ro'yxati; ularning holatini chaqiruvchi o'zi boshqaradi.
Future<AppFilterSheetResult?> showAppFilterSheet({
  required BuildContext context,
  required String title,
  required List<Widget> sections,
  String? subtitle,
  VoidCallback? onApply,
  VoidCallback? onReset,
  String applyLabel = "Qo'llash",
  String resetLabel = 'Tozalash',
  bool showReset = true,
}) {
  return showAppSheet<AppFilterSheetResult>(
    context: context,
    title: title,
    subtitle: subtitle,
    child: AppFilterSheet(
      sections: sections,
      onApply: onApply,
      onReset: onReset,
      applyLabel: applyLabel,
      resetLabel: resetLabel,
      showReset: showReset,
    ),
  );
}

/// Qayta ishlatiladigan filtr pastki varag'i skeleti — sarlavha
/// [showAppSheet] tomonidan chiziladi; bu yerda faqat filtr bo'limlari
/// ([sections]) va "Qo'llash"/"Tozalash" tugmalari ([AppButton]).
class AppFilterSheet extends StatelessWidget {
  const AppFilterSheet({
    required this.sections,
    super.key,
    this.onApply,
    this.onReset,
    this.applyLabel = "Qo'llash",
    this.resetLabel = 'Tozalash',
    this.showReset = true,
  });

  /// Filtr widget'lari — tepadan-pastga, orasida bo'shliq bilan chiziladi.
  final List<Widget> sections;

  /// "Qo'llash" bosilganda (varaq yopilishidan oldin) chaqiriladi.
  final VoidCallback? onApply;

  /// "Tozalash" bosilganda (varaq yopilishidan oldin) chaqiriladi.
  final VoidCallback? onReset;
  final String applyLabel;
  final String resetLabel;

  /// false bo'lsa "Tozalash" tugmasi ko'rsatilmaydi.
  final bool showReset;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Flexible(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final section in sections) ...[
                  section,
                  const SizedBox(height: 20),
                ],
              ],
            ),
          ),
        ),
        Row(
          children: [
            if (showReset) ...[
              Expanded(
                child: AppButton(
                  label: resetLabel,
                  variant: AppButtonVariant.secondary,
                  onPressed: () {
                    onReset?.call();
                    Navigator.of(context).pop(AppFilterSheetResult.reset);
                  },
                ),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              flex: showReset ? 2 : 1,
              child: AppButton(
                label: applyLabel,
                onPressed: () {
                  onApply?.call();
                  Navigator.of(context).pop(AppFilterSheetResult.applied);
                },
              ),
            ),
          ],
        ),
      ],
    );
  }
}
