import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/theme/app_radii.dart';
import 'package:app_ui/src/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// Yagona dizaynli pastki varaq (bottom sheet).
///
/// Tepada drag-handle, sarlavha + yopish tugmasi, ixtiyoriy izoh va kontent.
///
/// **Klaviatura-xavfsiz**: [child] ichida `TextField`/`TextFormField` bo'lsa,
/// klaviatura ochilganda butun varaq pastki `viewInsets` (klaviatura
/// balandligi) bo'yicha aynan shuncha yuqoriga ko'tariladi — maydon hech
/// qachon klaviatura orqasida yashiringan holda qolmaydi. Varaqning eng
/// katta balandligi ham ko'rinadigan (klaviaturadan yuqoridagi) maydonga
/// nisbatan hisoblanadi, shu bilan ekran tepasidan "toshib ketish"ning oldi
/// olinadi.
///
/// Juda baland/ro'yxatli kontent uchun (masalan uzun forma) [scrollable]ni
/// `true` qiling — bu holda [child] o'z ichida aylanadigan
/// (`SingleChildScrollView`) bo'ladi. Standart qiymat `false`, chunki
/// `AppSelect`, `AppMultiSelect` va `AppFilterSheet` kabi ba'zi
/// chaqiruvchilar allaqachon o'zining ichki ro'yxat aylanishini
/// (`Flexible` + `ListView`) boshqaradi — ularni qo'shimcha tashqi scroll
/// ichiga olish o'lchov ziddiyatiga olib keladi.
Future<T?> showAppSheet<T>({
  required BuildContext context,
  required String title,
  required Widget child,
  String? subtitle,
  bool isScrollControlled = true,
  bool showClose = true,
  bool scrollable = false,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    builder: (_) => _AppSheetScaffold(
      title: title,
      subtitle: subtitle,
      showClose: showClose,
      scrollable: scrollable,
      child: child,
    ),
  );
}

class _AppSheetScaffold extends StatelessWidget {
  const _AppSheetScaffold({
    required this.title,
    required this.subtitle,
    required this.showClose,
    required this.scrollable,
    required this.child,
  });

  final String title;
  final String? subtitle;
  final bool showClose;
  final bool scrollable;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final bottomInset = media.viewInsets.bottom;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    // Klaviatura ochiq bo'lsa haqiqiy ko'rinadigan balandlik kamayadi —
    // varaq shu ko'rinadigan maydonning 90%idan oshmaydi.
    final visibleHeight = media.size.height - bottomInset;

    final content = Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: child,
    );

    final sheetCard = Container(
      constraints: BoxConstraints(maxHeight: visibleHeight * 0.9),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppRadii.xl),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            // Drag handle
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: line,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 16, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppTextStyles.h2),
                        if (subtitle != null) ...[
                          const SizedBox(height: 4),
                          Text(subtitle!, style: AppTextStyles.caption),
                        ],
                      ],
                    ),
                  ),
                  if (showClose)
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: surfaceAlt,
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                          border: Border.all(color: line),
                        ),
                        child: Icon(
                          IconsaxPlusLinear.close_circle,
                          size: 20,
                          color: inkSoft,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Flexible(
              child: scrollable
                  ? SingleChildScrollView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      child: content,
                    )
                  : content,
            ),
          ],
        ),
      ),
    );

    // Klaviatura balandligicha yuqoriga ko'taradi — bu THE fix: TextField
    // hech qachon klaviatura orqasida yashirin qolmaydi.
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: sheetCard,
    ).animate().fadeIn(duration: 200.ms);
  }
}
