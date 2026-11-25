/// Kunlik hisobot / hudud vaqti ekranlari uchun sof (Flutter'siz)
/// formatlash yordamchilari — unit testlanadi.
library;

const List<String> _monthsGenitive = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];

const List<String> _weekdays = [
  'dushanba',
  'seshanba',
  'chorshanba',
  'payshanba',
  'juma',
  'shanba',
  'yakshanba',
];

/// Daqiqalarni o'qiladigan matnga: `320` → `5 soat 20 daq`, `45` →
/// `45 daq`, `120` → `2 soat`, `0` (yoki manfiy) → `0 daq`.
String formatMinutes(int minutes) {
  if (minutes <= 0) return '0 daq';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (h == 0) return '$m daq';
  if (m == 0) return '$h soat';
  return '$h soat $m daq';
}

/// Ovoz/video davomiyligi: `65` → `1:05`, `3725` → `1:02:05`.
String formatDurationSec(int seconds) {
  final s = seconds < 0 ? 0 : seconds;
  final h = s ~/ 3600;
  final m = (s % 3600) ~/ 60;
  final sec = (s % 60).toString().padLeft(2, '0');
  if (h > 0) return '$h:${m.toString().padLeft(2, '0')}:$sec';
  return '$m:$sec';
}

/// Fayl hajmi: `512` → `512 B`, `2048` → `2.0 KB`, `5 242 880` → `5.0 MB`.
String formatFileSize(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

/// Soat:daqiqa (`09:05`).
String formatClock(DateTime t) =>
    '${t.hour.toString().padLeft(2, '0')}:'
    '${t.minute.toString().padLeft(2, '0')}';

/// `YYYY-MM-DD` (mahalliy sana).
String ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// `YYYY-MM-DD` → mahalliy yarim tun; parslanmasa `null`.
DateTime? parseYmd(String raw) {
  final parts = raw.split('-');
  if (parts.length != 3) return null;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return null;
  return DateTime(y, m, d);
}

/// Kun sarlavhasi: `Bugun`, `Kecha`, aks holda `23-noyabr, dushanba`.
String formatDayTitle(String day, {DateTime? now}) {
  final date = parseYmd(day);
  if (date == null) return day;
  final today = now ?? DateTime.now();
  final todayDate = DateTime(today.year, today.month, today.day);
  // Soat/24 yaxlitlash — yozgi vaqt o'tishida ham to'g'ri kun farqi.
  final diff = (todayDate.difference(date).inHours / 24).round();
  if (diff == 0) return 'Bugun';
  if (diff == 1) return 'Kecha';
  return formatDayLong(date);
}

/// `23-noyabr, dushanba`.
String formatDayLong(DateTime date) =>
    '${date.day}-${_monthsGenitive[date.month - 1]}, '
    '${_weekdays[date.weekday - 1]}';

/// Qisqa sana (`23-noy`) — kun tanlash chiplari uchun.
String formatDayShort(DateTime date) =>
    '${date.day}-${_monthsGenitive[date.month - 1].substring(0, 3)}';
