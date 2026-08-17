/// Xodimning "Javob so'rash" (ish vaqtidan ozod bo'lish/ta'til) so'rovi
/// uchun muddat turi.
enum LeaveDurationType { hours, days }

/// [LeaveDurationType]ga bog'liq sof (context'siz, side-effect'siz)
/// validatsiya va chegara hisob-kitoblari — `LeaveRequestPage` UI'siz ham
/// birlik (unit) testlash mumkin.
///
/// Talab qilingan qoida: maksimal — 1 ish haftasi (6 ish kuni). Kunlab
/// so'ralganda to'g'ridan-to'g'ri kun soni cheklanadi ([maxDays]),
/// soatlab so'ralganda esa bitta kun ichidagi soat soni cheklanadi
/// ([maxHoursPerDay] — standart ish kuni davomiyligi).
class LeaveRequestValidation {
  LeaveRequestValidation._();

  /// Har ikkala turi uchun ham minimal miqdor.
  static const int minAmount = 1;

  /// "Kunlab" turi uchun maksimal kun soni (1 ish haftasi).
  static const int maxDays = 6;

  /// "Soatlab" turi uchun maksimal soat soni (bitta ish kuni).
  static const int maxHoursPerDay = 8;

  /// Berilgan [type] uchun ruxsat etilgan maksimal miqdor.
  static int maxAmount(LeaveDurationType type) =>
      type == LeaveDurationType.days ? maxDays : maxHoursPerDay;

  /// [amount]ni [type] uchun ruxsat etilgan oraliqqa ([minAmount]..
  /// [maxAmount]) siqib qaytaradi — stepper hech qachon chegaradan
  /// chiqmasligi uchun.
  static int clamp(int amount, LeaveDurationType type) =>
      amount.clamp(minAmount, maxAmount(type));

  /// Sabab matni bo'sh (yoki faqat probel) bo'lsa `false`.
  static bool isReasonValid(String reason) => reason.trim().isNotEmpty;
}
