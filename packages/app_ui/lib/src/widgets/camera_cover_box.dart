import 'package:flutter/material.dart';

/// Kamera (yoki istalgan boshqa) preview'ni CHO'ZMASDAN (stretch
/// qilmasdan) mavjud maydonni to'liq qoplaydigan (cover) qilib
/// ko'rsatuvchi sof layout yordamchisi.
///
/// Muammo: kamera preview widgetlari (masalan `camera` paketining
/// `CameraPreview`si) o'z tabiiy en/bo'y nisbatiga ega, lekin ko'pincha
/// ekrandagi maydon boshqa nisbatda bo'ladi. Uni oddiy `SizedBox.expand`
/// yoki `Expanded` ichiga qo'yish preview'ni CHO'ZIB (distortion bilan)
/// ko'rsatadi — yuzlar cho'zilgan/torraygan bo'lib ko'rinadi. Bu widget
/// buning o'rniga `BoxFit.cover` mantig'ini qo'llaydi: [child] o'lchamlari
/// nisbati saqlanadi, ortiqcha qismi esa mavjud maydondan tashqariga
/// chiqib, kesib tashlanadi (crop) — xuddi `Image(fit: BoxFit.cover)`
/// kabi, lekin ixtiyoriy widget uchun.
///
/// [aspectRatio] — [child]ning TABIIY (manba) en/bo'y nisbati (`width /
/// height`), masalan `cameraController.value.aspectRatio`. Diqqat: ba'zi
/// platformalarda kamera datchigi nisbati doim landscape sifatida
/// qaytadi — portret orientatsiyada chaqiruvchi kerak bo'lsa
/// `1 / cameraController.value.aspectRatio` uzatishi mumkin. Bu widget
/// bu farqni o'zi hal qilmaydi — faqat berilgan nisbatni to'g'ri
/// "cover" qiladi.
///
/// Ichkarida: [child] avval shu nisbatga ega mos o'lchamli qutiga
/// o'raladi, so'ng `FittedBox(fit: BoxFit.cover)` uni mavjud maydonni
/// TO'LIQ qoplaguncha (cho'zmasdan, faqat bir xilda kattalashtirib)
/// masshtablaydi. Tashqi `ClipRect` ortiqcha qismini kesadi — chunki
/// `FittedBox`ning o'zi standart holatda kesmaydi.
///
/// Sof widget — hech qanday kamera yoki boshqa plugin bog'liqligi yo'q;
/// [child] sifatida istalgan widget (masalan `CameraPreview`) uzatilishi
/// mumkin.
class CameraCoverBox extends StatelessWidget {
  const CameraCoverBox({
    required this.child,
    required this.aspectRatio,
    super.key,
  }) : assert(aspectRatio > 0, 'aspectRatio must be positive');

  /// Mavjud maydonni to'liq qoplab (cover) ko'rsatiladigan kontent
  /// (masalan kamera preview).
  final Widget child;

  /// [child]ning manba en/bo'y nisbati (`width / height`).
  final double aspectRatio;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final box = constraints.biggest;
          // Layout hali barqarorlashmagan (masalan birinchi frame)
          // paytida balandlik `0` bo'lib qolishi mumkin — shunda
          // `FittedBox` uchun NaN/Infinity oldini olish maqsadida
          // xavfsiz zaxira qiymat ishlatiladi.
          final sourceHeight = box.height > 0 ? box.height : 1.0;

          return FittedBox(
            fit: BoxFit.cover,
            child: SizedBox(
              width: sourceHeight * aspectRatio,
              height: sourceHeight,
              child: child,
            ),
          );
        },
      ),
    );
  }
}
