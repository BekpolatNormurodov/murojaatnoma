// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Uzbek (`uz`).
class AppLocalizationsUz extends AppLocalizations {
  AppLocalizationsUz([String locale = 'uz']) : super(locale);

  @override
  String get appName => 'Hokimiyat';

  @override
  String get splashTagline => 'Raqamli boshqaruv platformasi';

  @override
  String get login => 'Kirish';

  @override
  String get phoneNumber => 'Telefon raqamingiz';

  @override
  String get sendCode => 'Kodni yuborish';

  @override
  String get enterCode => 'Kodni kiriting';

  @override
  String get faceEnrollTitle => 'Yuzingizni ro\'yxatdan o\'tkazing';

  @override
  String get faceCheckinTitle => 'Yuz bilan tasdiqlash';

  @override
  String get faceHoldStill => 'Yuzingizni ovalga joylang';

  @override
  String get blinkPrompt => 'Ko\'zingizni pirpiratng';

  @override
  String get turnLeftPrompt => 'Boshingizni chapga buring';

  @override
  String get turnRightPrompt => 'Boshingizni o\'ngga buring';

  @override
  String get smilePrompt => 'Jilmaying';

  @override
  String get faceInitializing => 'Kamera tayyorlanmoqda…';

  @override
  String get facePermissionTitle => 'Kameraga ruxsat kerak';

  @override
  String get faceCameraPermissionMessage =>
      'Yuzingizni ro\'yxatdan o\'tkazish uchun kameradan foydalanishga ruxsat bering';

  @override
  String get faceGrantPermission => 'Ruxsat berish';

  @override
  String get faceOpenSettings => 'Sozlamalarni ochish';

  @override
  String get faceCameraErrorTitle => 'Kamera xatosi';

  @override
  String get faceCameraErrorMessage => 'Kamerani ishga tushirib bo\'lmadi';

  @override
  String get faceModelErrorTitle => 'Model xatosi';

  @override
  String get faceModelErrorMessage => 'Yuz tanish modelini yuklab bo\'lmadi';

  @override
  String get retry => 'Qayta urinish';

  @override
  String get faceTooFar => 'Yaqinroq keling';

  @override
  String get faceTooClose => 'Uzoqroq suriling';

  @override
  String get faceMoveLeft => 'Chaproq suriling';

  @override
  String get faceMoveRight => 'O\'ngroq suriling';

  @override
  String get faceMoveUp => 'Teparoq suriling';

  @override
  String get faceMoveDown => 'Pastroq suriling';

  @override
  String get faceTurned => 'Boshingizni to\'g\'ri tuting';

  @override
  String get faceEyesClosed => 'Ko\'zingizni oching';

  @override
  String get faceLowLight => 'Yorug\'roq joyga o\'ting';

  @override
  String get faceKeepStill => 'Ajoyib! Harakatsiz turing';

  @override
  String get faceCapturingStatus => 'Suratga olinmoqda…';

  @override
  String get faceEmbeddingStatus => 'Qayta ishlanmoqda…';

  @override
  String get faceEnrollingStatus => 'Saqlanmoqda…';

  @override
  String get faceEnrollSuccess => 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz!';

  @override
  String get faceErrorTitle => 'Xatolik';

  @override
  String get faceCheckinCameraPermissionMessage =>
      'Davomatni belgilash uchun kameradan foydalanishga ruxsat bering';

  @override
  String get faceVerifyingStatus => 'Tekshirilmoqda…';

  @override
  String get faceCheckingInStatus => 'Davomat yozilmoqda…';

  @override
  String get faceCheckinTimeLabel => 'Belgilangan vaqt';

  @override
  String get faceCheckinDone => 'Ajoyib! Bugungi davomatingiz qayd etildi.';

  @override
  String get faceContinue => 'Davom etish';

  @override
  String get faceCheckoutTitle => 'Ishdan chiqish';

  @override
  String get faceCheckoutDone => 'Ajoyib! Bugungi ish kuningiz yakunlandi.';

  @override
  String get faceMatchFailedTitle => 'Yuz mos kelmadi';

  @override
  String get faceMatchFailedMessage =>
      'Yuzingiz saqlangan namuna bilan mos kelmadi. Qayta urinib ko\'ring yoki administratorga murojaat qiling.';

  @override
  String get faceLivenessFailedTitle => 'Jonlilik tasdiqlanmadi';

  @override
  String get faceLivenessFailedMessage =>
      'Amalni vaqtida bajarolmadingiz. Qayta urinib ko\'ring.';

  @override
  String get faceGeofenceOutsideMessage =>
      'Davomatni belgilash uchun ish hududiga yaqinlashing.';

  @override
  String get faceLiveBannerUnknown => 'Joylashuv aniqlanmoqda…';

  @override
  String get insideGeofence => 'Ish hududidasiz';

  @override
  String get faceGeofenceDistanceLabel => 'Ish joyigacha';

  @override
  String get meterSuffix => 'm';

  @override
  String get outsideGeofence => 'Siz ish hududidan tashqaridasiz';

  @override
  String get checkinSuccess => 'Davomat tasdiqlandi';

  @override
  String get checkoutSuccess => 'Ketish tasdiqlandi';

  @override
  String get home => 'Bosh sahifa';

  @override
  String get requests => 'Murojaatlar';

  @override
  String get chat => 'Chat';

  @override
  String get map => 'Xarita';

  @override
  String get profile => 'Profil';

  @override
  String get citizenTagline => 'Fuqarolar uchun raqamli xizmatlar';

  @override
  String get welcomeGreeting => 'Xush kelibsiz,';

  @override
  String get otpChannelInfo => 'Tasdiqlash uchun SMS kod yuboramiz';

