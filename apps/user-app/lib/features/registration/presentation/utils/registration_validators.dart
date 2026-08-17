import 'package:flutter/material.dart';

/// `RegistrationPage`ning maydon-validatsiya sof funksiyalari — Flutter
/// widget daraxtidan mustaqil, shuning uchun alohida ham oson
/// tekshiriladi (`resolveAuthRedirect` bilan bir xil "sof funksiya" falsafa).
///
/// F.I.Sh. — kamida 2 ta so'z (Familiya + Ism, Sharifsiz ham bo'lishi
/// mumkin), umumiy uzunlik kamida 3 belgi.
bool isValidFullName(String value) {
  final trimmed = value.trim();
  if (trimmed.length < 3) return false;
  final words = trimmed
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .toList();
  return words.length >= 2;
}

/// JSHSHIR (PINFL) — aynan 14 ta raqam.
bool isValidPinfl(String value) => RegExp(r'^\d{14}$').hasMatch(value.trim());

/// Pasport seriya + raqami — 2 ta lotin harfi + 7 ta raqam (masalan
/// `AA1234567`). `PassportInputFormatter` allaqachon shu shaklni
/// kiritishda majburlaydi — bu tekshiruv qo'shimcha kafolat (masalan
/// dastur orqali/qo'lda `controller.text` o'rnatilgan holatlar uchun).
bool isValidPassport(String value) =>
    RegExp(r'^[A-Z]{2}\d{7}$').hasMatch(value.trim());

/// Manzil — kamida 5 ta belgidan iborat erkin matn.
bool isValidAddress(String value) => value.trim().length >= 5;

/// Eng qadimgi ruxsat etilgan tug'ilgan yil (ma'noli oralig'ni saqlash
/// uchun, masalan tasodifiy `0001` yilini rad etish).
const _minBirthYear = 1900;

/// `DD.MM.YYYY` matnini haqiqiy taqvim sanasiga aylantiradi; format
/// noto'g'ri, sana mavjud bo'lmasa (masalan 31.02.*) yoki kelajakdagi/juda
/// eski sana bo'lsa `null` qaytaradi.
///
/// `DateTime(year, month, day)` konstruktori haddan tashqari kunni
/// (masalan 31-fevral) JIMgina keyingi oyga "normallashtiradi" — shu
/// tufayli kun/oy chegarasi `DateUtils.getDaysInMonth` bilan QO'LDA
/// tekshiriladi, konstruktorning o'ziga ishonilmaydi.
DateTime? parseBirthDate(String value) {
  final match = RegExp(r'^(\d{2})\.(\d{2})\.(\d{4})$').firstMatch(value);
  if (match == null) return null;

  final day = int.parse(match.group(1)!);
  final month = int.parse(match.group(2)!);
  final year = int.parse(match.group(3)!);

  if (year < _minBirthYear) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > DateUtils.getDaysInMonth(year, month)) return null;

  final date = DateTime(year, month, day);
  final today = DateTime.now();
  final todayDateOnly = DateTime(today.year, today.month, today.day);
  if (date.isAfter(todayDateOnly)) return null;

  return date;
}
