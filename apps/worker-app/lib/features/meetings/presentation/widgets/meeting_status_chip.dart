import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';

/// [MeetingStatus]ni rangli chip sifatida ko'rsatadi — ro'yxat kartalari va
/// tafsilot sahifasida bir xil rang/yorliq sxemasi bilan ishlatiladi
/// (`StatusChip` — `requests` moduli — bilan bir xil naqsh: [colorOf]/
/// [labelOf] shu tufayli ochiq (public) static).
class MeetingStatusChip extends StatelessWidget {
  const MeetingStatusChip({required this.status, super.key});

  final MeetingStatus status;

  /// Har bir holat uchun rang. `jonli` — universal "LIVE" konvensiyasi
  /// bo'yicha qizil (diqqat tortish uchun); `rejalashtirilgan` — ko'k
  /// (`ApplicationStatus.yangi` bilan bir xil semantika); `tugagan` — xira
  /// kulrang (`ApplicationStatus.yopildi` bilan bir xil semantika).
  static Color colorOf(MeetingStatus status) => switch (status) {
    MeetingStatus.rejalashtirilgan => AppColors.info,
    MeetingStatus.jonli => AppColors.danger,
    MeetingStatus.tugagan => AppColors.inkMuted,
  };

  static String labelOf(BuildContext context, MeetingStatus status) {
    final l10n = context.l10n;
    return switch (status) {
      MeetingStatus.rejalashtirilgan => l10n.meetingStatusScheduled,
      MeetingStatus.jonli => l10n.meetingStatusLive,
      MeetingStatus.tugagan => l10n.meetingStatusEnded,
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
