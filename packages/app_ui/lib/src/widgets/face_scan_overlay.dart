import 'dart:math' as math;

import 'package:app_ui/src/theme/app_colors.dart';
import 'package:app_ui/src/widgets/face_scan_message.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

/// [FaceScanOverlay] joriy bosqichi — chaqiruvchi ekran (masalan
/// `face_enroll_page.dart`) o'zining holat-mashinasini shu enumga
/// moslashtirib beradi; kontur rangi va animatsiyalar shundan kelib
/// chiqadi.
enum FaceScanStatus {
  /// Kamera/oqim hali tayyor emas yoki foydalanuvchi hali boshlamagan.
  idle,

  /// Kadrda yuz qidirilmoqda (yuz topilmagan yoki sifat gate'idan
  /// o'tmagan).
  searching,

  /// Yuz sifat gate'idan o'tdi, barqarorlik hisoblanmoqda — `progress`
  /// shu jarayonni ko'rsatadi.
  aligning,

  /// Joriy kadr suratga olinmoqda / qayta ishlanmoqda.
  capturing,

  /// Muvaffaqiyatli yakunlandi.
  success,

  /// Xato holati (masalan mos kelmadi yoki muddat tugadi).
  error,
}

/// Premium, qayta ishlatiluvchi FACE-shape skaner overlay'i.
///
/// Oddiy ovaldan farqli o'laroq — tepada silliq gumbaz, yonoq suyagida
/// (tepadan ~44% pastda) eng keng nuqta va pastda o'tkir UCH EMAS, yumshoq
/// yumaloq iyak bilan haqiqiy "bosh siluetini" chizadi (Face ID uslubidagi
/// taassurot; aniq nazorat-nuqta konstruksiyasi — qarang:
/// `_buildFaceSilhouette` hujjati). Butunlay `CustomPaint` bilan ishlaydi:
///  * kamera oldida qoraytirilgan scrim, ichida yuz-shakl "teshik"
///    (`saveLayer` + `BlendMode.clear` — kamera shu orqali ko'rinadi);
///  * holatga qarab silliq rang o'zgaruvchi kontur;
///  * `searching`/`aligning`da yuz hududi ichida yuqoridan pastga
///    suzuvchi skaner-chizig'i;
///  * `idle`/`searching`da konturning yengil "nafas olishi";
///  * `aligning`da [progress] bo'yicha konturni aylanib to'luvchi
///    yo'l (`PathMetric.extractPath`);
///  * `success`da bir martalik "porlash + check" animatsiyasi.
///
/// Pastda [FaceScanMessage] orqali joriy ko'rsatma ([message]/
/// [messageIcon]) ham shu widget ichida chiziladi — chaqiruvchi uni
/// alohida joylashtirishi shart emas.
///
/// Sof UI qatlami — kamera yoki ML plugin'iga bog'liq emas; kamera
/// preview shu widgetning ORQASIGA (masalan `Stack`da pastki qatlamga,
/// `CameraCoverBox` ichida) joylashtirilishi kerak.
class FaceScanOverlay extends StatefulWidget {
  const FaceScanOverlay({
    required this.status,
    required this.message,
    super.key,
    this.progress = 0,
    this.messageIcon,
    this.padding = const EdgeInsets.only(bottom: 32),
  });

  /// Joriy skanerlash bosqichi — kontur rangi va animatsiyalarni
  /// boshqaradi.
  final FaceScanStatus status;

  /// `0..1` — `aligning` bosqichida barqarorlik hisoblanayotganda kontur
  /// bo'ylab to'luvchi progress-yo'l.
  final double progress;

  /// Pastdagi ko'rsatma matni (masalan "Yuzingizni ramka ichiga
  /// joylang").
  final String message;

  /// [message] oldidagi ixtiyoriy icon.
  final IconData? messageIcon;

  /// Tashqi bo'shliq — pastki ko'rsatma "pill"ining pastki chekkadan
  /// masofasini belgilaydi.
  final EdgeInsets padding;

  @override
  State<FaceScanOverlay> createState() => _FaceScanOverlayState();
}