  @override
  String get helpLine => 'Yordam: 1090';

  @override
  String otpSentTo(String phone) {
    return 'Kod $phone raqamiga yuborildi';
  }

  @override
  String get resendCode => 'Kodni qayta yuborish';

  @override
  String get confirm => 'Tasdiqlash';

  @override
  String get errorGeneric => 'Xatolik';

  @override
  String get logout => 'Chiqish';

  @override
  String get logoutConfirmTitle => 'Chiqishni tasdiqlaysizmi?';

  @override
  String get logoutConfirmMessage =>
      'Hisobingizdan chiqasiz — keyin qaytadan kirishingiz kerak bo\'ladi.';

  @override
  String get logoutConfirmCta => 'Ha, chiqish';

  @override
  String get cancel => 'Bekor qilish';

  @override
  String get homeGreeting => 'Xush kelibsiz';

  @override
  String get todayStatusTitle => 'Bugungi holat';

  @override
  String get attendanceStatusPresent => 'Keldi';

  @override
  String get attendanceStatusLate => 'Kechikdi';

  @override
  String get attendanceStatusAbsent => 'Kelmadi';

  @override
  String get attendanceStatusLeave => 'Ta\'tilda';

  @override
  String get notCheckedInYet => 'Hali belgilanmagan';

  @override
  String get checkInTimeLabel => 'Kelgan vaqt';

  @override
  String get homeCheckinCta => 'Yuz bilan tasdiqlash';

  @override
  String get locationCheckFailed => 'Joylashuvni aniqlab bo\'lmadi';

  @override
  String get weeklyChartTitle => 'So\'nggi 7 kun';

  @override
  String get statHoursThisWeek => 'Bu hafta soat';

  @override
  String get statDaysPresent => 'Kelgan kunlar';

  @override
  String get statLateDays => 'Kechikkan kunlar';

  @override
  String get attendanceEmptyTitle => 'Davomat tarixi topilmadi';

  @override
  String get attendanceEmptyMessage => 'Hali davomat yozuvlari mavjud emas';

  @override
  String get attendanceErrorTitle => 'Davomatni yuklab bo\'lmadi';

  @override
  String get comingSoonTitle => 'Tez orada';

  @override
  String get comingSoonMessage => 'Bu bo\'lim hali ishlab chiqilmoqda';

  @override
  String get routeNotFoundTitle => 'Sahifa topilmadi';

  @override
  String get routeNotFoundMessage => 'Bunday manzil mavjud emas';

  @override
  String get quickActionsTitle => 'Tezkor xizmatlar';

  @override
  String get quickActionKommunalka => 'Kommunalka';

  @override
  String get quickActionNewApplication => 'Ariza';

  @override
  String get quickActionComplaint => 'Shikoyat';

  @override
  String get quickActionPaymentHistory => 'To\'lovlar tarixi';

  @override
  String get totalDueTitle => 'Jami qarzdorlik';

  @override
  String get totalDueCaption => 'Barcha kommunal xizmatlar bo\'yicha';

  @override
  String get homeDueEmptyTitle => 'Qarzlaringiz yo\'q';

  @override
  String get homeDueEmptyMessage => 'Barcha kommunal to\'lovlar to\'langan';

  @override
  String get dataLoadErrorTitle => 'Ma\'lumotlarni yuklab bo\'lmadi';

  @override
  String get utilitiesPageTitle => 'Kommunal xizmatlar';

  @override
  String get utilitiesEmptyTitle => 'Xizmatlar topilmadi';

  @override
  String get utilitiesEmptyMessage =>
      'Sizga biriktirilgan kommunal xizmatlar mavjud emas';

  @override
  String get utilityTypeElektr => 'Elektr energiyasi';

  @override
  String get utilityTypeGaz => 'Tabiiy gaz';

  @override
  String get utilityTypeSuv => 'Suv ta\'minoti';

  @override
  String get utilityTypeIssiqlik => 'Issiqlik ta\'minoti';

  @override
  String get utilityTypeChiqindi => 'Maishiy chiqindi';

  @override
  String get accountNumberLabel => 'Hisob raqami';

  @override
  String get noDebtLabel => 'Qarz yo\'q';

  @override
  String get payButtonLabel => 'To\'lash';

  @override
  String get payPageTitle => 'To\'lov';

  @override
  String get amountLabel => 'To\'lov summasi';

  @override
  String get amountHint => 'Summani kiriting';

  @override
  String get amountSuffix => 'so\'m';

  @override
  String get cardNumberLabel => 'Karta raqami';

  @override
  String get cardNumberHint => '0000 0000 0000 0000';

  @override
  String get cardMockNotice => 'Bu — mock karta, haqiqiy mablag\' yechilmaydi';

  @override
  String get payConfirmButton => 'To\'lovni tasdiqlash';

  @override
  String get paySuccessTitle => 'To\'lov muvaffaqiyatli!';

  @override
  String get paySuccessMessage => 'To\'lovingiz muvaffaqiyatli qabul qilindi';

  @override
  String get closeLabel => 'Yopish';

  @override
  String get paymentHistoryPageTitle => 'To\'lovlar tarixi';

  @override
  String get paymentHistoryEmptyTitle => 'To\'lovlar topilmadi';

  @override
  String get paymentHistoryEmptyMessage =>
      'Hali birorta to\'lov amalga oshirilmagan';

  @override
  String get paymentStatusSuccess => 'Muvaffaqiyatli';

  @override
  String get paymentStatusFailed => 'Muvaffaqiyatsiz';

  @override
  String get paymentStatusPending => 'Kutilmoqda';

