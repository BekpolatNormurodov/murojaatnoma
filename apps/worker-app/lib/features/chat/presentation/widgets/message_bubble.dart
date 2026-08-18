import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/widgets/chat_formatters.dart';
import 'package:worker_app/features/chat/presentation/widgets/file_bubble.dart';
import 'package:worker_app/features/chat/presentation/widgets/image_bubble.dart';
import 'package:worker_app/features/chat/presentation/widgets/round_video_bubble.dart';
import 'package:worker_app/features/chat/presentation/widgets/sticker_bubble.dart';
import 'package:worker_app/features/chat/presentation/widgets/text_bubble.dart';
import 'package:worker_app/features/chat/presentation/widgets/voice_bubble.dart';

/// Pufakcha ichidagi ASOSIY kontent (matn, ikon, to'lqin-shakli) rangi —
/// mening (yashil-gradient) pufakchamda oq, boshqalarnikida ink/darkInk.
/// Har bir "barg" pufakcha shu yordamchidan foydalanadi, shunda yangi
/// to'ldirishlar ustida matn har doim o'qilaveradi.
Color bubbleContentColor({required bool isMine, required bool isDark}) =>
    isMine ? AppColors.surface : (isDark ? AppColors.darkInk : AppColors.ink);

/// Meta (vaqt/holat) rangi — yashil pufakchada yumshoq oq, boshqalarnikida
/// muted ink.
Color bubbleMetaColor({required bool isMine, required bool isDark}) => isMine
    ? AppColors.surface.withValues(alpha: 0.85)
    : (isDark ? AppColors.darkInkMuted : AppColors.inkMuted);

/// Aksent (play tugmasi, to'lqin-shakli, fayl ikoni) rangi — yashil
/// pufakchada oq, boshqalarnikida brend primary.
Color bubbleAccentColor({required bool isMine, required bool isDark}) =>
    isMine ? AppColors.surface : AppColors.primary;

/// Bitta xabar qatori — `message.isMine` bo'yicha tekislaydi (mine=o'ng,
/// boshqa=chap), guruh/umumiy suhbatlarda kerak bo'lsa yuboruvchi ismini
/// ko'rsatadi, va haqiqiy kontentni `message.type` bo'yicha mos widgetga
/// ("routing") topshiradi — `RequestDetailPage` dagi holat-`switch`iga
/// o'xshash, compiler tomonidan to'liq (exhaustive) tekshiriladigan.
class MessageBubble extends StatelessWidget {
  const MessageBubble({
    required this.message,
    super.key,
    this.showSenderName = false,
    this.firstInGroup = true,
  });

  final Message message;

  /// `true` bo'lsa (guruh/umumiy suhbatda, ketma-ket xabarlar boshqa
  /// yuboruvchidan boshlanganda) bubble ustida yuboruvchi ismi ko'rsatiladi.
  final bool showSenderName;

  /// Ketma-ket bir yuboruvchidan kelgan guruhdagi BIRINCHI xabar bo'lsa
  /// tepada kengroq oraliq (10px), aks holda zich (2px) — Telegram uslubidagi
  /// xabar-guruhlash.
  final bool firstInGroup;

