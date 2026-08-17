import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';

/// [ApplicationStatus]ni rangli chip sifatida ko'rsatadi — ro'yxat
/// kartalari, filtr varag'i va tafsilot sahifasida bir xil rang/yorliq
/// sxemasi bilan ishlatiladi ([colorOf]/[labelOf] shu tufayli ochiq
/// (public) static — boshqa joylarda ham qayta ishlatiladi).
class StatusChip extends StatelessWidget {
  const StatusChip({required this.status, super.key});

  final ApplicationStatus status;

  /// Har bir holat uchun rang — ATAYLAB barchasi turlicha tanlangan
  /// (masalan `javobBerildi` va `yopildi` ikkalasi ham "yakunlangan"ga
  /// o'xshasa-da, foydalanuvchi ikkalasini chipdan bir qarashda ajrata
  /// olishi kerak).
  static Color colorOf(ApplicationStatus status) => switch (status) {
    ApplicationStatus.yangi => AppColors.info,
    ApplicationStatus.jarayonda => AppColors.warning,
    ApplicationStatus.javobBerildi => AppColors.primary,
    ApplicationStatus.yopildi => AppColors.inkMuted,
    ApplicationStatus.rad => AppColors.danger,
  };

  static String labelOf(BuildContext context, ApplicationStatus status) {
    final l10n = context.l10n;
    return switch (status) {
      ApplicationStatus.yangi => l10n.statusYangi,
      ApplicationStatus.jarayonda => l10n.statusJarayonda,
      ApplicationStatus.javobBerildi => l10n.statusJavobBerildi,
      ApplicationStatus.yopildi => l10n.statusYopildi,
      ApplicationStatus.rad => l10n.statusRad,
    };
  }

  @override
  Widget build(BuildContext context) {
    return AppChip(
      label: labelOf(context, status),
      color: colorOf(status),
      filled: true,
    );
  }
}
