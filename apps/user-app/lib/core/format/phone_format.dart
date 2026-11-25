/// `+998901234567` → `+998 90 123 45 67`. O'zbek raqami bo'lmagan yoki
/// raqam bo'lmagan matn (masalan ism) o'zgarishsiz qaytadi.
String formatPhone(String raw) {
  final compact = raw.replaceAll(' ', '');
  final m = RegExp(r'^\+998(\d{2})(\d{3})(\d{2})(\d{2})$').firstMatch(compact);
  if (m == null) return raw;
  return '+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}';
}
