import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:worker_app/core/notifications/notification_service.dart';
import 'package:worker_app/features/face/domain/entities/liveness_challenge.dart';
import 'package:worker_app/features/face/presentation/bloc/face_cubit.dart';
import 'package:worker_app/features/face/presentation/widgets/mirrored_camera_preview.dart';
import 'package:worker_app/injection.dart';

/// Kunlik yuz bilan check-in sahifasi: liveness challenge (pirpirash/bosh
/// burish/jilmayish) → yuz mos kelishini tekshirish → skrinshot + joylashuv
/// bilan davomatni qayd etish.
///
/// `FaceEnrollPage` (Vazifa 16) bilan BIR XIL infratuzilmani (kamera
/// hayot-sikli, `FaceScanOverlay`/`CameraCoverBox` (app_ui, premium
/// yuz-shakl skaner), `WidgetsBindingObserver`, `BlocConsumer`, app_ui/l10n
/// patterni) qayta ishlatadi, faqat `FaceCubit`ni "liveness rejimi"da ishga
/// tushiradi (`startLiveness`).
///
/// Harakatlar ro'yxati DETERMINISTIK tanlanadi (`Math.random` YO'Q) —
/// qarang: [_pickLivenessActions].
class FaceCheckinPage extends StatefulWidget {
  const FaceCheckinPage({super.key});

  @override
  State<FaceCheckinPage> createState() => _FaceCheckinPageState();
}

class _FaceCheckinPageState extends State<FaceCheckinPage>
    with WidgetsBindingObserver {
  Timer? _geofenceTimer;
  GeofenceStatus? _geofenceStatus;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Ikkalasi ham mustaqil: `startLiveness` SOF (challenge'ni sozlaydi),
    // `startCamera` qurilma-only (kamerani ishga tushiradi) — qarang:
    // `FaceCubit` klass hujjati.
    final cubit = context.read<FaceCubit>()
      ..startLiveness(_pickLivenessActions());
    unawaited(cubit.startCamera());
    unawaited(_refreshGeofence());
    _geofenceTimer = Timer.periodic(
      const Duration(seconds: 8),
      (_) => unawaited(_refreshGeofence()),
    );
  }

  Future<void> _refreshGeofence() async {
    if (!mounted) return;
    final status = await context.read<FaceCubit>().checkGeofence();
    if (!mounted) return;
    setState(() => _geofenceStatus = status);
  }

  @override
  void dispose() {
    _geofenceTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final cubit = context.read<FaceCubit>();
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
        unawaited(cubit.pauseCamera());
      case AppLifecycleState.resumed:
        unawaited(cubit.resumeCamera());
      case AppLifecycleState.detached:
        break;
    }
  }

  Future<void> _navigateHomeAfterDelay() async {
    await Future<void>.delayed(const Duration(milliseconds: 1800));
    if (!mounted) return;
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ink,
      body: BlocConsumer<FaceCubit, FaceState>(
        listener: (context, state) {
          switch (state) {
            case FaceCheckinSuccess(:final time):
              unawaited(_showSuccessDialog(context, time));
              unawaited(_navigateHomeAfterDelay());
              // Haqiqiy (on-device) mahalliy bildirishnoma — check-in
              // muvaffaqiyatli bo'lganini tasdiqlaydi. `NotificationService`
              // DI'da ro'yxatdan o'tmagan bo'lsa (masalan widget testda)
              // yoki ruxsat rad etilgan bo'lsa `show()` xotirjam hech
              // narsa qilmaydi — bu yerda hech qachon uncaught bo'lmaydi.
              if (getIt.isRegistered<NotificationService>()) {
                unawaited(
                  getIt<NotificationService>().show(
                    title: 'Davomat belgilandi',
                    body: 'Bugungi ish kuni uchun check-in muvaffaqiyatli '
                        'amalga oshirildi ($time).',
                  ),
                );
              }
            case FaceLivenessFailed():
              unawaited(
                _showRetryDialog(
                  context,
                  icon: AppIcons.timer,
                  title: context.l10n.faceLivenessFailedTitle,
                  message: context.l10n.faceLivenessFailedMessage,
                ),
              );
            case FaceMatchFailed():
              unawaited(
                _showRetryDialog(
                  context,
                  icon: AppIcons.close,
                  title: context.l10n.faceMatchFailedTitle,
                  message: context.l10n.faceMatchFailedMessage,
                ),
              );
            case FaceGeofenceOutside(:final distanceMeters):
              unawaited(
                _showRetryDialog(
                  context,
                  icon: AppIcons.locationBold,
                  title: context.l10n.outsideGeofence,
                  message: _geofenceOutsideMessage(context, distanceMeters),
                ),
              );
            case FaceError(:final message):
              unawaited(
                _showRetryDialog(
                  context,
                  icon: AppIcons.close,
                  title: context.l10n.faceErrorTitle,
                  message: message,
                ),
              );
            default:
              break;
          }
        },
        builder: (context, state) =>
            _CheckinBody(state: state, geofenceStatus: _geofenceStatus),
      ),
    );
  }
}

