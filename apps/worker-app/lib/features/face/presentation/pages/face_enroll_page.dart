import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/face/domain/entities/liveness_challenge.dart';
import 'package:worker_app/features/face/presentation/bloc/face_cubit.dart';
import 'package:worker_app/features/face/presentation/widgets/mirrored_camera_preview.dart';

/// Birinchi marta yuzni ro'yxatdan o'tkazish (enrollment) sahifasi.
///
/// `FaceCubit`ning barcha holatlarini (`FaceState`) to'liq qamrab
/// oladi: initializing/permission/camera-model xatolari, jonli
/// qidiruv+sifat-gate+progress, capture/embed/enroll jarayoni, muvaffa-
/// qiyat va umumiy xato — har biri o'ziga mos ko'rinish va harakat bilan.
///
/// Kamera qurilma resursi bo'lgani uchun `WidgetsBindingObserver` orqali
/// ilova fon/oldinga o'tishini kuzatadi va oqimni mos ravishda
/// to'xtatadi/qayta boshlaydi.
class FaceEnrollPage extends StatefulWidget {
  const FaceEnrollPage({super.key});

  @override
  State<FaceEnrollPage> createState() => _FaceEnrollPageState();
}

class _FaceEnrollPageState extends State<FaceEnrollPage>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Enrollment ham liveness bilan (check-in kabi): avval SOF challenge'ni
    // sozlaymiz (`startLiveness(forEnroll: true)` — real odamligini blink/
    // burilish + `smile` bilan tekshiradi), so'ng kamerani ishga tushiramiz.
    // `forEnroll: true` capture-trigger'ni VerifyFace emas, EnrollFace (yangi
    // shablon saqlash) yo'liga yo'naltiradi — qarang: `FaceCubit`.
    final cubit = context.read<FaceCubit>()
      ..startLiveness(_pickEnrollLivenessActions(), forEnroll: true);
    unawaited(cubit.startCamera());
  }

  @override
  void dispose() {
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
    await Future<void>.delayed(const Duration(milliseconds: 1400));
    if (!mounted) return;
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ink,
      body: BlocConsumer<FaceCubit, FaceState>(
        listener: (context, state) {
          if (state is FaceSuccess) {
            // `faceEnrolled=true`: `AppRouter`ning `refreshListenable`i
            // shu `emit`ni ko'radi va `resolveAuthRedirect` joriy
            // manzilni qayta baholaydi — shu belgi qo'yilmasa,
            // muvaffaqiyat animatsiyasidan keyingi `context.go('/home')`
            // (`_navigateHomeAfterDelay`) darhol qayta `/face/enroll`ga
            // qaytarilar edi (redirect siyosati hali `faceEnrolled=false`
            // deb bilardi) — foydalanuvchi uchun "tiqilib qolgan" his
            // qildiruvchi xato.
            context.read<AuthCubit>().markFaceEnrolled();
            unawaited(_navigateHomeAfterDelay());
          }
        },
        builder: (context, state) => _FaceEnrollBody(state: state),
      ),
    );
  }
}

/// Enroll uchun liveness harakatlar ro'yxati: bitta tasodifiy anti-spoof
/// yetakchi (blink/turnLeft/turnRight) + DOIM frontal `smile` bilan yakun,
/// shunda saqlanadigan kadr frontal + ko'zi ochiq bo'ladi. Check-in'ning
/// `_pickLivenessActions`idan ATAY farq qiladi (`smile` bilan yakunlanadi),
/// shuning uchun umumiylashtirilmaydi.
///
/// XAVFSIZLIK CHEKLOVI (ataylab hujjatlashtirilgan): bu FAOL (active) liveness
/// FAQAT statik fotosuratni bloklaydi — ekranda ijro etilgan VIDEO replay'ni
/// EMAS (ML Kit jonli yuz bilan qayta ijro etilgan videoni ajrata olmaydi;
/// passiv anti-spoof — ekran porlashi/moire/chuqurlik — yo'q). Ishlab
/// chiqarish uchun haqiqiy identifikatsiya kafolati: maxsus liveness SDK
/// (passiv/depth) yoki nazoratchi ishtirokidagi enrollment kerak — bu MAHSULOT
/// qarori. Ayni cheklov check-in'da ham bor (bir xil liveness dvigateli).
List<LivenessAction> _pickEnrollLivenessActions() {
  const lead = [
    LivenessAction.blink,
    LivenessAction.turnLeft,
    LivenessAction.turnRight,
  ];
  final seed = DateTime.now().millisecondsSinceEpoch;
  return [lead[seed % lead.length], LivenessAction.smile];
}

/// Joriy `FaceState`ga mos to'liq-ekran ko'rinishni tanlaydi — sealed
/// `switch` orqali compiler barcha holatlar qamrab olinganini tekshiradi.
class _FaceEnrollBody extends StatelessWidget {
  const _FaceEnrollBody({required this.state});

