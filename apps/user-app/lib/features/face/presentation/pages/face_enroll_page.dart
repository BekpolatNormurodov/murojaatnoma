import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/face/presentation/bloc/face_cubit.dart';
import 'package:user_app/features/face/presentation/widgets/mirrored_camera_preview.dart';

/// Birinchi marta yuzni ro'yxatdan o'tkazish (identity enrollment)
/// sahifasi — telefon/SMS tasdiqlangandan keyingi Faza 3 oqimining
/// ikkinchi bosqichi (`/face/onboarding`).
///
/// `worker_app/features/face/presentation/pages/face_enroll_page.dart`
/// bilan bir xil naqsh (liveness/check-in holatlarisiz — `FaceState` bu
/// yerda faqat enrollment-qismini o'z ichiga oladi, shuning uchun
/// `switch` tabiiy ravishda to'liq).
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
    unawaited(context.read<FaceCubit>().startCamera());
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

  /// Muvaffaqiyat animatsiyasi ko'rsatilgach fuqaroni PIN o'rnatish
  /// bosqichiga o'tkazadi.
  ///
  /// `AuthCubit.markFaceEnrolled()` ATAYLAB shu yerda, KECHIKTIRILGAN
  /// holda chaqiriladi (darhol emas): u `AuthState.faceEnrolled`ni
  /// `true`ga o'rnatadi, bu esa router'ning `refreshListenable`ini
  /// ishga tushiradi va `resolveAuthRedirect` DARHOL `/pin/set`ga
  /// yo'naltiradi (qat'iy "bitta holat — bitta to'g'ri ekran" siyosati,
  /// qarang: `redirect_policy.dart`) — agar `markFaceEnrolled()` kechik-
  /// tirilmasa, muvaffaqiyat animatsiyasi (`_SuccessView`) hech qachon
  /// ko'rinmay, ekran zumda almashib qolar edi. Kechikishdan keyingi
  /// aniq `context.go('/pin/set')` esa qo'shimcha kafolat (redundant,
  /// lekin zararsiz) — avtomatik redirect allaqachon o'sha manzilga
  /// yo'naltirgan bo'ladi.
  Future<void> _proceedToPinSetup() async {
    await Future<void>.delayed(const Duration(milliseconds: 1400));
    if (!mounted) return;
    context.read<AuthCubit>().markFaceEnrolled();
    if (!mounted) return;
    context.go('/pin/set');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ink,
      body: BlocConsumer<FaceCubit, FaceState>(
        listener: (context, state) {
          if (state is FaceCapturing) {
            // Suratga olish boshlanishi — "shutter" taassurotini beruvchi
            // qisqa haptik (bir martalik, chunki `FaceCapturing` faqat
            // sifat-gate barqaror bo'lgach BIR marta emitlanadi).
            unawaited(HapticFeedback.mediumImpact());
          } else if (state is FaceSuccess) {
            unawaited(HapticFeedback.lightImpact());
            unawaited(_proceedToPinSetup());
          }
        },
        builder: (context, state) => _FaceEnrollBody(state: state),
      ),
    );
  }
}

/// Joriy `FaceState`ga mos to'liq-ekran ko'rinishni tanlaydi — sealed
/// `switch` orqali compiler barcha holatlar qamrab olinganini tekshiradi.
class _FaceEnrollBody extends StatelessWidget {
  const _FaceEnrollBody({required this.state});

  final FaceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    // Butun ekran-darajasidagi holatlar (yuklanish/jonli skaner/muvaffaqiyat/
    // xato) orasida yumshoq o'tish — `AnimatedSwitcher` standart
    // `FadeTransition`i. `_LiveGateView` BIR XIL widget turi bo'lgani uchun
    // (barcha `searching`/`poorQuality`/`aligning`/`capturing`/`embedding`/
    // `enrolling` bir xil `_LiveGateView` klassiga xaritalanadi, kalitsiz)
    // ICHKI sifat-gate holatlari orasida bu o'tish HECH QANDAY qo'shimcha
    // animatsiya QO'SHMAYDI (`Widget.canUpdate` bir xil turdagi ikkita
    // kalitsiz widget'ni "bir xil" deb hisoblaydi) — faqat kamera oldida
    // FaceScanOverlay'ning o'z silliq animatsiyalari davom etadi. Faqat
    // widget TURI o'zgarganda (masalan `_LoadingView` -> `_LiveGateView`
    // yoki `_LiveGateView` -> `_SuccessView`/`_MessageView`) haqiqiy
    // krossfeyd sodir bo'ladi.
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 320),
      switchInCurve: Curves.easeOut,
      switchOutCurve: Curves.easeIn,
      child: switch (state) {
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
        FacePoorQuality() ||
        FaceAligning() ||
        FaceCapturing() ||
        FaceEmbedding() ||
        FaceEnrolling() => _LiveGateView(state: state),
      },
    );
  }
}