String _geofenceOutsideMessage(BuildContext context, double? distanceMeters) {
  final l10n = context.l10n;
  if (distanceMeters == null) return l10n.faceGeofenceOutsideMessage;
  return '${l10n.faceGeofenceOutsideMessage}\n'
      '${l10n.faceGeofenceDistanceLabel}: '
      '${distanceMeters.round()} ${l10n.meterSuffix}';
}

Future<void> _showSuccessDialog(BuildContext context, String time) {
  final l10n = context.l10n;
  return AppDialog.success(
    context: context,
    title: l10n.checkinSuccess,
    message: '${l10n.faceCheckinTimeLabel}: $time\n${l10n.faceCheckinDone}',
    buttonLabel: l10n.faceContinue,
    onClose: () {
      if (context.mounted) context.go('/home');
    },
  );
}

/// Barcha "narrative" check-in xatolari (liveness timeout, mos kelmadi,
/// geofence tashqarisida, umumiy xato) uchun bitta uslub — qizil ikonka +
/// "Qayta urinish" tugmasi. `barrierDismissible: false`: foydalanuvchi
/// faqat tugma orqali chiqadi, shunda doim ishlaydigan "qayta urinish"
/// yo'li kafolatlanadi (chetga bosib tasodifan yopib qo'yish — "tupik"
/// holatiga olib kelmaydi).
Future<void> _showRetryDialog(
  BuildContext context, {
  required IconData icon,
  required String title,
  required String message,
}) {
  return AppDialog.show<void>(
    context: context,
    icon: icon,
    iconColor: AppColors.danger,
    title: title,
    message: message,
    barrierDismissible: false,
    actions: [
      AppButton(
        label: context.l10n.retry,
        variant: AppButtonVariant.danger,
        onPressed: () {
          Navigator.of(context).pop();
          context.read<FaceCubit>().retry();
        },
      ),
    ],
  );
}

/// Kunlik check-in uchun 2-3 ta TAKRORLANMAS `LivenessAction` deterministik
/// tanlaydi — `Math.random` ISHLATILMAYDI. `DateTime.now()`dan olingan
/// millisekund 4 ta harakatning aylanma (rotatsiya) kesimini tanlaydi:
/// natija har doim ketma-ket, takrorlanmas harakatlar ro'yxati (kun
/// davomida turli chaqiruvlarda turlicha, lekin bitta chaqiruv ichida
/// to'liq deterministik). Test esa `startLiveness`ga aniq ro'yxat beradi
/// — bu funksiya productionda FAQAT sahifa tomonidan chaqiriladi.
List<LivenessAction> _pickLivenessActions() {
  const all = LivenessAction.values;
  final seed = DateTime.now().millisecondsSinceEpoch;
  final start = seed % all.length;
  final count = 2 + (seed ~/ all.length) % 2; // 2 yoki 3
  return List.generate(count, (i) => all[(start + i) % all.length]);
}

