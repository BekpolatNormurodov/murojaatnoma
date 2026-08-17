import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';

/// [RequestStatus]ni rangli chip sifatida ko'rsatadi — ro'yxat kartalari,
/// filtr varag'i va tafsilot sahifasida bir xil rang/yorliq sxemasi bilan
/// ishlatiladi ([colorOf]/[labelOf] shu tufayli ochiq (public) static —
/// boshqa joylarda ham qayta ishlatiladi).
class RequestStatusChip extends StatelessWidget {
  const RequestStatusChip({required this.status, super.key});

  final RequestStatus status;

  static Color colorOf(RequestStatus status) => switch (status) {
    RequestStatus.yuborilgan => AppColors.info,
    RequestStatus.korilmoqda => AppColors.warning,
    RequestStatus.javobBerildi => AppColors.primary,
    RequestStatus.yopildi => AppColors.inkMuted,
  };

  static String labelOf(BuildContext context, RequestStatus status) {
    final l10n = context.l10n;
    return switch (status) {
      RequestStatus.yuborilgan => l10n.citizenRequestStatusYuborilgan,
      RequestStatus.korilmoqda => l10n.citizenRequestStatusKorilmoqda,
      RequestStatus.javobBerildi => l10n.citizenRequestStatusJavobBerildi,
      RequestStatus.yopildi => l10n.citizenRequestStatusYopildi,
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