/// Kamera oldida premium yuz-shakl skaner (`FaceScanOverlay`, app_ui) bilan
/// jonli sifat-gate ko'rinishi — `searching`, `poorQuality`, `aligning`,
/// `capturing`, `embedding`, `enrolling` holatlari uchun umumiy full-bleed
/// kamera qatlami.
///
/// `worker_app/features/face/presentation/pages/face_enroll_page.dart`ning
/// `_LiveGateView`i bilan BIR XIL naqsh (ilgarigi `FaceOvalOverlay` o'rniga)
/// — silliq rang/progress animatsiyalari va yo'naltiruvchi ko'rsatma-pill
/// endi `FaceScanOverlay`ning o'zida (ko'rinish bu yerda faqat holatni
/// mos `FaceScanStatus`/progress/matnga xaritalaydi).
class _LiveGateView extends StatelessWidget {
  const _LiveGateView({required this.state});

  final FaceState state;

  /// `FaceState` -> `FaceScanOverlay.status`. Guruhlash worker_app bilan
  /// bir xil rang mantig'i: `poorQuality` -> `error`, faol jarayon
  /// (aligning/capturing/embedding/enrolling) -> `aligning`/`capturing`,
  /// kutish -> `searching`.
  FaceScanStatus get _scanStatus => switch (state) {
    FacePoorQuality() => FaceScanStatus.error,
    FaceAligning() => FaceScanStatus.aligning,
    FaceCapturing() ||
    FaceEmbedding() ||
    FaceEnrolling() => FaceScanStatus.capturing,
    _ => FaceScanStatus.searching,
  };

  double get _arcProgress => switch (state) {
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
    FacePoorQuality(:final reason) => _reasonText(l10n, reason),
    FaceAligning() => l10n.faceKeepStill,
    FaceCapturing() => l10n.faceCapturingStatus,
    FaceEmbedding() => l10n.faceEmbeddingStatus,
    FaceEnrolling() => l10n.faceEnrollingStatus,
    _ => l10n.faceHoldStill,
  };

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
          // `CameraCoverBox`: preview'ni cho'zmasdan (aspect-ratio saqlab)
          // to'liq ekranni qoplaydi — worker_app'dagi bir xil naqsh, bir
          // xil sabab (`controller.value.aspectRatio` xom/landscape,
          // portret ekran uchun inversiya kerak).
          CameraCoverBox(
            aspectRatio: 1 / controller.value.aspectRatio,
            // Faqat DISPLAY qatlami oynalanadi — aniqlash/embedding xom,
            // oynalanmagan kadr ustida ishlaydi.
            child: MirroredCameraPreview(controller: controller),
          )
        else
          const ColoredBox(color: AppColors.ink),
        // Oval o'rniga haqiqiy yuz-shakl siluet + skaner-chiziq +
        // progress-yo'l; pastdagi ko'rsatma pill'i ([prompt]) ham shu
        // widget ichida chiziladi (worker_app bilan bir xil premium
        // ko'rinish).
        FaceScanOverlay(
          status: _scanStatus,
          progress: _arcProgress,
          message: prompt,
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

class _SuccessView extends StatelessWidget {
  const _SuccessView();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.ink,
      child: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      AppIcons.tick,
                      color: AppColors.primary,
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ColoredBox(
      // Bu — oddiy xabar ekrani (ruxsat rad etilgan/kamera-model xatosi),
      // kamera scrim EMAS — shuning uchun (fayldagi qolgan `AppColors.ink`/
      // `AppColors.surface` foydalanishlaridan farqli) tema bilan mos
      // fonda bo'lishi kerak.
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