  @override
  String paidWithCard(String last4) {
    return 'Karta •••• $last4';
  }

  @override
  String get cardExpiryLabel => 'Amal qilish muddati';

  @override
  String get cardExpiryHint => 'OO/YY';

  @override
  String get savedCardsSectionLabel => 'Kartani tanlang';

  @override
  String get addNewCardOption => 'Yangi karta';

  @override
  String get cardBalanceLabel => 'Balans';

  @override
  String get insufficientFundsMessage => 'Kartada mablag\' yetarli emas';

  @override
  String get smsConfirmTitle => 'Kodni tasdiqlang';

  @override
  String get smsConfirmMessage =>
      'Tasdiqlash kodi kartangizga bog\'langan raqamga yuborildi';

  @override
  String smsDemoCodeHint(String code) {
    return 'Namuna uchun (mock): $code';
  }

  @override
  String get receiptPageTitle => 'Chek';

  @override
  String get receiptDateLabel => 'Sana';

  @override
  String get receiptTransactionIdLabel => 'Tranzaksiya raqami';

  @override
  String get receiptShareButton => 'Ulashish';

  @override
  String get receiptShareError => 'Chekni ulashib bo\'lmadi';

  @override
  String get filterTypeAll => 'Barchasi';

  @override
  String get filterTypeElektr => 'Elektr';

  @override
  String get filterTypeGaz => 'Gaz';

  @override
  String get filterTypeSuv => 'Suv';

  @override
  String get filterTypeIssiqlik => 'Issiqlik';

  @override
  String get filterTypeChiqindi => 'Chiqindi';

  @override
  String get paymentsTab => 'To\'lovlar';

  @override
  String get applicationsTab => 'Arizalar';

  @override
  String get requestsTabAssigned => 'Menga biriktirilgan';

  @override
  String get requestsTabRelevant => 'Tegishli';

  @override
  String get requestsSearchHint => 'Murojaatlarni qidirish';

  @override
  String get requestsFilterTitle => 'Filtr';

  @override
  String get requestsFilterStatusLabel => 'Holat';

  @override
  String get requestsFilterPriorityLabel => 'Muhimlik darajasi';

  @override
  String get requestsFilterAll => 'Barchasi';

  @override
  String get requestsEmptyTitle => 'Murojaatlar topilmadi';

  @override
  String get requestsEmptyMessage =>
      'Hozircha ko\'rsatish uchun murojaatlar yo\'q';

  @override
  String get requestsEmptyFilteredMessage =>
      'Tanlangan filtrlar bo\'yicha murojaatlar topilmadi';

  @override
  String get requestsErrorTitle => 'Murojaatlarni yuklab bo\'lmadi';

  @override
  String get statusYangi => 'Yangi';

  @override
  String get statusJarayonda => 'Jarayonda';

  @override
  String get statusJavobBerildi => 'Javob berildi';

  @override
  String get statusYopildi => 'Yopildi';

  @override
  String get statusRad => 'Rad etildi';

  @override
  String get priorityPast => 'Past';

  @override
  String get priorityOrta => 'O\'rta';

  @override
  String get priorityYuqori => 'Yuqori';

  @override
  String get pointsSuffix => 'ball';

  @override
  String get requestDetailTitle => 'Murojaat tafsilotlari';

  @override
  String get requestDescriptionTitle => 'Tavsif';

  @override
  String get requestCitizenInfoTitle => 'Fuqaro ma\'lumotlari';

  @override
  String get requestAttachmentsTitle => 'Biriktirilgan fayllar';

  @override
  String get requestNoAttachments => 'Biriktirilgan fayllar yo\'q';

  @override
  String get requestResponseTitle => 'Xodim javobi';

  @override
  String get requestDeadlineLabel => 'Muddat';

  @override
  String get requestRespondCta => 'Javob yozish';

  @override
  String get requestRateCta => 'Ball qo\'yish';

  @override
  String get requestRespondPageTitle => 'Murojaatga javob';

  @override
  String get requestResponseHint => 'Javob matnini kiriting';

  @override
  String get requestResponseEmptyError => 'Javob matnini kiriting';

  @override
  String get requestSendResponse => 'Yuborish';

  @override
  String get requestRateSheetTitle => 'Ball qo\'yish';

  @override
  String get requestRateHint => 'Yulduzchalarni tanlang';

  @override
  String get requestRateSubmit => 'Tasdiqlash';

  @override
  String get requestRespondSuccessTitle => 'Javob yuborildi';

  @override
  String get requestRespondSuccessMessage => 'Murojaatga javobingiz saqlandi';

  @override
  String get requestRateSuccessTitle => 'Ball qo\'yildi';

  @override
  String get requestRateSuccessMessage => 'Murojaat muvaffaqiyatli baholandi';

  @override
  String get requestNotFoundTitle => 'Murojaat topilmadi';

  @override
  String get leaveRequestTileLabel => 'Javob so\'rash';

  @override
  String get leaveRequestPageTitle => 'Javob so\'rash';

  @override
  String get leaveRequestDurationTypeLabel => 'Muddat turi';

  @override
  String get leaveRequestDurationHours => 'Soatlab';

  @override
  String get leaveRequestDurationDays => 'Kunlab';

  @override
  String get leaveRequestAmountLabel => 'Miqdor';

  @override
  String get leaveRequestHoursUnit => 'soat';

  @override
  String get leaveRequestDaysUnit => 'kun';

  @override
  String get leaveRequestStartDateLabel => 'Boshlanish sanasi';

  @override
  String get leaveRequestStartTimeLabel => 'Boshlanish vaqti';

  @override
  String get leaveRequestReasonLabel => 'Sabab';