class _FaceScanOverlayState extends State<FaceScanOverlay>
    with TickerProviderStateMixin {
  // "Nafas olish" (breathing) effekti — idle/searching holatida konturga
  // yengil hayotiylik beradi.
  late final AnimationController _pulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat(reverse: true);

  // Yuz hududi ichida yuqoridan pastga suzuvchi yorug'lik chizig'i.
  late final AnimationController _scanController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..repeat();

  // Muvaffaqiyatda bir martalik "porlash + check" animatsiyasi.
  late final AnimationController _successController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 500),
  );

  @override
  void initState() {
    super.initState();
    if (widget.status == FaceScanStatus.success) {
      _successController.value = 1;
    }
  }

  @override
  void didUpdateWidget(covariant FaceScanOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    final enteredSuccess =
        widget.status == FaceScanStatus.success &&
        oldWidget.status != FaceScanStatus.success;
    if (enteredSuccess) {
      _successController.forward(from: 0);
    } else if (widget.status != FaceScanStatus.success) {
      _successController.value = 0;
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _scanController.dispose();
    _successController.dispose();
    super.dispose();
  }

  Color _ringColor(bool isDark) {
    switch (widget.status) {
      case FaceScanStatus.idle:
      case FaceScanStatus.searching:
        return isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
      case FaceScanStatus.aligning:
      case FaceScanStatus.capturing:
      case FaceScanStatus.success:
        return AppColors.primary;
      case FaceScanStatus.error:
        return AppColors.danger;
    }
  }

  bool get _breathing =>
      widget.status == FaceScanStatus.idle ||
      widget.status == FaceScanStatus.searching;

  bool get _scanning =>
      widget.status == FaceScanStatus.searching ||
      widget.status == FaceScanStatus.aligning;

  Rect _faceRect(Size size) {
    final double faceWidth = math.min(size.width * 0.72, 300);
    final faceHeight = faceWidth * 1.32;
    // Vertikal markazga yaqinroq (0.46) — yuz-siluet ekranда chiroyliroq,
    // markazда joylashadi (ilgari 0.42 — biroz tepada edi).
    final center = Offset(size.width / 2, size.height * 0.46);
    return Rect.fromCenter(
      center: center,
      width: faceWidth,
      height: faceHeight,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = Size(constraints.maxWidth, constraints.maxHeight);
        final faceRect = _faceRect(size);

        return TweenAnimationBuilder<Color?>(
          tween: ColorTween(end: _ringColor(isDark)),
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeInOutCubic,
          builder: (context, color, _) {
            final ringColor = color ?? AppColors.inkMuted;
            return TweenAnimationBuilder<double>(
              tween: Tween(end: widget.progress),
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              builder: (context, progress, _) {
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    AnimatedBuilder(
                      animation: Listenable.merge([
                        _pulseController,
                        _scanController,
                        _successController,
                      ]),
                      builder: (context, _) {
                        return CustomPaint(
                          size: size,
                          painter: _FaceScanPainter(
                            faceRect: faceRect,
                            ringColor: ringColor,
                            progress: progress,
                            breathe: _breathing ? _pulseController.value : 0,
                            scanT: _scanning ? _scanController.value : null,
                            successT: widget.status == FaceScanStatus.success
                                ? _successController.value
                                : 0,
                          ),
                        );
                      },
                    ),
                    if (widget.status == FaceScanStatus.success)
                      _SuccessBadge(
                        center: faceRect.center,
                        controller: _successController,
                      ),
                    Positioned(
                      left: 24,
                      right: 24,
                      bottom: widget.padding.bottom,
                      child: Center(
                        child: FaceScanMessage(
                          message: widget.message,
                          icon: widget.messageIcon,
                          accentColor: ringColor,
                        ),
                      ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }
}

/// `success` holatiga kirganda bir martalik "pop" bilan paydo bo'ladigan
/// check-belgisi — [controller] 0..1 (500ms) davomida `easeOutBack` bilan
/// kattalashadi va shu bilan barobar xiralikdan to'liq ko'rinishga o'tadi.
class _SuccessBadge extends StatelessWidget {
  const _SuccessBadge({required this.center, required this.controller});

  final Offset center;
  final AnimationController controller;

  static const double _size = 68;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: center.dx - _size / 2,
      top: center.dy - _size / 2,
      child: AnimatedBuilder(
        animation: controller,
        builder: (context, child) {
          final pop = Curves.easeOutBack.transform(controller.value);
          final fade = Curves.easeOut.transform(controller.value);
          return Opacity(
            opacity: fade,
            child: Transform.scale(scale: 0.4 + 0.6 * pop, child: child),
          );
        },
        child: Container(
          width: _size,
          height: _size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.primary.withValues(alpha: 0.16),
            border: Border.all(color: AppColors.primary, width: 2),
          ),
          child: const Icon(
            IconsaxPlusBold.tick_circle,
            color: AppColors.primary,
            size: 34,
          ),
        ),
      ),
    );
  }
}

class _FaceScanPainter extends CustomPainter {
  _FaceScanPainter({
    required this.faceRect,
    required this.ringColor,
    required this.progress,
    required this.breathe,
    required this.scanT,
    required this.successT,
  });

  final Rect faceRect;
  final Color ringColor;
  final double progress;

  /// `0` bo'lsa nafas olish effekti o'chirilgan, aks holda `_pulseController`
  /// qiymati (0..1, reverse loop).
  final double breathe;

  /// `null` bo'lsa skaner-chizig'i chizilmaydi, aks holda `_scanController`
  /// qiymati (0..1, repeat).
  final double? scanT;

  /// `0` bo'lsa muvaffaqiyat effekti yo'q, aks holda `_successController`
  /// qiymati (0..1, one-shot).
  final double successT;

  @override
  void paint(Canvas canvas, Size size) {
    final facePath = _buildFaceSilhouette(faceRect);

    _paintScrim(canvas, size, facePath);

    final scan = scanT;
    if (scan != null) {
      _paintScanLine(canvas, facePath, scan);
    }

    _paintContour(canvas, facePath);

    // Yuz atrofidagi "soat" halqasi — `aligning`da yashil yoy tepadan (12
    // soat) soat mili yo'nalishida [progress] ulushigacha to'ladi; `searching`
    // paytida esa qisqa yoy uzluksiz aylanib "aniqlanmoqda" hissini beradi.
    _paintClockRing(canvas);
  }

  /// Butun maydonni brend (yashil) rangida yumshoq qoraytiradi, so'ng yuz
  /// siluetini shaffof qilib "teshadi" — klassik scrim-with-hole texnikasi
  /// (`saveLayer` + `BlendMode.clear`). Scrim ATAYLAB sof qora emas, balki
  /// to'q-yashil (brend) — yuz kadri iliqroq, "tirik" muhitda ko'rinadi.
  void _paintScrim(Canvas canvas, Size size, Path facePath) {
    // Ochiqroq (kamroq quyuq) yashil wash — atrofdagi kamera ko'proq
    // ko'rinadi ("ochiqroq qil" so'rovi). Qora bilan aralashtirilmaydi.
    final scrim = AppColors.primaryDeep.withValues(alpha: 0.42);
    canvas
      ..saveLayer(Offset.zero & size, Paint())
      ..drawRect(Offset.zero & size, Paint()..color = scrim)
      ..drawPath(
        facePath,
        Paint()
          ..blendMode = BlendMode.clear
          ..color = AppColors.ink,
      )
      ..restore();
  }

  /// Yuz hududi ichidagina ko'rinadigan (clip qilingan), yuqoridan
  /// pastga suzuvchi yumshoq gradient chiziq — "tirik" skanerlash
  /// taassurotini beradi.
  void _paintScanLine(Canvas canvas, Path facePath, double t) {
    final bandHeight = faceRect.height * 0.30;
    final travel = faceRect.height + bandHeight;
    final centerY = faceRect.top - bandHeight / 2 + travel * t;
    final band = Rect.fromLTWH(
      faceRect.left - 12,
      centerY - bandHeight / 2,
      faceRect.width + 24,
      bandHeight,
    );

    canvas
      ..save()
      ..clipPath(facePath)
      ..drawRect(
        band,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              ringColor.withValues(alpha: 0),
              ringColor.withValues(alpha: 0.30),
              ringColor.withValues(alpha: 0),
            ],
            stops: const [0, 0.5, 1],
          ).createShader(band),
      )
      ..restore();
  }

  /// Asosiy kontur — holat rangida, `breathe`ga qarab markazdan nozik
  /// scale qilinadi, `successT` faol bo'lsa qisqa "flash" sifatida
  /// chiziq qalinligi biroz bo'rttiriladi.
  void _paintContour(Canvas canvas, Path facePath) {
    final breatheScale = 1 + math.sin(breathe * 2 * math.pi) * 0.014;
    final successBoost = successT > 0
        ? math.sin(successT * math.pi) * 2.4
        : 0.0;

    canvas
      ..save()
      ..translate(faceRect.center.dx, faceRect.center.dy)
      ..scale(breatheScale)
      ..translate(-faceRect.center.dx, -faceRect.center.dy)
      ..drawPath(
        facePath,
        Paint()
          ..color = ringColor.withValues(alpha: 0.9)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.6 + successBoost
          ..strokeJoin = StrokeJoin.round,
      )
      ..restore();
  }

  /// Yuz atrofidagi halqa. Doimo nozik "iz" (track) chiziladi; `aligning`da
  /// yashil yoy tepadan (12 soat) soat mili yo'nalishida [progress] ulushigacha
  /// to'ladi (glow + tiniq chiziq); `searching`da esa qisqa yoy uzluksiz
  /// aylanib "aniqlanmoqda" signalini beradi.
  void _paintClockRing(Canvas canvas) {
    final ringRect = faceRect.inflate(14);
    const start = -math.pi / 2; // tepa (12 soat)

    // Track — nozik oq halqa (yashil scrim ustida ham ajralib turadi).
    canvas.drawOval(
      ringRect,
      Paint()
        ..color = AppColors.surface.withValues(alpha: 0.16)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4,
    );

    if (progress > 0) {
      final sweep = 2 * math.pi * progress.clamp(0.0, 1.0);
      canvas
        ..drawArc(
          ringRect,
          start,
          sweep,
          false,
          Paint()
            ..color = AppColors.primary.withValues(alpha: 0.35)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 12
            ..strokeCap = StrokeCap.round
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
        )
        ..drawArc(
          ringRect,
          start,
          sweep,
          false,
          Paint()
            ..color = AppColors.primary
            ..style = PaintingStyle.stroke
            ..strokeWidth = 5.5
            ..strokeCap = StrokeCap.round,
        );
    } else if (scanT != null) {
      // Uzluksiz aylanuvchi qisqa yoy — faol "aniqlanmoqda" indikatori.
      final rot = 2 * math.pi * scanT!;
      canvas.drawArc(
        ringRect,
        start + rot,
        math.pi * 0.5,
        false,
        Paint()
          ..color = AppColors.primary.withValues(alpha: 0.85)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4.5
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _FaceScanPainter oldDelegate) {
    return faceRect != oldDelegate.faceRect ||
        ringColor != oldDelegate.ringColor ||
        progress != oldDelegate.progress ||
        breathe != oldDelegate.breathe ||
        scanT != oldDelegate.scanT ||
        successT != oldDelegate.successT;
  }
}

/// Yuz siluetini [box]ga moslab quradi — silliq, tabiiy BOSH/YUZ
/// konturiga ega yopiq [Path] ("yumshoq tuxum" — vertikal ovoid, tepasi
/// yumaloqroq/kengroq, tagi torroq-lekin-yumshoq-yumaloq).
///
/// Oldingi versiya (4 segment, o'rtada "chakka"+"jag'" nazorat nuqtalari
/// bilan) burchaklarda urinma-uzluksizligi kafolatlanmagani uchun
/// cho'qqilangan — "qo'y boshi"ga o'xshab qolgan edi (foydalanuvchi
/// hisoboti). Endi FAQAT 2 ta kub-Bezier segment (har yarmida), oraliq
/// "jag'" nazorat nuqtasisiz — aynan o'sha qo'shimcha nuqta, hatto
/// urinma yo'nalishi mos kelganda ham, egrilikda ko'zga tashlanadigan
/// "tirsak" hosil qilgani sonli+vizual tekshiruvda aniqlandi:
///  * `crown` (`nx=0, ny=0`) -> `cheek` (`nx=1, ny=cheekY`, KONTURNING
///    ENG KENG NUQTASI, tepadan ~44%): standart `kappa` chorak-ellips
///    kub-Bezier approksimatsiyasi (`4/3*(sqrt(2)-1) ≈ 0.5523`, xato
///    <0.03%) — crown'da GORIZONTAL, cheek'da VERTIKAL urinma, ya'ni
///    silliq, bo'rtmasiz gumbaz (eng keng nuqta tepada EMAS, aynan
///    yonoq balandligida);
///  * `cheek` -> `chin` (`nx=0, ny=1`): BITTA silliq egri chiziq —
///    cheek'dagi vertikal urinmani davom ettirib, chin'da GORIZONTAL
///    urinma bilan tugaydi. Iyak shu bilan O'TKIR UCH EMAS — keng
///    radiusli, yumshoq yumaloq tag (taxminan yonoq kengligining ~58%i,
///    markazlashgan, 55-62% oralig'ida).
///
/// Ikkala segmentda ham nazorat-nuqta x-qiymatlari qat'iy monoton
/// (`0->kappa->1` so'ng `1->1->0.58->0`) — bu MATEMATIK JIHATDAN
/// kafolatlaydi: butun o'ng yarim konturda faqat BITTA lokal maksimum
/// (`cheek`), boshqa hech qanday qo'shimcha do'mboq/chuqurcha yo'q.
///
/// So'ng chap tomon xuddi shu nazorat nuqtalarining ko'zgu aksi bilan
/// (teskari tartibda) yopiladi — natija mukammal simmetrik.
Path _buildFaceSilhouette(Rect box) {
  final halfW = box.width / 2;
  final h = box.height;
  final cx = box.center.dx;
  final top = box.top;

  Offset p(double nx, double ny) => Offset(cx + nx * halfW, top + ny * h);

  // Chorak-ellips kub-Bezier approksimatsiyasi konstantasi — qarang:
  // funksiya hujjati.
  const kappa = 0.5522847498;
  // Konturning eng keng nuqtasi (yonoq suyagi) tepadan shu ulushda.
  const cheekY = 0.44;

  final crown = p(0, 0);
  final cheek = p(1, cheekY);
  final chin = p(0, 1);

  final path = Path()..moveTo(crown.dx, crown.dy);

  void curveTo(Offset c1, Offset c2, Offset end) {
    path.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, end.dx, end.dy);
  }

  // O'ng tomon — atayin FAQAT 2 segment: tepalik -> yonoq suyagi -> iyak
  // (oraliq "jag'" nazorat nuqtasi YO'Q — sabab: funksiya hujjati).
  curveTo(p(kappa, 0), p(1, cheekY * (1 - kappa)), cheek);
  curveTo(p(1, cheekY + 0.60 * (1 - cheekY)), p(0.58, 1), chin);

  // Chap tomon — xuddi shu nazorat nuqtalarining ko'zgu aksi, teskari
  // tartibda (iyakdan tepalikka qaytib, siluetni yopadi).
  curveTo(
    _mirror(p(0.58, 1), cx),
    _mirror(p(1, cheekY + 0.60 * (1 - cheekY)), cx),
    _mirror(cheek, cx),
  );
  curveTo(
    _mirror(p(1, cheekY * (1 - kappa)), cx),
    _mirror(p(kappa, 0), cx),
    crown,
  );

  return path..close();
}

Offset _mirror(Offset offset, double axisX) =>
    Offset(2 * axisX - offset.dx, offset.dy);
