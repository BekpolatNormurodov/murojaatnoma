/// `m:ss` ko'rinishidagi davomiylik yorlig'i — yozib olish varag'i/
/// sahifasi hisoblagichi uchun (`AttachmentTile._formatDuration` /
/// `chat_formatters.chatDurationLabel` bilan bir xil format, faqat
/// `Duration` qabul qiladi — jonli hisoblagich shu bilan ishlaydi).
String formatRecordingDuration(Duration duration) {
  final totalSeconds = duration.inSeconds;
  final minutes = totalSeconds ~/ 60;
  final seconds = totalSeconds % 60;
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}