  @override
  String get leaveRequestReasonHint => 'So\'rov sababini kiriting';

  @override
  String get leaveRequestReasonEmptyError => 'Sababni kiriting';

  @override
  String get leaveRequestMaxNote => 'Maksimal — 1 ish haftasi (6 ish kuni)';

  @override
  String get leaveRequestSubmitCta => 'Yuborish';

  @override
  String get leaveRequestSuccessTitle => 'So\'rov yuborildi';

  @override
  String get leaveRequestSuccessMessage =>
      'Javob so\'rash uchun so\'rovingiz yuborildi va ko\'rib chiqilmoqda';

  @override
  String get createRequestTitle => 'Murojaat yaratish';

  @override
  String get createRequestTitleLabel => 'Sarlavha';

  @override
  String get createRequestTitleHint => 'Murojaat sarlavhasini kiriting';

  @override
  String get createRequestCategoryLabel => 'Kategoriya';

  @override
  String get createRequestCategoryHint => 'Kategoriyani tanlang';

  @override
  String get createRequestPriorityLabel => 'Muhimlik darajasi';

  @override
  String get createRequestDescriptionLabel => 'Tavsif';

  @override
  String get createRequestDescriptionHint =>
      'Murojaat tavsifini batafsil yozing';

  @override
  String get createRequestAttachmentsLabel => 'Biriktirilgan fayllar';

  @override
  String get createRequestSubmit => 'Yuborish';

  @override
  String get createRequestSuccessTitle => 'Murojaat yuborildi';

  @override
  String get createRequestSuccessMessage =>
      'Murojaatingiz muvaffaqiyatli yuborildi';

  @override
  String get createRequestValidationError => 'Majburiy';

  @override
  String get attachmentAddImage => 'Rasm';

  @override
  String get attachmentAddVideo => 'Video';

  @override
  String get attachmentAddVoice => 'Ovozli xabar';

  @override
  String get attachmentAddFile => 'Fayl';

  @override
  String get attachmentPickSource => 'Manbani tanlang';

  @override
  String get attachmentCamera => 'Kamera';

  @override
  String get attachmentGallery => 'Galereya';

  @override
  String get attachmentPickError => 'Faylni tanlab bo\'lmadi';

  @override
  String get attachmentPlaybackError => 'Ijro etib bo\'lmadi';

  @override
  String get recorderGrantPermission => 'Ruxsat berish';

  @override
  String get recorderOpenSettings => 'Sozlamalarni ochish';

  @override
  String get voiceRecorderTitle => 'Ovozli xabar';

  @override
  String get voiceRecorderIdleHint =>
      'Yozishni boshlash uchun mikrofonga bosing';

  @override
  String get voiceRecorderRecordingHint => 'Yozilmoqda…';

  @override
  String get voiceRecorderReadyHint => 'Tinglab ko\'ring va biriktiring';

  @override
  String get voiceRecorderRetake => 'Qayta yozish';

  @override
  String get voiceRecorderAttach => 'Biriktirish';

  @override
  String get voiceRecorderPermissionTitle => 'Mikrofonga ruxsat kerak';

  @override
  String get voiceRecorderPermissionMessage =>
      'Ovozli xabar yozish uchun mikrofondan foydalanishga ruxsat bering.';

  @override
  String get voiceRecorderError => 'Ovoz yozib bo\'lmadi';

  @override
  String get videoRecorderTitle => 'Video yozish';

  @override
  String get videoRecorderPermissionTitle => 'Kameraga ruxsat kerak';

  @override
  String get videoRecorderPermissionMessage =>
      'Video yozish uchun kamera va mikrofondan foydalanishga ruxsat bering.';

  @override
  String get videoRecorderError => 'Video yozib bo\'lmadi';

  @override
  String get videoRecorderRetake => 'Qayta olish';

  @override
  String get videoRecorderAttach => 'Ishlatish';

  @override
  String get requestKindAriza => 'Ariza';

  @override
  String get requestKindShikoyat => 'Shikoyat';

  @override
  String get citizenRequestStatusYuborilgan => 'Yuborilgan';

  @override
  String get citizenRequestStatusKorilmoqda => 'Ko\'rilmoqda';

  @override
  String get citizenRequestStatusJavobBerildi => 'Javob berildi';

  @override
  String get citizenRequestStatusYopildi => 'Yopildi';

  @override
  String get citizenRequestsPageTitle => 'Murojaatlarim';

  @override
  String get citizenRequestsAddTooltip => 'Yangi murojaat';

  @override
  String get citizenRequestKindLabel => 'Murojaat turi';

  @override
  String get citizenRequestSubmitTitle => 'Murojaat yuborish';

  @override
  String get reportsPageTitle => 'Hisobot';

  @override
  String get reportsPaymentsCountLabel => 'To\'lovlar soni';

  @override
  String get reportsPaymentsAmountLabel => 'To\'lovlar summasi';

  @override
  String get reportsAppealsCountLabel => 'Arizalar soni';

  @override
  String get reportsComplaintsCountLabel => 'Shikoyatlar soni';

  @override
  String get reportsByStatusTitle => 'Holat bo\'yicha taqsimot';

  @override
  String get profileLanguageLabel => 'Til';

  @override
  String get profileLanguageUz => 'O\'zbekcha';

  @override
  String get profileLanguageRu => 'Ruscha';

  @override
  String get profileThemeLabel => 'Mavzu';

  @override
  String get profileThemeLight => 'Yorug\'';

  @override
  String get profileThemeDark => 'Tungi';

  @override
  String get profilePinLabel => 'PIN o\'zgartirish';

  @override
  String get profileHelpLabel => 'Yordam';

