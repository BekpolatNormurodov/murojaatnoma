import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/calls/domain/entities/call.dart';
import 'package:worker_app/features/calls/presentation/bloc/call_cubit.dart';
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isMine = message.isMine;
    final call = message.call;
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
