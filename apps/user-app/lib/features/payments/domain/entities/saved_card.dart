import 'package:equatable/equatable.dart';

/// Mock to'lov kartasi tarmog'i (brendi).
enum CardNetwork { uzcard, humo, visa }

/// Fuqaroning saqlangan (mock) to'lov kartasi — FIXED, deterministik
/// balans bilan (hech qachon tasodifiy emas), to'lov sahifasida
/// tanlanadigan karta-tashuvchi sifatida ishlatiladi.
///
/// **Muhim**: [fullNumber] faqat DEMO/mock — hech qachon haqiqiy karta
/// emas, hech qachon backendga uzatilmaydi (mock to'lov oqimi
/// `PaymentsRemoteDataSourceMockImpl` ichida qoladi). Foydalanuvchiga esa
/// har doim faqat [maskedNumber] ko'rsatiladi.
class SavedCard extends Equatable {
  const SavedCard({
    required this.id,
    required this.network,
    required this.fullNumber,
    required this.balance,
    required this.expiry,
  });

  final String id;
  final CardNetwork network;

  /// To'liq (mock) karta raqami — bo'shliqlar bilan formatlangan.
  final String fullNumber;

  /// FIXED mock balans (so'mda) — tasodifiy EMAS, doim shu qiymat.
  final double balance;

  /// `MM/YY` ko'rinishidagi (mock) amal qilish muddati.
  final String expiry;

  String get _digits => fullNumber.replaceAll(RegExp(r'\D'), '');

  /// Karta raqamining oxirgi 4 xonasi.
  String get last4 => _digits.substring(_digits.length - 4);

  /// Ko'rsatish uchun maskalangan raqam — masalan `•••• 0006`.
  String get maskedNumber => '•••• $last4';

  @override
  List<Object?> get props => [id, network, fullNumber, balance, expiry];
}