/// Joriy `FaceState`ga mos to'liq-ekran ko'rinishni tanlaydi — sealed
/// `switch` orqali compiler barcha holatlar (shu jumladan `FaceEnrollPage`
/// bilan bo'lishilgan enrollment-only holatlar) qamrab olinganini
/// tekshiradi.
class _CheckinBody extends StatelessWidget {
  const _CheckinBody({required this.state, required this.geofenceStatus});

  final FaceState state;
  final GeofenceStatus? geofenceStatus;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return switch (state) {
      FaceInitializing() => _LoadingView(text: l10n.faceInitializing),
      FacePermissionDenied(:final permanentlyDenied) => _MessageView(
        icon: AppIcons.lock,
        title: l10n.facePermissionTitle,
        message: l10n.faceCheckinCameraPermissionMessage,
        actionLabel: permanentlyDenied
            ? l10n.faceOpenSettings
            : l10n.faceGrantPermission,
        onAction: () {
          if (permanentlyDenied) {
            unawaited(openAppSettings());
          } else {
            unawaited(context.read<FaceCubit>().startCamera());
          }
        },
      ),
      FaceCameraError() => _MessageView(
        icon: AppIcons.camera,
        title: l10n.faceCameraErrorTitle,
        message: l10n.faceCameraErrorMessage,
        actionLabel: l10n.retry,
        onAction: () => unawaited(context.read<FaceCubit>().startCamera()),
      ),
      FaceModelError() => _MessageView(
        icon: AppIcons.scan,
        title: l10n.faceModelErrorTitle,
        message: l10n.faceModelErrorMessage,
        actionLabel: l10n.retry,
        onAction: () => unawaited(context.read<FaceCubit>().startCamera()),
      ),
      FaceSearching() ||
      FaceLivenessPrompt() ||
      FaceVerifying() ||
      FaceCheckingIn() ||
      FaceCheckinSuccess() ||
      FaceGeofenceOutside() ||
      FaceLivenessFailed() ||
      FaceMatchFailed() ||
      FaceError() => _CheckinLiveView(
        state: state,
        geofenceStatus: geofenceStatus,
      ),
      // Enrollment-only holatlar — bu sahifada HECH QACHON emit qilinmaydi
      // (bu `FaceCubit` instansi `onDetection`/`capture()`ni liveness
      // rejimida chaqirmaydi). `FaceState` `FaceEnrollPage` bilan BITTA
      // sealed ierarxiya bo'lgani uchun switch baribir to'liq bo'lishi
      // kerak — shuning uchun faqat nazokatli, ko'rinmaydigan fallback.
      FacePoorQuality() ||
      FaceAligning() ||
      FaceCapturing() ||
      FaceEmbedding() ||
      FaceEnrolling() ||
      FaceSuccess() => const ColoredBox(color: AppColors.ink),
    };
  }
}

/// Kamera oldida premium yuz-shakl skaner (`FaceScanOverlay`) bilan jonli
/// check-in ko'rinishi — qidiruv, liveness-prompt, verifying, checking-in
/// va barcha terminal (muvaffaqiyat yoki narrative-xato) holatlar uchun
/// umumiy full-bleed kamera qatlami. Terminal holatlarda kamera fon
/// sifatida qolaveradi — natija esa `FaceCheckinPage.listener` orqali
/// ustiga chiquvchi `AppDialog` bilan ko'rsatiladi.
class _CheckinLiveView extends StatelessWidget {
  const _CheckinLiveView({required this.state, required this.geofenceStatus});

  final FaceState state;
  final GeofenceStatus? geofenceStatus;

  /// `FaceState` -> `FaceScanOverlay.status`. Kontur rangi va nafas-olish/
  /// skaner-chiziq animatsiyalarini endi `FaceScanOverlay`ning o'zi shu
  /// holatdan kelib chiqib boshqaradi — eski qo'lda hisoblangan
  /// `_ringColor`/`_shouldPulse` endi kerak emas. Guruhlash avvalgi rang
  /// mantig'i bilan BIR XIL: xato holatlar (avval `danger`) -> `error`,
  /// muvaffaqiyat -> `success`, faol jarayon (avval `primary`) ->
  /// `aligning`/`capturing`, kutish (avval `inkMuted`) -> `searching`.
  FaceScanStatus get _scanStatus => switch (state) {
    FaceLivenessFailed() ||
    FaceMatchFailed() ||
    FaceGeofenceOutside() ||
    FaceError() => FaceScanStatus.error,
    FaceCheckinSuccess() => FaceScanStatus.success,
    FaceLivenessPrompt() => FaceScanStatus.aligning,
    FaceVerifying() || FaceCheckingIn() => FaceScanStatus.capturing,
    _ => FaceScanStatus.searching,
  };