  final FaceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return switch (state) {
      FaceInitializing() => _LoadingView(text: l10n.faceInitializing),
      FacePermissionDenied(:final permanentlyDenied) => _MessageView(
        icon: AppIcons.lock,
        title: l10n.facePermissionTitle,
        message: l10n.faceCameraPermissionMessage,
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
      FaceError(:final message) => _MessageView(
        icon: AppIcons.close,
        title: l10n.faceErrorTitle,
        message: message,
        actionLabel: l10n.retry,
        onAction: () => context.read<FaceCubit>().retry(),
      ),
      FaceSuccess() => const _SuccessView(),
      FaceSearching() ||
      FaceLivenessPrompt() ||
      FacePoorQuality() ||
      FaceAligning() ||
      FaceCapturing() ||
      FaceEmbedding() ||
      FaceEnrolling() => _LiveGateView(state: state),
      // Liveness muddati tugadi (20s) — enrollment uchun to'liq-ekranli
      // xato + qayta urinish (sahifaning mavjud `FaceError` idiomasi bilan
      // bir xil); `retry()` challenge'ni qaytadan boshlaydi.
      FaceLivenessFailed() => _MessageView(
        icon: AppIcons.timer,
        title: l10n.faceLivenessFailedTitle,
        message: l10n.faceLivenessFailedMessage,
        actionLabel: l10n.retry,
        onAction: () => context.read<FaceCubit>().retry(),
      ),
      // Check-in (verify) holatlari — enrollment sahifasida hech qachon emit
      // qilinmaydi (enroll `capture()` -> EnrollFace; hech qachon
      // VerifyFace/CheckIn'ga bormaydi). Sealed switch to'liq bo'lishi uchun
      // nazokatli, ko'rinmaydigan fallback.
      FaceVerifying() ||
      FaceCheckingIn() ||
      FaceCheckinSuccess() ||
      FaceGeofenceOutside() ||
      FaceMatchFailed() => const ColoredBox(color: AppColors.ink),
    };
  }
}

/// Kamera oldida premium yuz-shakl skaner (`FaceScanOverlay`) bilan jonli
/// sifat-gate ko'rinishi — `searching`, `poorQuality`, `aligning`,
/// `capturing`, `embedding`, `enrolling` holatlari uchun umumiy full-bleed
/// kamera qatlami.
class _LiveGateView extends StatelessWidget {
  const _LiveGateView({required this.state});

  final FaceState state;

  /// `FaceState` -> `FaceScanOverlay.status`. Kontur rangi va nafas-olish/
  /// skaner-chiziq animatsiyalarini endi `FaceScanOverlay`ning o'zi shu
  /// holatdan kelib chiqib boshqaradi — eski qo'lda hisoblangan
  /// `_ringColor`/`_shouldPulse` endi kerak emas. Guruhlash avvalgi rang
  /// mantig'i bilan BIR XIL: `poorQuality` (avval `danger`) -> `error`,
  /// faol jarayon — aligning/capturing/embedding/enrolling (avval
  /// `primary`) -> `aligning`/`capturing`, kutish (avval `inkMuted`) ->
  /// `searching`.
  FaceScanStatus get _scanStatus => switch (state) {
    FacePoorQuality() => FaceScanStatus.error,
    FaceLivenessPrompt() => FaceScanStatus.aligning,
    FaceAligning() => FaceScanStatus.aligning,
    FaceCapturing() ||
    FaceEmbedding() ||
    FaceEnrolling() => FaceScanStatus.capturing,
    _ => FaceScanStatus.searching,
  };

  double get _arcProgress => switch (state) {
    FaceLivenessPrompt(:final done, :final total) when total > 0 =>
      done / total,
    FaceAligning(:final progress) => progress,
    FaceCapturing() || FaceEmbedding() || FaceEnrolling() => 1,
    _ => 0,
  };

  bool get _isBusy => switch (state) {
    FaceCapturing() || FaceEmbedding() || FaceEnrolling() => true,
    _ => false,
  };

  String _prompt(AppLocalizations l10n) => switch (state) {
    FaceSearching() => l10n.faceHoldStill,
    FaceLivenessPrompt(:final action) => _actionPrompt(l10n, action),
    FacePoorQuality(:final reason) => _reasonText(l10n, reason),
    FaceAligning() => l10n.faceKeepStill,
    FaceCapturing() => l10n.faceCapturingStatus,
    FaceEmbedding() => l10n.faceEmbeddingStatus,
    FaceEnrolling() => l10n.faceEnrollingStatus,
    _ => l10n.faceHoldStill,
  };

  /// Liveness harakat ikonasi (pastdagi ko'rsatma-pill'da) — check-in bilan
  /// bir xil (`_CheckinLiveView`dan ko'chirilgan): faqat `FaceLivenessPrompt`
  /// holatida ko'rinadi.
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

  String _actionPrompt(AppLocalizations l10n, LivenessAction? action) {
    return switch (action) {
      LivenessAction.blink => l10n.blinkPrompt,
      LivenessAction.turnLeft => l10n.turnLeftPrompt,
      LivenessAction.turnRight => l10n.turnRightPrompt,
      LivenessAction.smile => l10n.smilePrompt,
      null => l10n.faceKeepStill,
    };
  }

