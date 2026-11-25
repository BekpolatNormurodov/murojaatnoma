/// Biriktirma chegaralari.
///
/// Server va nginx 25 MB qabul qiladi; nginx multipart sarlavhalarini ham
/// hisoblagani uchun mijoz chegarasi biroz past.
const int kMaxUploadBytes = 25 * 1024 * 1024 - 64 * 1024;

/// Ilovada yoziladigan videoning eng katta davomiyligi — quyidagi
/// bitreytlarda ~18 MB.
const Duration kMaxVideoRecording = Duration(seconds: 90);
/// Ovozli yozuvning eng katta davomiyligi — quyidagi bitreytda ~15 MB.
const Duration kMaxVoiceRecording = Duration(minutes: 20);
const int kVideoBitrate = 1500000;
const int kAudioBitrate = 96000;

const String kFileTooLargeMessage = 'Fayl hajmi 25 MB dan oshmasligi kerak';