  @override
  String get profileReportsLabel => 'Hisobotlar';

  @override
  String get profileNewsTileLabel => 'Yangiliklar';

  @override
  String get profileDocumentsTileLabel => 'Hujjatlar';

  @override
  String get chatTabAll => 'Barchasi';

  @override
  String get chatTabPersonal => 'Shaxsiy';

  @override
  String get chatTabGroup => 'Guruh';

  @override
  String get chatSearchHint => 'Suhbatlarni qidirish';

  @override
  String get chatEmptyTitle => 'Suhbatlar topilmadi';

  @override
  String get chatEmptyMessage => 'Hozircha birorta suhbat yo\'q';

  @override
  String get chatEmptyFilteredMessage =>
      'Qidiruv bo\'yicha hech narsa topilmadi';

  @override
  String get chatErrorTitle => 'Suhbatlarni yuklab bo\'lmadi';

  @override
  String chatParticipantsCount(int count) {
    return '$count ishtirokchi';
  }

  @override
  String get conversationEmptyTitle => 'Xabarlar yo\'q';

  @override
  String get conversationEmptyMessage => 'Birinchi xabarni yuboring';

  @override
  String get conversationErrorTitle => 'Xabarlarni yuklab bo\'lmadi';

  @override
  String get chatMessageHint => 'Xabar yozing...';

  @override
  String get chatAttachSheetTitle => 'Biriktirish';

  @override
  String get chatAttachRoundVideo => 'Dumaloq video xabar';

  @override
  String get chatAttachSticker => 'Stiker';

  @override
  String get chatStickerSheetTitle => 'Stikerni tanlang';

  @override
  String get chatDateToday => 'Bugun';

  @override
  String get chatDateYesterday => 'Kecha';

  @override
  String get chatPresenceOnline => 'onlayn';

  @override
  String get profileLanguageTitle => 'Til';

  @override
  String get languageNameUzbek => 'O\'zbek';

  @override
  String get languageNameRussian => 'Русский';

  @override
  String get profileThemeTitle => 'Mavzu';

  @override
  String get profileThemeOptionLight => 'Yorug\'';

  @override
  String get profileThemeOptionDark => 'Qorong\'i';

  @override
  String get profileWorkInfoTitle => 'Ish ma\'lumotlari';

  @override
  String get profileWorkingHoursLabel => 'Ish soatlari';

  @override
  String get profileRatingLabel => 'Reyting';

  @override
  String get profileDepartmentLabel => 'Bo\'lim';

  @override
  String get profileAboutTitle => 'Ilova haqida';

  @override
  String get profileAppVersionLabel => 'Ilova versiyasi';

  @override
  String profileWorkerIdLabel(String id) {
    return 'ID: $id';
  }

  @override
  String get mapPermissionTitle => 'Joylashuvga ruxsat kerak';

  @override
  String get mapPermissionMessage =>
      'Xodimning joylashuvini kuzatish uchun joylashuvga ruxsat bering';

  @override
  String get mapGrantPermission => 'Ruxsat berish';

  @override
  String get mapErrorTitle => 'Joylashuvni kuzatib bo\'lmadi';

  @override
  String get mapNotTracking => 'Kuzatuv faol emas';

  @override
  String get mapLocating => 'Joylashuv aniqlanmoqda…';

  @override
  String get mapStartTracking => 'Kuzatishni boshlash';

  @override
  String get mapStopTracking => 'Kuzatishni to\'xtatish';

  @override
  String get mapRecenterTooltip => 'Joriy joylashuvga markazlashtirish';

  @override
  String get pinSetTitle => 'PIN kod o\'rnating';

  @override
  String get pinSetSubtitle =>
      'Ilovaga tezkor va xavfsiz kirish uchun 4 xonali PIN kod yarating';

  @override
  String get pinConfirmTitle => 'PIN kodni tasdiqlang';

  @override
  String get pinConfirmSubtitle =>
      'Tanlagan PIN kodingizni yana bir marta kiriting';

  @override
  String get pinMismatchError =>
      'PIN kodlar mos kelmadi. Qaytadan urinib ko\'ring';

  @override
  String get pinSetSuccessTitle => 'PIN kod muvaffaqiyatli o\'rnatildi!';

  @override
  String get pinUnlockTitle => 'PIN kodni kiriting';

  @override
  String get pinUnlockSubtitle => 'Davom etish uchun PIN kodingizni kiriting';

  @override
  String get pinWrongError => 'Noto\'g\'ri PIN kod';

  @override
  String get pinStorageErrorMessage =>
      'PIN kodni saqlab bo\'lmadi. Qaytadan urinib ko\'ring';

  @override
  String get pinLockedOutMessage =>
      'Juda ko\'p noto\'g\'ri urinish. Birozdan so\'ng qayta urinib ko\'ring';

  @override
  String get workerAppName => 'Hokimiyat Ishchi';

  @override
  String get createRequestCategoryUtilities => 'Kommunal xizmat';

  @override
  String get createRequestCategoryRoads => 'Yo\'l xo\'jaligi';

  @override
  String get createRequestCategoryReference => 'Ma\'lumotnoma';

  @override
  String get createRequestCategorySanitation => 'Sanitariya';

  @override
  String get createRequestCategorySocialInfra => 'Ijtimoiy infratuzilma';

  @override
  String get createRequestCategoryPublicOrder => 'Jamoat tartibi';

  @override
  String get createRequestCategorySocialAid => 'Ijtimoiy yordam';

  @override
  String get createRequestCategoryEducation => 'Ta\'lim';

  @override
  String get createRequestCategoryConstruction => 'Qurilish';

  @override
  String get searchHint => 'Qidirish';