  String _reasonText(AppLocalizations l10n, PoorQualityReason reason) {
    return switch (reason) {
      PoorQualityReason.tooFar => l10n.faceTooFar,
      PoorQualityReason.tooClose => l10n.faceTooClose,
      PoorQualityReason.moveLeft => l10n.faceMoveLeft,
      PoorQualityReason.moveRight => l10n.faceMoveRight,
      PoorQualityReason.moveUp => l10n.faceMoveUp,
      PoorQualityReason.moveDown => l10n.faceMoveDown,
      PoorQualityReason.turned => l10n.faceTurned,
      PoorQualityReason.eyesClosed => l10n.faceEyesClosed,
      PoorQualityReason.lowLight => l10n.faceLowLight,
    };
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.read<FaceCubit>().controller;
    final prompt = _prompt(context.l10n);

    return Stack(
      fit: StackFit.expand,
      children: [
        if (controller != null && controller.value.isInitialized)
          // `CameraCoverBox`: preview'ni CHO'ZMASDAN (aspect-ratio saqlab,
          // ortig'ini kesib) to'liq ekranni qoplaydi — qarang:
          // `_CheckinLiveView.build` (worker-app'dagi bir xil izoh, bir
          // xil sabab: `controller.value.aspectRatio` XOM/landscape,
          // portret ekran uchun inversiya kerak).
          CameraCoverBox(
            aspectRatio: 1 / controller.value.aspectRatio,
            // Faqat DISPLAY qatlami oynalanadi — aniqlash/embedding xom,
            // oynalanmagan kadr ustida ishlaydi (qarang:
            // `MirroredCameraPreview` va `FaceDetectorService` hujjatlari).
            child: MirroredCameraPreview(controller: controller),
          )
        else
          const ColoredBox(color: AppColors.ink),
        // Oval o'rniga haqiqiy yuz-shakl siluet + skaner-chiziq +
        // progress-yo'l; pastdagi ko'rsatma pill'i ([prompt]) ham shu
        // widget ichida chiziladi.
        FaceScanOverlay(
          status: _scanStatus,
          progress: _arcProgress,
          message: prompt,
          messageIcon: _actionIcon,
        ),
        SafeArea(
          child: Column(
            children: [
              const _TopBar(),
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
              context.l10n.faceEnrollTitle,
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
      child: SafeArea(
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
      ),
    );
  }
}

/// Muvaffaqiyat ekrani: yashil halqa + "pop" bilan kattalashuvchi
/// check-belgi + bir martalik chiquvchi (rippling) halqa animatsiyasi va
/// engil taktil signal (`HapticFeedback.mediumImpact()`) — foydalanuvchiga
/// ro'yxatdan o'tish muvaffaqiyatli yakunlanganini "his qildiradi".
class _SuccessView extends StatefulWidget {
  const _SuccessView();

  @override
  State<_SuccessView> createState() => _SuccessViewState();
}

class _SuccessViewState extends State<_SuccessView> {
  @override
  void initState() {
    super.initState();
    // Faqat BIR marta — ekran birinchi qurilganda (holat qayta build
    // bo'lsa ham `initState` qayta chaqirilmaydi).
    unawaited(HapticFeedback.mediumImpact());
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.ink,
      child: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 132,
                height: 132,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Bir martalik "ripple": kengayib, so'nib ketuvchi
                    // yashil halqa — check-belgi ostida porlaydi.
                    Container(
                          width: 96,
                          height: 96,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.fromBorderSide(
                              BorderSide(color: AppColors.success, width: 2.5),
                            ),
                          ),
                        )
                        .animate()
                        .scale(
                          duration: 700.ms,
                          curve: Curves.easeOut,
                          begin: const Offset(0.7, 0.7),
                          end: const Offset(1.45, 1.45),
                        )
                        .fadeOut(duration: 700.ms, curve: Curves.easeOut),
                    // Asosiy: yashil halqa bilan o'ralgan check-belgi,
                    // "pop" (elastik kattalashuv) animatsiyasi bilan.
                    Container(
                          width: 96,
                          height: 96,
                          decoration: BoxDecoration(
                            color: AppColors.success.withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppColors.success,
                              width: 3,
                            ),
                          ),
                          child: const Icon(
                            AppIcons.tick,
                            color: AppColors.success,
                            size: 56,
                          ),
                        )
                        .animate()
                        .scale(
                          duration: 420.ms,
                          curve: Curves.easeOutBack,
                          begin: const Offset(0.6, 0.6),
                          end: const Offset(1, 1),
                        )
                        .fadeIn(),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Text(
                context.l10n.faceEnrollSuccess,
                style: AppTextStyles.h3.copyWith(color: AppColors.surface),
                textAlign: TextAlign.center,
              ).animate(delay: 150.ms).fadeIn(),
            ],
          ),
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
