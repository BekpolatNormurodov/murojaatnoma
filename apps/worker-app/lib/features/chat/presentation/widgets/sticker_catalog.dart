/// Ilova ichidagi tayyor stiker to'plami — `stickerId -> emoji`.
///
/// Haqiqiy stiker rasm-assetlari hali ulanmagan (Vazifa doirasida shart
/// emas) — shuning uchun har bir stiker katta emoji sifatida chiziladi
/// (`StickerBubble`da ham, yuborish varag'idagi tanlov to'rida ham — bitta
/// markazlashtirilgan xarita, ikkalasi ham shu yerdan o'qiydi).
const Map<String, String> stickerCatalog = {
  'ok_thumb': '👍',
  'heart': '❤️',
  'smile': '😊',
  'laugh': '😂',
  'clap': '👏',
  'fire': '🔥',
  'thanks': '🙏',
  'party': '🎉',
  'salute': '🫡',
  'sad': '😔',
  'check': '✅',
  'question': '❓',
};

/// Berilgan [stickerId] uchun emoji — ro'yxatda topilmasa neytral
/// ("noma'lum stiker") emoji qaytaradi.
String stickerEmoji(String? stickerId) => stickerCatalog[stickerId] ?? '🙂';