  @override
  String get registrationPageTitle => 'Ro\'yxatdan o\'tish';

  @override
  String get registrationHeadline => 'Shaxsiy ma\'lumotlaringiz';

  @override
  String get registrationSubtitle =>
      'Davom etish uchun quyidagi ma\'lumotlarni to\'ldiring';

  @override
  String get registrationFullNameLabel => 'F.I.Sh. (to\'liq ism)';

  @override
  String get registrationFullNameHint => 'Familiya Ism Sharif';

  @override
  String get registrationDocumentTypeLabel => 'Hujjat turi';

  @override
  String get registrationDocumentTypePinfl => 'JSHSHIR';

  @override
  String get registrationDocumentTypePassport => 'Pasport';

  @override
  String get registrationPinflLabel => 'JSHSHIR (14 raqam)';

  @override
  String get registrationPinflHint => '12345678901234';

  @override
  String get registrationPassportLabel => 'Pasport seriya va raqami';

  @override
  String get registrationPassportHint => 'AA1234567';

  @override
  String get registrationBirthDateLabel => 'Tug\'ilgan sana';

  @override
  String get registrationBirthDateHint => 'KK.OO.YYYY';

  @override
  String get registrationRegionLabel => 'Viloyat';

  @override
  String get registrationRegionHint => 'Viloyatni tanlang';

  @override
  String get registrationDistrictLabel => 'Tuman';

  @override
  String get registrationDistrictHint => 'Tumanni tanlang';

  @override
  String get registrationDistrictHintNoRegion => 'Avval viloyatni tanlang';

  @override
  String get registrationAddressLabel => 'Yashash manzili';

  @override
  String get registrationAddressHint => 'Uy manzilingizni kiriting';

  @override
  String get registrationSubmit => 'Davom etish';

  @override
  String get registrationSuccessTitle =>
      'Ma\'lumotlar muvaffaqiyatli saqlandi!';

  @override
  String get registrationFullNameError =>
      'To\'liq ismingizni kiriting (kamida ism va familiya)';

  @override
  String get registrationPinflError =>
      'JSHSHIR 14 ta raqamdan iborat bo\'lishi kerak';

  @override
  String get registrationPassportError =>
      'Pasport: 2 harf + 7 raqam (masalan AA1234567)';

  @override
  String get registrationBirthDateError =>
      'Tug\'ilgan sanani to\'g\'ri kiriting (masalan 01.01.1990)';

  @override
  String get registrationRegionError => 'Viloyatni tanlang';

  @override
  String get registrationDistrictError => 'Tumanni tanlang';

  @override
  String get registrationAddressError =>
      'Manzilingizni kiriting (kamida 5 belgi)';

  @override
  String get registrationStorageErrorMessage =>
      'Ma\'lumotlarni saqlab bo\'lmadi. Qaytadan urinib ko\'ring';

  @override
  String get registrationRegionToshkentShahri => 'Toshkent shahri';

  @override
  String get registrationRegionToshkentViloyati => 'Toshkent viloyati';

  @override
  String get registrationRegionAndijon => 'Andijon viloyati';

  @override
  String get registrationRegionFargona => 'Farg\'ona viloyati';

  @override
  String get registrationRegionNamangan => 'Namangan viloyati';

  @override
  String get registrationRegionSamarqand => 'Samarqand viloyati';

  @override
  String get registrationRegionBuxoro => 'Buxoro viloyati';

  @override
  String get registrationRegionXorazm => 'Xorazm viloyati';

  @override
  String get registrationRegionNavoiy => 'Navoiy viloyati';

  @override
  String get registrationRegionQashqadaryo => 'Qashqadaryo viloyati';

  @override
  String get registrationRegionSurxondaryo => 'Surxondaryo viloyati';

  @override
  String get registrationRegionJizzax => 'Jizzax viloyati';

  @override
  String get registrationRegionSirdaryo => 'Sirdaryo viloyati';

  @override
  String get registrationRegionQoraqalpogiston =>
      'Qoraqalpog\'iston Respublikasi';

  @override
  String get registrationDistrictChilonzor => 'Chilonzor tumani';

  @override
  String get registrationDistrictYunusobod => 'Yunusobod tumani';

  @override
  String get registrationDistrictZangiota => 'Zangiota tumani';

  @override
  String get registrationDistrictQibray => 'Qibray tumani';

  @override
  String get registrationDistrictAndijonShahri => 'Andijon shahri';

  @override
  String get registrationDistrictAsaka => 'Asaka tumani';

  @override
  String get registrationDistrictFargonaShahri => 'Farg\'ona shahri';

  @override
  String get registrationDistrictQoqon => 'Qo\'qon shahri';

  @override
  String get registrationDistrictNamanganShahri => 'Namangan shahri';

  @override
  String get registrationDistrictChust => 'Chust tumani';

  @override
  String get registrationDistrictSamarqandShahri => 'Samarqand shahri';

  @override
  String get registrationDistrictUrgut => 'Urgut tumani';

  @override
  String get registrationDistrictBuxoroShahri => 'Buxoro shahri';

  @override
  String get registrationDistrictGijduvon => 'G\'ijduvon tumani';

  @override
  String get registrationDistrictUrganch => 'Urganch shahri';

  @override
  String get registrationDistrictXiva => 'Xiva tumani';

  @override
  String get registrationDistrictNavoiyShahri => 'Navoiy shahri';

  @override
  String get registrationDistrictZarafshon => 'Zarafshon shahri';

  @override
  String get registrationDistrictQarshi => 'Qarshi shahri';

  @override
  String get registrationDistrictShahrisabz => 'Shahrisabz tumani';

