import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/calls/domain/entities/call.dart';
import 'package:worker_app/features/calls/presentation/bloc/call_cubit.dart';
import 'package:worker_app/features/calls/presentation/bloc/meeting_cubit.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/widgets/chat_formatters.dart';
import 'package:worker_app/features/chat/presentation/widgets/message_bubble.dart';

/// Suhbat tarixidagi qo'ng'iroq yozuvi (Telegram uslubida) — server admin
/// bilan qo'ng'iroq tugaganda DM'ga `kind: call` xabar yozadi.
///
/// Yo'nalish xodim nuqtai nazaridan: o'zi qilgan bo'lsa "Chiquvchi", admin
/// qilgan bo'lsa "Kiruvchi"; javobsizlari qizil. Bosilsa — o'sha turdagi
/// (ovozli/video) qo'ng'iroq bilan qayta qo'ng'iroq qilinadi.
class CallBubble extends StatelessWidget {
  const CallBubble({required this.message, super.key});

  final Message message;

  String _title() {
    final call = message.call;
    final what = (call?.video ?? false) ? "video qo'ng'iroq" : "qo'ng'iroq";
    final mine = message.isMine;
    switch (call?.status) {
      case 'missed' || 'cancelled' || 'busy':
        return mine ? 'Javobsiz $what' : "O'tkazib yuborilgan $what";
      case 'rejected':
        return mine ? 'Rad etilgan $what' : 'Rad etildi — $what';
      default:
        return mine ? 'Chiquvchi $what' : 'Kiruvchi $what';
    }
  }

  static String _duration(int sec) {
    final m = sec ~/ 60;
    final s = (sec % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  void _callBack(BuildContext context) {
    if (AppConfig.useMock) return;
    final video = message.call?.video ?? false;
    unawaited(
      context.read<CallCubit>().startCall(
        toUserId: 'me',
        toName: "Ma'muriyat",
        media: video ? CallMedia.video : CallMedia.audio,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final call = message.call;
    if (call != null && call.isMeeting) return _MeetingCard(call: call);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isMine = message.isMine;
    final failed = call?.unanswered ?? false;
    final content = bubbleContentColor(isMine: isMine, isDark: isDark);
    final meta = bubbleMetaColor(isMine: isMine, isDark: isDark);
    final iconColor = failed
        ? (isMine ? AppColors.surface : AppColors.danger)
        : bubbleAccentColor(isMine: isMine, isDark: isDark);
    final icon = failed
        ? IconsaxPlusLinear.call_slash
        : (call?.video ?? false)
        ? IconsaxPlusLinear.video
        : isMine
        ? IconsaxPlusLinear.call_outgoing
        : IconsaxPlusLinear.call_incoming;
    final durationSec = call?.durationSec ?? 0;

    return Semantics(
      button: true,
      label: '${_title()}, qayta qo\'ng\'iroq qilish',
      child: BubbleShell(
        isMine: isMine,
        child: InkWell(
          onTap: () => _callBack(context),
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: iconColor.withValues(alpha: isMine ? 0.18 : 0.12),
                ),
                child: Icon(icon, size: 20, color: iconColor),
              ),
              const SizedBox(width: 12),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _title(),
                      style: AppTextStyles.bodyStrong.copyWith(
                        color: failed && !isMine ? AppColors.danger : content,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        chatTimeLabel(message.createdAt),
                        if (durationSec > 0) _duration(durationSec),
                      ].join(' · '),
                      style: AppTextStyles.caption.copyWith(color: meta),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Umumiy chatdagi guruh qo'ng'irog'i e'loni: jonli bo'lsa "Qo'shilish",
/// tugagan bo'lsa davomiyligi.
class _MeetingCard extends StatelessWidget {
  const _MeetingCard({required this.call});

  final CallInfo call;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final live = call.meetingLive;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final muted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final m = call.durationSec ~/ 60;
    final s = (call.durationSec % 60).toString().padLeft(2, '0');
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
      decoration: BoxDecoration(
        color: live
            ? AppColors.primary.withValues(alpha: isDark ? 0.18 : 0.08)
            : (isDark ? AppColors.darkSurface : AppColors.surface),
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
          color: live
              ? AppColors.primary.withValues(alpha: 0.4)
              : (isDark ? AppColors.darkLine : AppColors.line),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: live
                  ? AppColors.primary
                  : muted.withValues(alpha: 0.15),
            ),
            child: Icon(
              call.video ? IconsaxPlusBold.video : IconsaxPlusBold.call,
              size: 20,
              color: live ? Colors.white : muted,
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  call.title ?? "Guruh qo'ng'irog'i",
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyStrong.copyWith(color: ink),
                ),
                const SizedBox(height: 2),
                Text(
                  live
                      ? "${call.hostName ?? "Ma'muriyat"} boshladi · jonli"
                      : 'Tugadi${call.durationSec > 0 ? ' · $m:$s' : ''}',
                  style: AppTextStyles.caption.copyWith(color: muted),
                ),
              ],
            ),
          ),
          if (live) ...[
            const SizedBox(width: 10),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                minimumSize: const Size(0, 38),
              ),
              onPressed: AppConfig.useMock
                  ? null
                  : () => unawaited(
                      context.read<MeetingCubit>().join(
                        meetingId: call.meetingId!,
                        title: call.title ?? "Guruh qo'ng'irog'i",
                        video: call.video,
                        hostName: call.hostName ?? '',
                      ),
                    ),
              child: const Text("Qo'shilish"),
            ),
          ],
        ],
      ),
    );
  }
}