  double get _arcProgress => switch (state) {
    FaceLivenessPrompt(:final done, :final total) when total > 0 =>
      done / total,
    FaceVerifying() || FaceCheckingIn() || FaceCheckinSuccess() => 1,
    _ => 0,
  };

  bool get _isBusy => switch (state) {
    FaceVerifying() || FaceCheckingIn() => true,
    _ => false,
  };

  IconData? get _actionIcon => switch (state) {
    FaceLivenessPrompt(:final action) => _iconFor(action),
    _ => null,
  };

  IconData _iconFor(LivenessAction? action) => switch (action) {
    LivenessAction.blink => AppIcons.eyeBlink,
    LivenessAction.turnLeft => AppIcons.turnLeft,
    LivenessAction.turnRight => AppIcons.turnRight,
    LivenessAction.smile => AppIcons.smile,
    null => AppIcons.tick,
  };

  String _prompt(AppLocalizations l10n) => switch (state) {
    FaceSearching() => l10n.faceHoldStill,
    FaceLivenessPrompt(:final action) => _actionPrompt(l10n, action),
    FaceVerifying() => l10n.faceVerifyingStatus,
    FaceCheckingIn() => l10n.faceCheckingInStatus,
    FaceCheckinSuccess() => l10n.checkinSuccess,
    FaceLivenessFailed() => l10n.faceLivenessFailedTitle,
    FaceMatchFailed() => l10n.faceMatchFailedTitle,
    FaceGeofenceOutside() => l10n.outsideGeofence,
    FaceError() => l10n.faceErrorTitle,
    _ => l10n.faceHoldStill,
  };