  @override
  String get registrationDistrictTermiz => 'Termiz shahri';

  @override
  String get registrationDistrictDenov => 'Denov tumani';

  @override
  String get registrationDistrictJizzaxShahri => 'Jizzax shahri';

  @override
  String get registrationDistrictZomin => 'Zomin tumani';

  @override
  String get registrationDistrictGuliston => 'Guliston shahri';

  @override
  String get registrationDistrictShirin => 'Shirin tumani';

  @override
  String get registrationDistrictNukus => 'Nukus shahri';

  @override
  String get registrationDistrictXojayli => 'Xo\'jayli tumani';

  @override
  String profileEnrolledOn(String date) {
    return 'Ro\'yxatdan o\'tilgan: $date';
  }

  @override
  String get meetingsPageTitle => 'Majlislar';

  @override
  String get meetingsFilterAll => 'Barchasi';

  @override
  String get meetingStatusLive => 'Jonli';

  @override
  String get meetingStatusScheduled => 'Rejalashtirilgan';

  @override
  String get meetingStatusEnded => 'Tugagan';

  @override
  String get meetingsEmptyTitle => 'Majlislar topilmadi';

  @override
  String get meetingsEmptyMessage =>
      'Hozircha ko\'rsatish uchun majlislar yo\'q';

  @override
  String get meetingsErrorTitle => 'Majlislarni yuklab bo\'lmadi';

  @override
  String get meetingJoinShortCta => 'Ulanish';

  @override
  String get meetingDetailTitle => 'Majlis tafsilotlari';

  @override
  String get meetingHostLabel => 'Tashkilotchi';

  @override
  String meetingDurationLabel(int minutes) {
    return '$minutes daqiqa';
  }

  @override
  String get meetingDescriptionTitle => 'Kun tartibi';

  @override
  String get meetingNoDescription => 'Kun tartibi kiritilmagan';

  @override
  String meetingParticipantsCount(int count) {
    return '$count ishtirokchi';
  }

  @override
  String get meetingJoinCta => 'Majlisga ulanish';

  @override
  String get meetingJoiningStatus => 'Ulanmoqda…';

  @override
  String get meetingEndedNotice => 'Bu majlis allaqachon yakunlangan';

  @override
  String get meetingJoinedTitle => 'Siz ulandingiz!';

  @override
  String get meetingJoinedMessage =>
      'Quyidagi havola orqali majlisga qo\'shiling';

  @override
  String get meetingJoinUrlCopied => 'Havola nusxalandi';

  @override
  String get meetingCopyLink => 'Havolani nusxalash';

  @override
  String get meetingNotFoundTitle => 'Majlis topilmadi';

  @override
  String get callBrandLabel => 'Video konferensiya';

  @override
  String get callSecureConnection => 'Xavfsiz ulanish';

  @override
  String get callInitializingMedia => 'Kamera va mikrofon yoqilmoqda…';

  @override
  String get callLobbyJoinNow => 'Hozir qo\'shilish';

  @override
  String get callJoinWithoutCamera => 'Kamerasiz qo\'shilish';

  @override
  String callParticipantsWaiting(int count) {
    return '$count ta ishtirokchi kutilmoqda';
  }

  @override
  String get callYouAreFirst => 'Siz birinchi qo\'shilyapsiz';

  @override
  String get callYou => 'Siz';

  @override
  String get callYouSuffix => '(siz)';

  @override
  String get callCameraOff => 'Kamera o\'chiq';

  @override
  String get callMic => 'Mikrofon';

  @override
  String get callCamera => 'Kamera';

  @override
  String get callScreen => 'Ekran';

  @override
  String get callReaction => 'Reaksiya';

  @override
  String get callEnd => 'Tugatish';

  @override
  String get callEndConfirmTitle => 'Qo\'ng\'iroqni tugatasizmi?';

  @override
  String get callEndConfirmMessage =>
      'Video-konferensiyadan chiqasiz — hamma ishtirokchilar uchun sizning ulanishingiz uziladi.';

  @override
  String get callLive => 'LIVE';

  @override
  String callParticipantsTitle(int count) {
    return 'Ishtirokchilar ($count)';
  }

  @override
  String callParticipantJoined(String name) {
    return '$name qo\'shildi';
  }

  @override
  String get callDeviceOnlyNote =>
      'Qo\'shilish orqali kamera/mikrofon faqat shu qurilmangizda ishlatiladi.';

  @override
  String get callSharingBanner => 'Siz ekraningizni ulashyapsiz';

  @override
  String get homeQuickActionsTitle => 'Tezkor';

  @override
  String get pointsPageTitle => 'Ballarim';

  @override
  String get pointsTotalLabel => 'Umumiy ball';

  @override
  String pointsRankLabel(int rank) {
    return '$rank-o\'rin';
  }

  @override
  String get pointsSummaryPositiveLabel => 'Qo\'shilgan';

  @override
  String get pointsSummaryNegativeLabel => 'Ayirilgan';

  @override
  String get pointsHistoryTitle => 'O\'zgarishlar tarixi';

  @override
  String get pointsEmptyTitle => 'Ball tarixi topilmadi';

  @override
  String get pointsEmptyMessage => 'Hali ball o\'zgarishlari mavjud emas';

  @override
  String get pointsErrorTitle => 'Ballarni yuklab bo\'lmadi';

  @override
  String get suggestionsPageTitle => 'Takliflar';

  @override
  String get suggestionsFilterTitle => 'Filtr';

  @override
  String get suggestionsFilterStatusLabel => 'Holat';

  @override
  String get suggestionsFilterAll => 'Barchasi';

  @override
  String get suggestionsSearchHint => 'Takliflarni qidirish';

