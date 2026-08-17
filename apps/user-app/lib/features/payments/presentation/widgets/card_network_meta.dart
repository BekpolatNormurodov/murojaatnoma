import 'package:flutter/widgets.dart';
import 'package:user_app/features/payments/domain/entities/saved_card.dart';

/// [CardNetwork] uchun brend nomi/rangi/gradienti — saqlangan kartalar
/// karuselida va tanlangan karta xulosasida bir xil vizual tilni
/// ta'minlash uchun markazlashtirilgan.
///
/// Brend nomlari ("Uzcard", "Humo", "Visa") atayin tarjima qilinmaydi —
/// bular xalqaro/lokal savdo belgilari (proper noun), boshqa tillarda ham
/// o'zgarmaydi.
abstract class CardNetworkMeta {
  static String label(CardNetwork network) => switch (network) {
    CardNetwork.uzcard => 'Uzcard',
    CardNetwork.humo => 'Humo',
    CardNetwork.visa => 'Visa',
  };

  static LinearGradient gradient(CardNetwork network) => switch (network) {
    CardNetwork.uzcard => const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xFF1D4ED8), Color(0xFF3B82F6)],
    ),
    CardNetwork.humo => const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xFF047857), Color(0xFF10B981)],
    ),
    CardNetwork.visa => const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xFF1E293B), Color(0xFF475569)],
    ),
  };
}