  String _actionPrompt(AppLocalizations l10n, LivenessAction? action) {
    return switch (action) {
      LivenessAction.blink => l10n.blinkPrompt,
      LivenessAction.turnLeft => l10n.turnLeftPrompt,
      LivenessAction.turnRight => l10n.turnRightPrompt,
      LivenessAction.smile => l10n.smilePrompt,
      null => l10n.faceKeepStill,
    };
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.read<FaceCubit>().controller;
    final l10n = context.l10n;
    final prompt = _prompt(l10n);
    final icon = _actionIcon;

    return Stack(
      fit: StackFit.expand,
      children: [
        if (controller != null && controller.value.isInitialized)
          // `CameraCoverBox`: preview'ni CHO'ZMASDAN (aspect-ratio saqlab,
          // ortig'ini kesib) to'liq ekranni qoplaydi. Eski kod
          // `CameraPreview`ni bevosita `Stack(fit: StackFit.expand)`
          // ichiga qo'yardi — bu ichki `AspectRatio`ni tor (tight)
          // cheklovlar bilan bekor qilib, tasvirni CHO'ZAR edi (foydalanuvchi
          // ta'rifi: "chozilgan"). `camera` paketida
          // `controller.value.aspectRatio` doim datchikning XOM (landscape)
          // nisbati — portret ko'rinish uchun standart inversiya kerak
          // (paketning rasmiy namunasi: `AspectRatio(aspectRatio: 1 /
          // controller.value.aspectRatio)`); bu ekran doim PORTRET (yuz
          // skaneri), shuning uchun inversiya shu yerda qattiq-kodlangan.
          CameraCoverBox(
            aspectRatio: 1 / controller.value.aspectRatio,
            // Faqat DISPLAY qatlami oynalanadi ("tabiiy oyna" ko'rinishi)
            // — aniqlash/embedding xom, oynalanmagan kadr ustida ishlaydi.
            // Qarang: `MirroredCameraPreview` va `FaceDetectorService`
            // hujjatlaridagi oynalash shartnomasi.
            child: MirroredCameraPreview(controller: controller),
          )
        else
          const ColoredBox(color: AppColors.ink),
        // Oval o'rniga haqiqiy yuz-shakl siluet (peshona/chakka/yonoq/
        // jag'/iyak) + skaner-chiziq + progress-yo'l; pastdagi ko'rsatma
        // pill'i ([prompt]/[icon]) ham shu widget ichida chiziladi.
        FaceScanOverlay(
          status: _scanStatus,
          progress: _arcProgress,
          message: prompt,
          messageIcon: icon,
        ),
        SafeArea(
          child: Column(
            children: [
              const _TopBar(),
              const SizedBox(height: 10),
              _GeofenceBanner(status: geofenceStatus),
              const Spacer(),
              if (_isBusy)
                const Padding(
                  // `FaceScanOverlay`ning o'z ko'rsatma-pill'i pastda
                  // suzib turadi — spinner shu pill ustiga tushib
                  // qolmasligi uchun kattaroq pastki bo'shliq.
                  padding: EdgeInsets.only(bottom: 104),
                  child: SizedBox(
                    width: 26,
                    height: 26,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.6,
                      valueColor: AlwaysStoppedAnimation(AppColors.surface),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Kamera ekranidagi jonli geofence banneri — `GeofenceStatus.isInside`ga
/// qarab yashil ("Ish hududidasiz") / qizil ("tashqaridasiz") / neytral
/// (hali aniqlanmagan/xato) pill. `FaceCheckinPage` buni har 8s da
/// (`FaceCubit.checkGeofence()` orqali) yangilaydi.
class _GeofenceBanner extends StatelessWidget {
  const _GeofenceBanner({required this.status});

  final GeofenceStatus? status;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (Color color, String text) = switch (status?.isInside) {
      true => (AppColors.success, l10n.insideGeofence),
      false => (AppColors.danger, l10n.outsideGeofence),
      null => (AppColors.inkMuted, l10n.faceLiveBannerUnknown),
    };

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOutCubic,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(AppIcons.locationBold, size: 15, color: AppColors.surface),
          const SizedBox(width: 6),
          // `Flexible` + ellipsis: uzunroq tarjima qilingan xabar tor
          // ekranlarda banner Row'ini "toshib ketishi"ning oldini oladi
          // (`MapPage`ning `_GeofenceBanner`i bilan bir xil himoya).
          Flexible(
            child: Text(
              text,
              style: AppTextStyles.label.copyWith(color: AppColors.surface),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 20, 0),
      child: Row(
        children: [
          if (context.canPop())
            AppBackButton(
              onPressed: context.pop,
              background: Colors.black.withValues(alpha: 0.28),
              foreground: AppColors.surface,
            )
          else
            const SizedBox(width: 48),
          Expanded(
            child: Text(
              context.l10n.faceCheckinTitle,
              style: AppTextStyles.h3.copyWith(color: AppColors.surface),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.ink,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation(AppColors.surface),
            ),
            const SizedBox(height: 20),
            Text(
              text,
              style: AppTextStyles.body.copyWith(
                color: AppColors.surface.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageView extends StatelessWidget {
  const _MessageView({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    // Bu ko'rinish (ruxsat/kamera/model xatosi) ODDIY ilova mavzusida
    // (EmptyState/AppButton — ikkalasi ham `Theme.of(context)`ga bog'liq)
    // chiziladi, shuning uchun fon HAM mavzuga mos bo'lishi SHART — aks
    // holda tungi mavzuda matn (yorug' `darkInk`) yorug' `canvas` fonda
    // deyarli ko'rinmas bo'lib qolardi.
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ColoredBox(
      color: isDark ? AppColors.darkCanvas : AppColors.canvas,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: EmptyState(
            icon: icon,
            title: title,
            message: message,
            action: AppButton(
              label: actionLabel,
              expand: false,
              onPressed: onAction,
            ),
          ),
        ),
      ),
    );
  }
}
