import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/widgets.dart';

/// `HH:mm` ko'rinishidagi vaqt — xabar pufakchalari uchun (Telegram/
/// WhatsApp uslubida, har doim soat:daqiqa, kunidan qat'i nazar).
/// Parslab bo'lmasa xom satrni qaytaradi (mock ma'lumotlar doim to'g'ri
/// formatda, lekin himoya sifatida).
String chatTimeLabel(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  final hh = parsed.hour.toString().padLeft(2, '0');
  final mm = parsed.minute.toString().padLeft(2, '0');
  return '$hh:$mm';
}

/// Suhbatlar ro'yxati qatori uchun vaqt — bugungi xabarlar uchun
/// `HH:mm`, avvalgi kunlar uchun qisqa sana (`formatDate`).
String conversationTimeLabel(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  final now = DateTime.now();
  final sameDay =
      parsed.year == now.year &&
      parsed.month == now.month &&
      parsed.day == now.day;
  return sameDay ? chatTimeLabel(iso) : formatDate(parsed);
}

/// Ikki ISO vaqt-tamg'asi bir XIL taqvim kuniga tegishlimi? Suhbat ichida
/// sana ajratgichlarini ko'rsatish va xabarlarni kun bo'yicha guruhlash
/// uchun ishlatiladi. [a] `null` (birinchi xabar) bo'lsa `false`.
bool chatSameDay(String? a, String b) {
  if (a == null) return false;
  final pa = DateTime.tryParse(a);
  final pb = DateTime.tryParse(b);
  if (pa == null || pb == null) return false;
  return pa.year == pb.year && pa.month == pb.month && pa.day == pb.day;
}

/// Suhbat ichidagi sana ajratgichi yorlig'i — bugun uchun "Bugun", kecha
/// uchun "Kecha", aks holda qisqa sana (`formatDate`). Yangi l10n
/// kalitlaridan (`chatDateToday`/`chatDateYesterday`) foydalanadi.
String chatDateSeparatorLabel(BuildContext context, String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  final now = DateTime.now();
  final messageDay = DateTime(parsed.year, parsed.month, parsed.day);
  final today = DateTime(now.year, now.month, now.day);
  final diffDays = today.difference(messageDay).inDays;
  if (diffDays == 0) return context.l10n.chatDateToday;
  if (diffDays == 1) return context.l10n.chatDateYesterday;
  return formatDate(parsed);
}

/// Millisekundlarni `m:ss` ko'rinishiga o'giradi — ovozli xabar/doiraviy
/// video davomiyligi uchun.
String chatDurationLabel(int ms) {
  final totalSeconds = (ms / 1000).round();
  final minutes = totalSeconds ~/ 60;
  final seconds = totalSeconds % 60;
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}

/// Guruh/umumiy suhbatlarda yuboruvchi ismi ustidagi yorliq rangi —
/// `senderId` bo'yicha barqaror (har safar bir xil ishtirokchi bir xil
/// rangda ko'rinadi), kichik sobit palitradan tanlanadi. Faqat
/// `AppColors`dan foydalanadi — qattiq kodlangan rang yo'q.
Color senderNameColor(String senderId) {
  const palette = [
    AppColors.primary,
    AppColors.accent,
    AppColors.warning,
    AppColors.info,
    AppColors.primaryDark,
    AppColors.accentDark,
  ];
  return palette[senderId.hashCode.abs() % palette.length];
}
