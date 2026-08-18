import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/presentation/widgets/meeting_status_chip.dart';

/// `Meeting.startAt` kabi ISO sana-vaqt satrini soat:daqiqasi bilan birga
/// inson o'qiy oladigan ko'rinishga o'giradi; parslab bo'lmasa xom satrni
/// qaytaradi (`formatIsoDateTime` — `requests` moduli, `application_card.
/// dart` — bilan bir xil naqsh, mock ma'lumotlar doim to'g'ri formatda,
/// lekin himoya sifatida).
String formatMeetingDateTime(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  final hh = parsed.hour.toString().padLeft(2, '0');
  final mm = parsed.minute.toString().padLeft(2, '0');
  return '${formatDate(parsed)}, $hh:$mm';
}

/// Ro'yxatdagi bitta majlis kartasi — sarlavha, tashkilotchi, vaqt, holat
/// chipi ([MeetingStatusChip]) va (jonli/rejalashtirilgan bo'lsa) tezkor
/// "Ulanish" belgisi.
///
/// Butun karta bosiladigan (tafsilotlar sahifasiga o'tadi); "Ulanish"
/// belgisi ham AYNAN SHU manzilga o'tadi (haqiqiy `join()` chaqiruvi va
/// "Zoom-style ulanmoqda" oqimi tafsilotlar sahifasida, bitta joyda,
/// `MeetingDetailCubit` orqali boshqariladi — ro'yxat va tafsilot
/// o'rtasida holat ikki marta takrorlanmaydi).
class MeetingCard extends StatelessWidget {
  const MeetingCard({required this.meeting, super.key, this.onTap});

  final Meeting meeting;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    // Kelajakdagi "rejalashtirilgan" majlisda faol "Ulanish" ko'rsatilmaydi —
    // faqat JONLI, yoki boshlanish vaqti kelgan majlisga ulanish mumkin.
    final startAt = DateTime.tryParse(meeting.startAt);
    final hasStarted = startAt != null && !startAt.isAfter(DateTime.now());
    final canJoin =
        meeting.status == MeetingStatus.jonli ||
        (meeting.status == MeetingStatus.rejalashtirilgan && hasStarted);

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  meeting.title,
                  style: AppTextStyles.bodyStrong,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 10),
              MeetingStatusChip(status: meeting.status),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(AppIcons.profile, size: 14, color: inkSoft),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  meeting.host,
                  style: AppTextStyles.caption.copyWith(color: inkSoft),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(AppIcons.calendar, size: 14, color: inkMuted),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  formatMeetingDateTime(meeting.startAt),
                  style: AppTextStyles.caption.copyWith(color: inkMuted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (canJoin) ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: AppChip(
                label: l10n.meetingJoinShortCta,
                icon: AppIcons.video,
                filled: true,
                onTap: onTap,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