  @override
  Widget build(BuildContext context) {
    final isMine = message.isMine;

    return Padding(
      padding: EdgeInsets.only(top: firstInGroup ? 10 : 2),
      child: Row(
        mainAxisAlignment: isMine
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        children: [
          Flexible(
            child: Column(
              crossAxisAlignment: isMine
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                if (showSenderName && !isMine)
                  Padding(
                    padding: const EdgeInsets.only(left: 12, bottom: 3),
                    child: Text(
                      message.senderName,
                      style: AppTextStyles.caption.copyWith(
                        color: senderNameColor(message.senderId),
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.sizeOf(context).width * 0.76,
                  ),
                  child: switch (message.type) {
                    MessageType.text => TextBubble(message: message),
                    MessageType.image => ImageBubble(message: message),
                    MessageType.file => FileBubble(message: message),
                    MessageType.voice => VoiceBubble(message: message),
                    MessageType.roundVideo => RoundVideoBubble(
                      message: message,
                    ),
                    MessageType.sticker => StickerBubble(message: message),
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Barcha "chrome"li (fon+soyali) xabar turlari uchun umumiy pufakcha
/// qobig'i — matn, rasm, fayl, ovozli xabar.
///
/// Mening xabarlarim — ishonchli yashil gradient (primary→primaryDark),
/// chegarasiz, yumshoq brend-soya bilan; boshqalarniki — toza oq
/// (`surface`) / quyuq (`darkSurfaceAlt`) fonda. Pastki burchaklardan biri
/// "quyruq" effekti uchun kichik radiusga ega (mine=o'ng-past, boshqa=chap-
/// past). Butun kontent [bubbleContentColor] orqali rang oladi.
class BubbleShell extends StatelessWidget {
  const BubbleShell({
    required this.isMine,
    required this.child,
    super.key,
    this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
  });

  final bool isMine;
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    const big = Radius.circular(AppRadii.lg);
    const tail = Radius.circular(6);

    final decoration = isMine
        ? BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.primary, AppColors.primaryDark],
            ),
            borderRadius: const BorderRadius.only(
              topLeft: big,
              topRight: big,
              bottomLeft: big,
              bottomRight: tail,
            ),
            // Yengil, tekis soya — avvalgi qattiq yashil "porlash" (glow)
            // zamonaviy messenjer UI'lariga mos emas edi.
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.10),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          )
        : BoxDecoration(
            color: isDark ? AppColors.darkSurfaceAlt : AppColors.surface,
            borderRadius: const BorderRadius.only(
              topLeft: big,
              topRight: big,
              bottomLeft: tail,
              bottomRight: big,
            ),
            border: isDark
                ? null
                : Border.all(color: AppColors.line.withValues(alpha: 0.5)),
            boxShadow: isDark
                ? null
                : [
                    BoxShadow(
                      color: AppColors.ink.withValues(alpha: 0.06),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
          );

    return Container(padding: padding, decoration: decoration, child: child);
  }
}

/// Xabar vaqti + (mening xabarlarim uchun) yetkazilish holati belgisi
/// ("tick"lar) — har bir bubble turi o'z pastki-o'ng burchagida shu
/// widgetni chizadi.
class MessageMeta extends StatelessWidget {
  const MessageMeta({
    required this.message,
    super.key,
    this.light = false,
    this.onCanvas = false,
  });

  final Message message;

  /// `true` bo'lsa (masalan rasm/doiraviy video ustidagi tiniq-qora scrim)
  /// yorug' (oq) ranglar ishlatiladi.
  final bool light;

  /// `true` bo'lsa pufakchasiz — to'g'ridan-to'g'ri canvas ustida (stiker):
  /// mening xabarim bo'lsa ham oq emas, muted ranglar ishlatiladi.
  final bool onCanvas;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isMine = message.isMine;

    final Color color;
    if (light) {
      color = AppColors.surface.withValues(alpha: 0.9);
    } else if (onCanvas) {
      color = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    } else {
      color = bubbleMetaColor(isMine: isMine, isDark: isDark);
    }

    // "o'qildi" holatidagi yorqin belgi rangi — yashil pufakcha/scrim ustida
    // toza oq, canvas/boshqa fonda esa brend primary.
    final Color readColor;
    if (light) {
      readColor = AppColors.surface;
    } else if (onCanvas) {
      readColor = AppColors.primary;
    } else {
      readColor = isMine ? AppColors.surface : AppColors.primary;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          chatTimeLabel(message.createdAt),
          style: AppTextStyles.caption.copyWith(color: color, fontSize: 11),
        ),
        if (isMine) ...[
          const SizedBox(width: 4),
          _StatusTicks(
            status: message.status,
            color: color,
            readColor: readColor,
          ),
        ],
      ],
    );
  }
}

/// Toza yetkazilish indikatori (Telegram/iMessage uslubida) — Material
/// `done`/`done_all` belgilariga tayanadi:
/// * `yuborilmoqda` — kichik aylanma progres;
/// * `yuborildi` — bitta belgi;
/// * `yetkazildi` — qo'sh belgi (meta rangida);
/// * `oqildi` — qo'sh belgi, yorqin ([readColor]).
class _StatusTicks extends StatelessWidget {
  const _StatusTicks({
    required this.status,
    required this.color,
    required this.readColor,
  });

  final MessageStatus status;
  final Color color;
  final Color readColor;

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case MessageStatus.yuborilmoqda:
        return SizedBox(
          width: 11,
          height: 11,
          child: CircularProgressIndicator(
            strokeWidth: 1.6,
            valueColor: AlwaysStoppedAnimation(color),
          ),
        );
      case MessageStatus.yuborildi:
        return Icon(Icons.done, size: 15, color: color);
      case MessageStatus.yetkazildi:
        return Icon(Icons.done_all, size: 15, color: color);
      case MessageStatus.oqildi:
        return Icon(Icons.done_all, size: 15, color: readColor);
    }
  }
}