  @override
  String get suggestionsEmptyTitle => 'Takliflar topilmadi';

  @override
  String get suggestionsEmptyMessage =>
      'Hozircha ko\'rsatish uchun takliflar yo\'q';

  @override
  String get suggestionsEmptyFilteredMessage =>
      'Tanlangan filtrlar bo\'yicha takliflar topilmadi';

  @override
  String get suggestionsErrorTitle => 'Takliflarni yuklab bo\'lmadi';

  @override
  String get suggestionStatusYangi => 'Yangi';

  @override
  String get suggestionStatusKorilmoqda => 'Ko\'rilmoqda';

  @override
  String get suggestionStatusQabulQilindi => 'Qabul qilindi';

  @override
  String get suggestionStatusRad => 'Rad etildi';

  @override
  String get suggestionCategoryDigital => 'Raqamlashtirish';

  @override
  String get suggestionCategoryProcess => 'Ish jarayoni';

  @override
  String get suggestionCategorySocial => 'Ijtimoiy';

  @override
  String get suggestionCategoryInfra => 'Infratuzilma';

  @override
  String get suggestionCategoryOther => 'Boshqa';

  @override
  String get submitSuggestionTitle => 'Taklif yuborish';

  @override
  String get submitSuggestionTitleLabel => 'Sarlavha';

  @override
  String get submitSuggestionTitleHint => 'Taklif sarlavhasini kiriting';

  @override
  String get submitSuggestionCategoryLabel => 'Kategoriya';

  @override
  String get submitSuggestionCategoryHint => 'Kategoriyani tanlang';

  @override
  String get submitSuggestionBodyLabel => 'Taklif matni';

  @override
  String get submitSuggestionBodyHint => 'G\'oyangizni batafsil yozing';

  @override
  String get submitSuggestionSubmit => 'Yuborish';

  @override
  String get submitSuggestionSuccessTitle => 'Taklif yuborildi';

  @override
  String get submitSuggestionSuccessMessage =>
      'Taklifingiz muvaffaqiyatli yuborildi';

  @override
  String get homeTodayOverviewTitle => 'Bugungi ko\'rinish';

  @override
  String get homeStripNewRequests => 'Yangi murojaat';

  @override
  String get homeStripUnreadChat => 'O\'qilmagan xabar';

  @override
  String get homeStripMeetingsToday => 'Bugungi majlis';

  @override
  String get homeSectionsTitle => 'Bo\'limlar';

  @override
  String homeNewRequestsBadge(int count) {
    return '$count yangi';
  }

  @override
  String homeUnreadChatBadge(int count) {
    return '$count o\'qilmagan';
  }

  @override
  String homeMeetingsTodayBadge(int count) {
    return '$count bugun';
  }

  @override
  String get homeAnalyticsTile => 'Tahlil';

  @override
  String get homeRecentActivityTitle => 'So\'nggi faoliyat';

  @override
  String get homeActivityNewRequest => 'Yangi murojaat biriktirildi';

  @override
  String get homeActivityMeetingStarting => 'Majlis boshlanadi';

  @override
  String get homeActivityNewMessage => 'Chatda yangi xabar bor';

  @override
  String get homeGeofenceInside => 'Ichkarida';

  @override
  String get homeGeofenceOutside => 'Tashqarida';

  @override
  String get workScheduleTileLabel => 'Ish jadvali';

  @override
  String get workSchedulePageTitle => 'Ish jadvali';

  @override
  String get workScheduleSubtitle =>
      'Haftalik ish vaqti — 6 kunlik ish haftasi';

  @override
  String get workScheduleTodayBadge => 'Bugun';

  @override
  String get workScheduleRestDay => 'Dam olish';

  @override
  String get workScheduleHours => '09:00–18:00';

  @override
  String get weekdayMonday => 'Dushanba';

  @override
  String get weekdayTuesday => 'Seshanba';

  @override
  String get weekdayWednesday => 'Chorshanba';

  @override
  String get weekdayThursday => 'Payshanba';

  @override
  String get weekdayFriday => 'Juma';

  @override
  String get weekdaySaturday => 'Shanba';

  @override
  String get weekdaySunday => 'Yakshanba';

  @override
  String get mapWorkZoneLegend => 'Ish hududi';

  @override
  String get mapWorkHourInsideMessage => 'Hozir ish vaqti — ish hududidasiz';

  @override
  String get mapWorkHourOutsideMessage =>
      'Hozir ish vaqti — ish hududiga qayting';

  @override
  String get mapOffWorkHoursMessage => 'Hozir ish vaqti emas';

  @override
  String get mapWorkZoneRuleTitle => 'Ish hududi qoidasi';

  @override
  String get mapWorkZoneRuleText =>
      'Ish vaqtida ish hududida bo\'ling. Ish hududidan 30 daqiqadan ortiq uzoqlashsangiz, ballaringiz kamayadi.';

  @override
  String get notificationsTitle => 'Bildirishnomalar';

  @override
  String get notificationsMarkAllRead => 'Hammasini o\'qilgan deb belgilash';

  @override
  String get notificationsEmptyTitle => 'Bildirishnomalar yo\'q';

  @override
  String get notificationsEmptyMessage =>
      'Hozircha sizga hech qanday bildirishnoma kelmagan';

  @override
  String get notificationsErrorTitle => 'Yuklashda xatolik';

  @override
  String get notificationsJustNow => 'Hozir';

  @override
  String get notificationsMinutesAgoSuffix => 'daqiqa oldin';

  @override
  String get notificationsHoursAgoSuffix => 'soat oldin';

  @override
  String get notificationsDaysAgoSuffix => 'kun oldin';
}
