/// Sana formatlashda ishlatiladigan o'zbekcha oy qisqartmalari.
const List<String> _months = [
  'Yan',
  'Fev',
  'Mar',
  'Apr',
  'May',
  'Iyn',
  'Iyl',
  'Avg',
  'Sen',
  'Okt',
  'Noy',
  'Dek',
];

/// Sonni minglik xonalar orasiga bo'shliq qo'yib, `so'm` qo'shimchasi
/// bilan formatlaydi. Masalan: `1234567` -> `"1 234 567 so'm"`.
String formatSom(num v) {
  final s = v.round().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return "$b so'm";
}

/// Sanani `'12 Iyn 2026'` ko'rinishida formatlaydi.
String formatDate(DateTime d) => '${d.day} ${_months[d.month - 1]} ${d.year}';

/// Berilgan vaqtdan hozirgi vaqtgacha o'tgan davrni o'zbekcha,
/// inson o'qiy oladigan ko'rinishda qaytaradi.
String timeAgo(DateTime d) {
  final diff = DateTime.now().difference(d);
  if (diff.inMinutes < 1) return 'hozir';
  if (diff.inMinutes < 60) return '${diff.inMinutes} daqiqa oldin';
  if (diff.inHours < 24) return '${diff.inHours} soat oldin';
  return '${diff.inDays} kun oldin';
}
