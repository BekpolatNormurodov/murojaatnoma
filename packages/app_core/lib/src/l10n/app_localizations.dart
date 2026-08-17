import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ru.dart';
import 'app_localizations_uz.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ru'),
    Locale('uz'),
  ];

  /// No description provided for @appName.
  ///
  /// In uz, this message translates to:
  /// **'Hokimiyat'**
  String get appName;

  /// No description provided for @splashTagline.
  ///
  /// In uz, this message translates to:
  /// **'Raqamli boshqaruv platformasi'**
  String get splashTagline;

  /// No description provided for @login.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get login;

  /// No description provided for @phoneNumber.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqamingiz'**
  String get phoneNumber;

  /// No description provided for @sendCode.
  ///
  /// In uz, this message translates to:
  /// **'Kodni yuborish'**
  String get sendCode;

  /// No description provided for @enterCode.
  ///
  /// In uz, this message translates to:
  /// **'Kodni kiriting'**
  String get enterCode;

  /// No description provided for @faceEnrollTitle.
  ///
  /// In uz, this message translates to:
  /// **'Yuzingizni ro\'yxatdan o\'tkazing'**
  String get faceEnrollTitle;

  /// No description provided for @faceCheckinTitle.
  ///
  /// In uz, this message translates to:
  /// **'Yuz bilan tasdiqlash'**
  String get faceCheckinTitle;

  /// No description provided for @faceHoldStill.
  ///
  /// In uz, this message translates to:
  /// **'Yuzingizni ovalga joylang'**
  String get faceHoldStill;

  /// No description provided for @blinkPrompt.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'zingizni pirpiratng'**
  String get blinkPrompt;

  /// No description provided for @turnLeftPrompt.
  ///
  /// In uz, this message translates to:
  /// **'Boshingizni chapga buring'**
  String get turnLeftPrompt;

  /// No description provided for @turnRightPrompt.
  ///
  /// In uz, this message translates to:
  /// **'Boshingizni o\'ngga buring'**
  String get turnRightPrompt;

  /// No description provided for @smilePrompt.
  ///
  /// In uz, this message translates to:
  /// **'Jilmaying'**
  String get smilePrompt;

  /// No description provided for @faceInitializing.
  ///
  /// In uz, this message translates to:
  /// **'Kamera tayyorlanmoqda…'**
  String get faceInitializing;

  /// No description provided for @facePermissionTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kameraga ruxsat kerak'**
  String get facePermissionTitle;

  /// No description provided for @faceCameraPermissionMessage.
  ///
  /// In uz, this message translates to:
  /// **'Yuzingizni ro\'yxatdan o\'tkazish uchun kameradan foydalanishga ruxsat bering'**
  String get faceCameraPermissionMessage;

  /// No description provided for @faceGrantPermission.
  ///
  /// In uz, this message translates to:
  /// **'Ruxsat berish'**
  String get faceGrantPermission;

  /// No description provided for @faceOpenSettings.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalarni ochish'**
  String get faceOpenSettings;

  /// No description provided for @faceCameraErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kamera xatosi'**
  String get faceCameraErrorTitle;

  /// No description provided for @faceCameraErrorMessage.
  ///
  /// In uz, this message translates to:
  /// **'Kamerani ishga tushirib bo\'lmadi'**
  String get faceCameraErrorMessage;

  /// No description provided for @faceModelErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Model xatosi'**
  String get faceModelErrorTitle;

  /// No description provided for @faceModelErrorMessage.
  ///
  /// In uz, this message translates to:
  /// **'Yuz tanish modelini yuklab bo\'lmadi'**
  String get faceModelErrorMessage;

  /// No description provided for @retry.
  ///
  /// In uz, this message translates to:
  /// **'Qayta urinish'**
  String get retry;

  /// No description provided for @faceTooFar.
  ///
  /// In uz, this message translates to:
  /// **'Yaqinroq keling'**
  String get faceTooFar;

  /// No description provided for @faceTooClose.
  ///
  /// In uz, this message translates to:
  /// **'Uzoqroq suriling'**
  String get faceTooClose;

  /// No description provided for @faceMoveLeft.
  ///
  /// In uz, this message translates to:
  /// **'Chaproq suriling'**
  String get faceMoveLeft;

  /// No description provided for @faceMoveRight.
  ///
  /// In uz, this message translates to:
  /// **'O\'ngroq suriling'**
  String get faceMoveRight;

  /// No description provided for @faceMoveUp.
  ///
  /// In uz, this message translates to:
  /// **'Teparoq suriling'**
  String get faceMoveUp;

  /// No description provided for @faceMoveDown.
  ///
  /// In uz, this message translates to:
  /// **'Pastroq suriling'**
  String get faceMoveDown;

  /// No description provided for @faceTurned.
  ///
  /// In uz, this message translates to:
  /// **'Boshingizni to\'g\'ri tuting'**
  String get faceTurned;

  /// No description provided for @faceEyesClosed.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'zingizni oching'**
  String get faceEyesClosed;

  /// No description provided for @faceLowLight.
  ///
  /// In uz, this message translates to:
  /// **'Yorug\'roq joyga o\'ting'**
  String get faceLowLight;

  /// No description provided for @faceKeepStill.
  ///
  /// In uz, this message translates to:
  /// **'Ajoyib! Harakatsiz turing'**
  String get faceKeepStill;

  /// No description provided for @faceCapturingStatus.
  ///
  /// In uz, this message translates to:
  /// **'Suratga olinmoqda…'**
  String get faceCapturingStatus;

  /// No description provided for @faceEmbeddingStatus.
  ///
  /// In uz, this message translates to:
  /// **'Qayta ishlanmoqda…'**
  String get faceEmbeddingStatus;

  /// No description provided for @faceEnrollingStatus.
  ///
  /// In uz, this message translates to:
  /// **'Saqlanmoqda…'**
  String get faceEnrollingStatus;

  /// No description provided for @faceEnrollSuccess.
  ///
  /// In uz, this message translates to:
  /// **'Muvaffaqiyatli ro\'yxatdan o\'tdingiz!'**
  String get faceEnrollSuccess;

  /// No description provided for @faceErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik'**
  String get faceErrorTitle;

  /// No description provided for @faceCheckinCameraPermissionMessage.
  ///
  /// In uz, this message translates to:
  /// **'Davomatni belgilash uchun kameradan foydalanishga ruxsat bering'**
  String get faceCheckinCameraPermissionMessage;

  /// No description provided for @faceVerifyingStatus.
  ///
  /// In uz, this message translates to:
  /// **'Tekshirilmoqda…'**
  String get faceVerifyingStatus;

  /// No description provided for @faceCheckingInStatus.
  ///
  /// In uz, this message translates to:
  /// **'Davomat yozilmoqda…'**
  String get faceCheckingInStatus;

  /// No description provided for @faceCheckinTimeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Belgilangan vaqt'**
  String get faceCheckinTimeLabel;

  /// No description provided for @faceCheckinDone.
  ///
  /// In uz, this message translates to:
  /// **'Ajoyib! Bugungi davomatingiz qayd etildi.'**
  String get faceCheckinDone;

  /// No description provided for @faceContinue.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish'**
  String get faceContinue;

  /// No description provided for @faceMatchFailedTitle.
  ///
  /// In uz, this message translates to:
  /// **'Yuz mos kelmadi'**
  String get faceMatchFailedTitle;

  /// No description provided for @faceMatchFailedMessage.
  ///
  /// In uz, this message translates to:
  /// **'Yuzingiz saqlangan namuna bilan mos kelmadi. Qayta urinib ko\'ring yoki administratorga murojaat qiling.'**
  String get faceMatchFailedMessage;

  /// No description provided for @faceLivenessFailedTitle.
  ///
  /// In uz, this message translates to:
  /// **'Jonlilik tasdiqlanmadi'**
  String get faceLivenessFailedTitle;

  /// No description provided for @faceLivenessFailedMessage.
  ///
  /// In uz, this message translates to:
  /// **'Amalni vaqtida bajarolmadingiz. Qayta urinib ko\'ring.'**
  String get faceLivenessFailedMessage;

  /// No description provided for @faceGeofenceOutsideMessage.
  ///
  /// In uz, this message translates to:
  /// **'Davomatni belgilash uchun ish hududiga yaqinlashing.'**
  String get faceGeofenceOutsideMessage;

  /// No description provided for @faceLiveBannerUnknown.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuv aniqlanmoqda…'**
  String get faceLiveBannerUnknown;

  /// No description provided for @insideGeofence.
  ///
  /// In uz, this message translates to:
  /// **'Ish hududidasiz'**
  String get insideGeofence;

  /// No description provided for @faceGeofenceDistanceLabel.
  ///
  /// In uz, this message translates to:
  /// **'Ish joyigacha'**
  String get faceGeofenceDistanceLabel;

  /// No description provided for @meterSuffix.
  ///
  /// In uz, this message translates to:
  /// **'m'**
  String get meterSuffix;

  /// No description provided for @outsideGeofence.
  ///
  /// In uz, this message translates to:
  /// **'Siz ish hududidan tashqaridasiz'**
  String get outsideGeofence;

  /// No description provided for @checkinSuccess.
  ///
  /// In uz, this message translates to:
  /// **'Davomat tasdiqlandi'**
  String get checkinSuccess;

  /// No description provided for @home.
  ///
  /// In uz, this message translates to:
  /// **'Bosh sahifa'**
  String get home;

  /// No description provided for @requests.
  ///
  /// In uz, this message translates to:
  /// **'Murojaatlar'**
  String get requests;

  /// No description provided for @chat.
  ///
  /// In uz, this message translates to:
  /// **'Chat'**
  String get chat;

  /// No description provided for @map.
  ///
  /// In uz, this message translates to:
  /// **'Xarita'**
  String get map;

  /// No description provided for @profile.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get profile;

  /// No description provided for @citizenTagline.
  ///
  /// In uz, this message translates to:
  /// **'Fuqarolar uchun raqamli xizmatlar'**
  String get citizenTagline;

  /// No description provided for @welcomeGreeting.
  ///
  /// In uz, this message translates to:
  /// **'Xush kelibsiz,'**
  String get welcomeGreeting;

  /// No description provided for @otpChannelInfo.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash uchun SMS kod yuboramiz'**
  String get otpChannelInfo;

  /// No description provided for @helpLine.
  ///
  /// In uz, this message translates to:
  /// **'Yordam: 1090'**
  String get helpLine;

  /// OTP yuborilgan telefon raqami haqida xabar
  ///
  /// In uz, this message translates to:
  /// **'Kod {phone} raqamiga yuborildi'**
  String otpSentTo(String phone);

  /// No description provided for @resendCode.
  ///
  /// In uz, this message translates to:
  /// **'Kodni qayta yuborish'**
  String get resendCode;

  /// No description provided for @confirm.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get confirm;

  /// No description provided for @errorGeneric.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik'**
  String get errorGeneric;

  /// No description provided for @logout.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get logout;

  /// No description provided for @logoutConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'Chiqishni tasdiqlaysizmi?'**
  String get logoutConfirmTitle;

  /// No description provided for @logoutConfirmMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingizdan chiqasiz — keyin qaytadan kirishingiz kerak bo\'ladi.'**
  String get logoutConfirmMessage;

  /// No description provided for @logoutConfirmCta.
  ///
  /// In uz, this message translates to:
  /// **'Ha, chiqish'**
  String get logoutConfirmCta;

  /// No description provided for @cancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get cancel;

  /// No description provided for @homeGreeting.
  ///
  /// In uz, this message translates to:
  /// **'Xush kelibsiz'**
  String get homeGreeting;

  /// No description provided for @todayStatusTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bugungi holat'**
  String get todayStatusTitle;

  /// No description provided for @attendanceStatusPresent.
  ///
  /// In uz, this message translates to:
  /// **'Keldi'**
  String get attendanceStatusPresent;

  /// No description provided for @attendanceStatusLate.
  ///
  /// In uz, this message translates to:
  /// **'Kechikdi'**
  String get attendanceStatusLate;

  /// No description provided for @attendanceStatusAbsent.
  ///
  /// In uz, this message translates to:
  /// **'Kelmadi'**
  String get attendanceStatusAbsent;

  /// No description provided for @attendanceStatusLeave.
  ///
  /// In uz, this message translates to:
  /// **'Ta\'tilda'**
  String get attendanceStatusLeave;

  /// No description provided for @notCheckedInYet.
  ///
  /// In uz, this message translates to:
  /// **'Hali belgilanmagan'**
  String get notCheckedInYet;

  /// No description provided for @checkInTimeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Kelgan vaqt'**
  String get checkInTimeLabel;

  /// No description provided for @homeCheckinCta.
  ///
  /// In uz, this message translates to:
  /// **'Yuz bilan tasdiqlash'**
  String get homeCheckinCta;

  /// No description provided for @locationCheckFailed.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuvni aniqlab bo\'lmadi'**
  String get locationCheckFailed;

  /// No description provided for @weeklyChartTitle.
  ///
  /// In uz, this message translates to:
  /// **'So\'nggi 7 kun'**
  String get weeklyChartTitle;

  /// No description provided for @statHoursThisWeek.
  ///
  /// In uz, this message translates to:
  /// **'Bu hafta soat'**
  String get statHoursThisWeek;

  /// No description provided for @statDaysPresent.
  ///
  /// In uz, this message translates to:
  /// **'Kelgan kunlar'**
  String get statDaysPresent;

  /// No description provided for @statLateDays.
  ///
  /// In uz, this message translates to:
  /// **'Kechikkan kunlar'**
  String get statLateDays;

  /// No description provided for @attendanceEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Davomat tarixi topilmadi'**
  String get attendanceEmptyTitle;

  /// No description provided for @attendanceEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hali davomat yozuvlari mavjud emas'**
  String get attendanceEmptyMessage;

  /// No description provided for @attendanceErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Davomatni yuklab bo\'lmadi'**
  String get attendanceErrorTitle;

  /// No description provided for @comingSoonTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tez orada'**
  String get comingSoonTitle;

  /// No description provided for @comingSoonMessage.
  ///
  /// In uz, this message translates to:
  /// **'Bu bo\'lim hali ishlab chiqilmoqda'**
  String get comingSoonMessage;

  /// No description provided for @routeNotFoundTitle.
  ///
  /// In uz, this message translates to:
  /// **'Sahifa topilmadi'**
  String get routeNotFoundTitle;

  /// No description provided for @routeNotFoundMessage.
  ///
  /// In uz, this message translates to:
  /// **'Bunday manzil mavjud emas'**
  String get routeNotFoundMessage;

  /// No description provided for @quickActionsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tezkor xizmatlar'**
  String get quickActionsTitle;

  /// No description provided for @quickActionKommunalka.
  ///
  /// In uz, this message translates to:
  /// **'Kommunalka'**
  String get quickActionKommunalka;

  /// No description provided for @quickActionNewApplication.
  ///
  /// In uz, this message translates to:
  /// **'Ariza'**
  String get quickActionNewApplication;

  /// No description provided for @quickActionComplaint.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyat'**
  String get quickActionComplaint;

  /// No description provided for @quickActionPaymentHistory.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovlar tarixi'**
  String get quickActionPaymentHistory;

  /// No description provided for @totalDueTitle.
  ///
  /// In uz, this message translates to:
  /// **'Jami qarzdorlik'**
  String get totalDueTitle;

  /// No description provided for @totalDueCaption.
  ///
  /// In uz, this message translates to:
  /// **'Barcha kommunal xizmatlar bo\'yicha'**
  String get totalDueCaption;

  /// No description provided for @homeDueEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qarzlaringiz yo\'q'**
  String get homeDueEmptyTitle;

  /// No description provided for @homeDueEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Barcha kommunal to\'lovlar to\'langan'**
  String get homeDueEmptyMessage;

  /// No description provided for @dataLoadErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlarni yuklab bo\'lmadi'**
  String get dataLoadErrorTitle;

  /// No description provided for @utilitiesPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kommunal xizmatlar'**
  String get utilitiesPageTitle;

  /// No description provided for @utilitiesEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xizmatlar topilmadi'**
  String get utilitiesEmptyTitle;

  /// No description provided for @utilitiesEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Sizga biriktirilgan kommunal xizmatlar mavjud emas'**
  String get utilitiesEmptyMessage;

  /// No description provided for @utilityTypeElektr.
  ///
  /// In uz, this message translates to:
  /// **'Elektr energiyasi'**
  String get utilityTypeElektr;

  /// No description provided for @utilityTypeGaz.
  ///
  /// In uz, this message translates to:
  /// **'Tabiiy gaz'**
  String get utilityTypeGaz;

  /// No description provided for @utilityTypeSuv.
  ///
  /// In uz, this message translates to:
  /// **'Suv ta\'minoti'**
  String get utilityTypeSuv;

  /// No description provided for @utilityTypeIssiqlik.
  ///
  /// In uz, this message translates to:
  /// **'Issiqlik ta\'minoti'**
  String get utilityTypeIssiqlik;

  /// No description provided for @utilityTypeChiqindi.
  ///
  /// In uz, this message translates to:
  /// **'Maishiy chiqindi'**
  String get utilityTypeChiqindi;

  /// No description provided for @accountNumberLabel.
  ///
  /// In uz, this message translates to:
  /// **'Hisob raqami'**
  String get accountNumberLabel;

  /// No description provided for @noDebtLabel.
  ///
  /// In uz, this message translates to:
  /// **'Qarz yo\'q'**
  String get noDebtLabel;

  /// No description provided for @payButtonLabel.
  ///
  /// In uz, this message translates to:
  /// **'To\'lash'**
  String get payButtonLabel;

  /// No description provided for @payPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov'**
  String get payPageTitle;

  /// No description provided for @amountLabel.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov summasi'**
  String get amountLabel;

  /// No description provided for @amountHint.
  ///
  /// In uz, this message translates to:
  /// **'Summani kiriting'**
  String get amountHint;

  /// No description provided for @amountSuffix.
  ///
  /// In uz, this message translates to:
  /// **'so\'m'**
  String get amountSuffix;

  /// No description provided for @cardNumberLabel.
  ///
  /// In uz, this message translates to:
  /// **'Karta raqami'**
  String get cardNumberLabel;

  /// No description provided for @cardNumberHint.
  ///
  /// In uz, this message translates to:
  /// **'0000 0000 0000 0000'**
  String get cardNumberHint;

  /// No description provided for @cardMockNotice.
  ///
  /// In uz, this message translates to:
  /// **'Bu — mock karta, haqiqiy mablag\' yechilmaydi'**
  String get cardMockNotice;

  /// No description provided for @payConfirmButton.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovni tasdiqlash'**
  String get payConfirmButton;

  /// No description provided for @paySuccessTitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov muvaffaqiyatli!'**
  String get paySuccessTitle;

  /// No description provided for @paySuccessMessage.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovingiz muvaffaqiyatli qabul qilindi'**
  String get paySuccessMessage;

  /// No description provided for @closeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Yopish'**
  String get closeLabel;

  /// No description provided for @paymentHistoryPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovlar tarixi'**
  String get paymentHistoryPageTitle;

  /// No description provided for @paymentHistoryEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovlar topilmadi'**
  String get paymentHistoryEmptyTitle;

  /// No description provided for @paymentHistoryEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hali birorta to\'lov amalga oshirilmagan'**
  String get paymentHistoryEmptyMessage;

  /// No description provided for @paymentStatusSuccess.
  ///
  /// In uz, this message translates to:
  /// **'Muvaffaqiyatli'**
  String get paymentStatusSuccess;

  /// No description provided for @paymentStatusFailed.
  ///
  /// In uz, this message translates to:
  /// **'Muvaffaqiyatsiz'**
  String get paymentStatusFailed;

  /// No description provided for @paymentStatusPending.
  ///
  /// In uz, this message translates to:
  /// **'Kutilmoqda'**
  String get paymentStatusPending;

  /// To'lov qaysi kartadan amalga oshirilgani (oxirgi 4 raqam)
  ///
  /// In uz, this message translates to:
  /// **'Karta •••• {last4}'**
  String paidWithCard(String last4);

  /// No description provided for @cardExpiryLabel.
  ///
  /// In uz, this message translates to:
  /// **'Amal qilish muddati'**
  String get cardExpiryLabel;

  /// No description provided for @cardExpiryHint.
  ///
  /// In uz, this message translates to:
  /// **'OO/YY'**
  String get cardExpiryHint;

  /// No description provided for @savedCardsSectionLabel.
  ///
  /// In uz, this message translates to:
  /// **'Kartani tanlang'**
  String get savedCardsSectionLabel;

  /// No description provided for @addNewCardOption.
  ///
  /// In uz, this message translates to:
  /// **'Yangi karta'**
  String get addNewCardOption;

  /// No description provided for @cardBalanceLabel.
  ///
  /// In uz, this message translates to:
  /// **'Balans'**
  String get cardBalanceLabel;

  /// No description provided for @insufficientFundsMessage.
  ///
  /// In uz, this message translates to:
  /// **'Kartada mablag\' yetarli emas'**
  String get insufficientFundsMessage;

  /// No description provided for @smsConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kodni tasdiqlang'**
  String get smsConfirmTitle;

  /// No description provided for @smsConfirmMessage.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash kodi kartangizga bog\'langan raqamga yuborildi'**
  String get smsConfirmMessage;

  /// Mock SMS tasdiqlash kodi haqida yordamchi matn (haqiqiy SMS yuborilmaydi)
  ///
  /// In uz, this message translates to:
  /// **'Namuna uchun (mock): {code}'**
  String smsDemoCodeHint(String code);

  /// No description provided for @receiptPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Chek'**
  String get receiptPageTitle;

  /// No description provided for @receiptDateLabel.
  ///
  /// In uz, this message translates to:
  /// **'Sana'**
  String get receiptDateLabel;

  /// No description provided for @receiptTransactionIdLabel.
  ///
  /// In uz, this message translates to:
  /// **'Tranzaksiya raqami'**
  String get receiptTransactionIdLabel;

  /// No description provided for @receiptShareButton.
  ///
  /// In uz, this message translates to:
  /// **'Ulashish'**
  String get receiptShareButton;

  /// No description provided for @receiptShareError.
  ///
  /// In uz, this message translates to:
  /// **'Chekni ulashib bo\'lmadi'**
  String get receiptShareError;

  /// No description provided for @filterTypeAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get filterTypeAll;

  /// No description provided for @filterTypeElektr.
  ///
  /// In uz, this message translates to:
  /// **'Elektr'**
  String get filterTypeElektr;

  /// No description provided for @filterTypeGaz.
  ///
  /// In uz, this message translates to:
  /// **'Gaz'**
  String get filterTypeGaz;

  /// No description provided for @filterTypeSuv.
  ///
  /// In uz, this message translates to:
  /// **'Suv'**
  String get filterTypeSuv;

  /// No description provided for @filterTypeIssiqlik.
  ///
  /// In uz, this message translates to:
  /// **'Issiqlik'**
  String get filterTypeIssiqlik;

  /// No description provided for @filterTypeChiqindi.
  ///
  /// In uz, this message translates to:
  /// **'Chiqindi'**
  String get filterTypeChiqindi;

  /// No description provided for @paymentsTab.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovlar'**
  String get paymentsTab;

  /// No description provided for @applicationsTab.
  ///
  /// In uz, this message translates to:
  /// **'Arizalar'**
  String get applicationsTab;

  /// No description provided for @requestsTabAssigned.
  ///
  /// In uz, this message translates to:
  /// **'Menga biriktirilgan'**
  String get requestsTabAssigned;

  /// No description provided for @requestsTabRelevant.
  ///
  /// In uz, this message translates to:
  /// **'Tegishli'**
  String get requestsTabRelevant;

  /// No description provided for @requestsSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'Murojaatlarni qidirish'**
  String get requestsSearchHint;

  /// No description provided for @requestsFilterTitle.
  ///
  /// In uz, this message translates to:
  /// **'Filtr'**
  String get requestsFilterTitle;

  /// No description provided for @requestsFilterStatusLabel.
  ///
  /// In uz, this message translates to:
  /// **'Holat'**
  String get requestsFilterStatusLabel;

  /// No description provided for @requestsFilterPriorityLabel.
  ///
  /// In uz, this message translates to:
  /// **'Muhimlik darajasi'**
  String get requestsFilterPriorityLabel;

  /// No description provided for @requestsFilterAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get requestsFilterAll;

  /// No description provided for @requestsEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Murojaatlar topilmadi'**
  String get requestsEmptyTitle;

  /// No description provided for @requestsEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha ko\'rsatish uchun murojaatlar yo\'q'**
  String get requestsEmptyMessage;

  /// No description provided for @requestsEmptyFilteredMessage.
  ///
  /// In uz, this message translates to:
  /// **'Tanlangan filtrlar bo\'yicha murojaatlar topilmadi'**
  String get requestsEmptyFilteredMessage;

  /// No description provided for @requestsErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Murojaatlarni yuklab bo\'lmadi'**
  String get requestsErrorTitle;

  /// No description provided for @statusYangi.
  ///
  /// In uz, this message translates to:
  /// **'Yangi'**
  String get statusYangi;

  /// No description provided for @statusJarayonda.
  ///
  /// In uz, this message translates to:
  /// **'Jarayonda'**
  String get statusJarayonda;

  /// No description provided for @statusJavobBerildi.
  ///
  /// In uz, this message translates to:
  /// **'Javob berildi'**
  String get statusJavobBerildi;

  /// No description provided for @statusYopildi.
  ///
  /// In uz, this message translates to:
  /// **'Yopildi'**
  String get statusYopildi;

  /// No description provided for @statusRad.
  ///
  /// In uz, this message translates to:
  /// **'Rad etildi'**
  String get statusRad;

  /// No description provided for @priorityPast.
  ///
  /// In uz, this message translates to:
  /// **'Past'**
  String get priorityPast;

  /// No description provided for @priorityOrta.
  ///
  /// In uz, this message translates to:
  /// **'O\'rta'**
  String get priorityOrta;

  /// No description provided for @priorityYuqori.
  ///
  /// In uz, this message translates to:
  /// **'Yuqori'**
  String get priorityYuqori;

  /// No description provided for @pointsSuffix.
  ///
  /// In uz, this message translates to:
  /// **'ball'**
  String get pointsSuffix;

  /// No description provided for @requestDetailTitle.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat tafsilotlari'**
  String get requestDetailTitle;

  /// No description provided for @requestDescriptionTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tavsif'**
  String get requestDescriptionTitle;

  /// No description provided for @requestCitizenInfoTitle.
  ///
  /// In uz, this message translates to:
  /// **'Fuqaro ma\'lumotlari'**
  String get requestCitizenInfoTitle;

  /// No description provided for @requestAttachmentsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Biriktirilgan fayllar'**
  String get requestAttachmentsTitle;

  /// No description provided for @requestNoAttachments.
  ///
  /// In uz, this message translates to:
  /// **'Biriktirilgan fayllar yo\'q'**
  String get requestNoAttachments;

  /// No description provided for @requestResponseTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xodim javobi'**
  String get requestResponseTitle;

  /// No description provided for @requestDeadlineLabel.
  ///
  /// In uz, this message translates to:
  /// **'Muddat'**
  String get requestDeadlineLabel;

  /// No description provided for @requestRespondCta.
  ///
  /// In uz, this message translates to:
  /// **'Javob yozish'**
  String get requestRespondCta;

  /// No description provided for @requestRateCta.
  ///
  /// In uz, this message translates to:
  /// **'Ball qo\'yish'**
  String get requestRateCta;

  /// No description provided for @requestRespondPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Murojaatga javob'**
  String get requestRespondPageTitle;

  /// No description provided for @requestResponseHint.
  ///
  /// In uz, this message translates to:
  /// **'Javob matnini kiriting'**
  String get requestResponseHint;

  /// No description provided for @requestResponseEmptyError.
  ///
  /// In uz, this message translates to:
  /// **'Javob matnini kiriting'**
  String get requestResponseEmptyError;

  /// No description provided for @requestSendResponse.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get requestSendResponse;

  /// No description provided for @requestRateSheetTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ball qo\'yish'**
  String get requestRateSheetTitle;

  /// No description provided for @requestRateHint.
  ///
  /// In uz, this message translates to:
  /// **'Yulduzchalarni tanlang'**
  String get requestRateHint;

  /// No description provided for @requestRateSubmit.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get requestRateSubmit;

  /// No description provided for @requestRespondSuccessTitle.
  ///
  /// In uz, this message translates to:
  /// **'Javob yuborildi'**
  String get requestRespondSuccessTitle;

  /// No description provided for @requestRespondSuccessMessage.
  ///
  /// In uz, this message translates to:
  /// **'Murojaatga javobingiz saqlandi'**
  String get requestRespondSuccessMessage;

  /// No description provided for @requestRateSuccessTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ball qo\'yildi'**
  String get requestRateSuccessTitle;

  /// No description provided for @requestRateSuccessMessage.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat muvaffaqiyatli baholandi'**
  String get requestRateSuccessMessage;

  /// No description provided for @requestNotFoundTitle.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat topilmadi'**
  String get requestNotFoundTitle;

  /// No description provided for @leaveRequestTileLabel.
  ///
  /// In uz, this message translates to:
  /// **'Javob so\'rash'**
  String get leaveRequestTileLabel;

  /// No description provided for @leaveRequestPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Javob so\'rash'**
  String get leaveRequestPageTitle;

  /// No description provided for @leaveRequestDurationTypeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Muddat turi'**
  String get leaveRequestDurationTypeLabel;

  /// No description provided for @leaveRequestDurationHours.
  ///
  /// In uz, this message translates to:
  /// **'Soatlab'**
  String get leaveRequestDurationHours;

  /// No description provided for @leaveRequestDurationDays.
  ///
  /// In uz, this message translates to:
  /// **'Kunlab'**
  String get leaveRequestDurationDays;

  /// No description provided for @leaveRequestAmountLabel.
  ///
  /// In uz, this message translates to:
  /// **'Miqdor'**
  String get leaveRequestAmountLabel;

  /// No description provided for @leaveRequestHoursUnit.
  ///
  /// In uz, this message translates to:
  /// **'soat'**
  String get leaveRequestHoursUnit;

  /// No description provided for @leaveRequestDaysUnit.
  ///
  /// In uz, this message translates to:
  /// **'kun'**
  String get leaveRequestDaysUnit;

  /// No description provided for @leaveRequestStartDateLabel.
  ///
  /// In uz, this message translates to:
  /// **'Boshlanish sanasi'**
  String get leaveRequestStartDateLabel;

  /// No description provided for @leaveRequestStartTimeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Boshlanish vaqti'**
  String get leaveRequestStartTimeLabel;

  /// No description provided for @leaveRequestReasonLabel.
  ///
  /// In uz, this message translates to:
  /// **'Sabab'**
  String get leaveRequestReasonLabel;

  /// No description provided for @leaveRequestReasonHint.
  ///
  /// In uz, this message translates to:
  /// **'So\'rov sababini kiriting'**
  String get leaveRequestReasonHint;

  /// No description provided for @leaveRequestReasonEmptyError.
  ///
  /// In uz, this message translates to:
  /// **'Sababni kiriting'**
  String get leaveRequestReasonEmptyError;

  /// No description provided for @leaveRequestMaxNote.
  ///
  /// In uz, this message translates to:
  /// **'Maksimal — 1 ish haftasi (6 ish kuni)'**
  String get leaveRequestMaxNote;

  /// No description provided for @leaveRequestSubmitCta.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get leaveRequestSubmitCta;

  /// No description provided for @leaveRequestSuccessTitle.
  ///
  /// In uz, this message translates to:
  /// **'So\'rov yuborildi'**
  String get leaveRequestSuccessTitle;

  /// No description provided for @leaveRequestSuccessMessage.
  ///
  /// In uz, this message translates to:
  /// **'Javob so\'rash uchun so\'rovingiz yuborildi va ko\'rib chiqilmoqda'**
  String get leaveRequestSuccessMessage;

  /// No description provided for @createRequestTitle.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat yaratish'**
  String get createRequestTitle;

  /// No description provided for @createRequestTitleLabel.
  ///
  /// In uz, this message translates to:
  /// **'Sarlavha'**
  String get createRequestTitleLabel;

  /// No description provided for @createRequestTitleHint.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat sarlavhasini kiriting'**
  String get createRequestTitleHint;

  /// No description provided for @createRequestCategoryLabel.
  ///
  /// In uz, this message translates to:
  /// **'Kategoriya'**
  String get createRequestCategoryLabel;

  /// No description provided for @createRequestCategoryHint.
  ///
  /// In uz, this message translates to:
  /// **'Kategoriyani tanlang'**
  String get createRequestCategoryHint;

  /// No description provided for @createRequestPriorityLabel.
  ///
  /// In uz, this message translates to:
  /// **'Muhimlik darajasi'**
  String get createRequestPriorityLabel;

  /// No description provided for @createRequestDescriptionLabel.
  ///
  /// In uz, this message translates to:
  /// **'Tavsif'**
  String get createRequestDescriptionLabel;

  /// No description provided for @createRequestDescriptionHint.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat tavsifini batafsil yozing'**
  String get createRequestDescriptionHint;

  /// No description provided for @createRequestAttachmentsLabel.
  ///
  /// In uz, this message translates to:
  /// **'Biriktirilgan fayllar'**
  String get createRequestAttachmentsLabel;

  /// No description provided for @createRequestSubmit.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get createRequestSubmit;

  /// No description provided for @createRequestSuccessTitle.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat yuborildi'**
  String get createRequestSuccessTitle;

  /// No description provided for @createRequestSuccessMessage.
  ///
  /// In uz, this message translates to:
  /// **'Murojaatingiz muvaffaqiyatli yuborildi'**
  String get createRequestSuccessMessage;

  /// No description provided for @createRequestValidationError.
  ///
  /// In uz, this message translates to:
  /// **'Majburiy'**
  String get createRequestValidationError;

  /// No description provided for @attachmentAddImage.
  ///
  /// In uz, this message translates to:
  /// **'Rasm'**
  String get attachmentAddImage;

  /// No description provided for @attachmentAddVideo.
  ///
  /// In uz, this message translates to:
  /// **'Video'**
  String get attachmentAddVideo;

  /// No description provided for @attachmentAddVoice.
  ///
  /// In uz, this message translates to:
  /// **'Ovozli xabar'**
  String get attachmentAddVoice;

  /// No description provided for @attachmentAddFile.
  ///
  /// In uz, this message translates to:
  /// **'Fayl'**
  String get attachmentAddFile;

  /// No description provided for @attachmentPickSource.
  ///
  /// In uz, this message translates to:
  /// **'Manbani tanlang'**
  String get attachmentPickSource;

  /// No description provided for @attachmentCamera.
  ///
  /// In uz, this message translates to:
  /// **'Kamera'**
  String get attachmentCamera;

  /// No description provided for @attachmentGallery.
  ///
  /// In uz, this message translates to:
  /// **'Galereya'**
  String get attachmentGallery;

  /// No description provided for @attachmentPickError.
  ///
  /// In uz, this message translates to:
  /// **'Faylni tanlab bo\'lmadi'**
  String get attachmentPickError;

  /// No description provided for @attachmentPlaybackError.
  ///
  /// In uz, this message translates to:
  /// **'Ijro etib bo\'lmadi'**
  String get attachmentPlaybackError;

  /// No description provided for @recorderGrantPermission.
  ///
  /// In uz, this message translates to:
  /// **'Ruxsat berish'**
  String get recorderGrantPermission;

  /// No description provided for @recorderOpenSettings.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalarni ochish'**
  String get recorderOpenSettings;

  /// No description provided for @voiceRecorderTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ovozli xabar'**
  String get voiceRecorderTitle;

  /// No description provided for @voiceRecorderIdleHint.
  ///
  /// In uz, this message translates to:
  /// **'Yozishni boshlash uchun mikrofonga bosing'**
  String get voiceRecorderIdleHint;

  /// No description provided for @voiceRecorderRecordingHint.
  ///
  /// In uz, this message translates to:
  /// **'Yozilmoqda…'**
  String get voiceRecorderRecordingHint;

  /// No description provided for @voiceRecorderReadyHint.
  ///
  /// In uz, this message translates to:
  /// **'Tinglab ko\'ring va biriktiring'**
  String get voiceRecorderReadyHint;

  /// No description provided for @voiceRecorderRetake.
  ///
  /// In uz, this message translates to:
  /// **'Qayta yozish'**
  String get voiceRecorderRetake;

  /// No description provided for @voiceRecorderAttach.
  ///
  /// In uz, this message translates to:
  /// **'Biriktirish'**
  String get voiceRecorderAttach;

  /// No description provided for @voiceRecorderPermissionTitle.
  ///
  /// In uz, this message translates to:
  /// **'Mikrofonga ruxsat kerak'**
  String get voiceRecorderPermissionTitle;

  /// No description provided for @voiceRecorderPermissionMessage.
  ///
  /// In uz, this message translates to:
  /// **'Ovozli xabar yozish uchun mikrofondan foydalanishga ruxsat bering.'**
  String get voiceRecorderPermissionMessage;

  /// No description provided for @voiceRecorderError.
  ///
  /// In uz, this message translates to:
  /// **'Ovoz yozib bo\'lmadi'**
  String get voiceRecorderError;

  /// No description provided for @videoRecorderTitle.
  ///
  /// In uz, this message translates to:
  /// **'Video yozish'**
  String get videoRecorderTitle;

  /// No description provided for @videoRecorderPermissionTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kameraga ruxsat kerak'**
  String get videoRecorderPermissionTitle;

  /// No description provided for @videoRecorderPermissionMessage.
  ///
  /// In uz, this message translates to:
  /// **'Video yozish uchun kamera va mikrofondan foydalanishga ruxsat bering.'**
  String get videoRecorderPermissionMessage;

  /// No description provided for @videoRecorderError.
  ///
  /// In uz, this message translates to:
  /// **'Video yozib bo\'lmadi'**
  String get videoRecorderError;

  /// No description provided for @videoRecorderRetake.
  ///
  /// In uz, this message translates to:
  /// **'Qayta olish'**
  String get videoRecorderRetake;

  /// No description provided for @videoRecorderAttach.
  ///
  /// In uz, this message translates to:
  /// **'Ishlatish'**
  String get videoRecorderAttach;

  /// No description provided for @requestKindAriza.
  ///
  /// In uz, this message translates to:
  /// **'Ariza'**
  String get requestKindAriza;

  /// No description provided for @requestKindShikoyat.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyat'**
  String get requestKindShikoyat;

  /// No description provided for @citizenRequestStatusYuborilgan.
  ///
  /// In uz, this message translates to:
  /// **'Yuborilgan'**
  String get citizenRequestStatusYuborilgan;

  /// No description provided for @citizenRequestStatusKorilmoqda.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'rilmoqda'**
  String get citizenRequestStatusKorilmoqda;

  /// No description provided for @citizenRequestStatusJavobBerildi.
  ///
  /// In uz, this message translates to:
  /// **'Javob berildi'**
  String get citizenRequestStatusJavobBerildi;

  /// No description provided for @citizenRequestStatusYopildi.
  ///
  /// In uz, this message translates to:
  /// **'Yopildi'**
  String get citizenRequestStatusYopildi;

  /// No description provided for @citizenRequestsPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Murojaatlarim'**
  String get citizenRequestsPageTitle;

  /// No description provided for @citizenRequestsAddTooltip.
  ///
  /// In uz, this message translates to:
  /// **'Yangi murojaat'**
  String get citizenRequestsAddTooltip;

  /// No description provided for @citizenRequestKindLabel.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat turi'**
  String get citizenRequestKindLabel;

  /// No description provided for @citizenRequestSubmitTitle.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat yuborish'**
  String get citizenRequestSubmitTitle;

  /// No description provided for @reportsPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hisobot'**
  String get reportsPageTitle;

  /// No description provided for @reportsPaymentsCountLabel.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovlar soni'**
  String get reportsPaymentsCountLabel;

  /// No description provided for @reportsPaymentsAmountLabel.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovlar summasi'**
  String get reportsPaymentsAmountLabel;

  /// No description provided for @reportsAppealsCountLabel.
  ///
  /// In uz, this message translates to:
  /// **'Arizalar soni'**
  String get reportsAppealsCountLabel;

  /// No description provided for @reportsComplaintsCountLabel.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyatlar soni'**
  String get reportsComplaintsCountLabel;

  /// No description provided for @reportsByStatusTitle.
  ///
  /// In uz, this message translates to:
  /// **'Holat bo\'yicha taqsimot'**
  String get reportsByStatusTitle;

  /// No description provided for @profileLanguageLabel.
  ///
  /// In uz, this message translates to:
  /// **'Til'**
  String get profileLanguageLabel;

  /// No description provided for @profileLanguageUz.
  ///
  /// In uz, this message translates to:
  /// **'O\'zbekcha'**
  String get profileLanguageUz;

  /// No description provided for @profileLanguageRu.
  ///
  /// In uz, this message translates to:
  /// **'Ruscha'**
  String get profileLanguageRu;

  /// No description provided for @profileThemeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Mavzu'**
  String get profileThemeLabel;

  /// No description provided for @profileThemeLight.
  ///
  /// In uz, this message translates to:
  /// **'Yorug\''**
  String get profileThemeLight;

  /// No description provided for @profileThemeDark.
  ///
  /// In uz, this message translates to:
  /// **'Tungi'**
  String get profileThemeDark;

  /// No description provided for @profilePinLabel.
  ///
  /// In uz, this message translates to:
  /// **'PIN o\'zgartirish'**
  String get profilePinLabel;

  /// No description provided for @profileHelpLabel.
  ///
  /// In uz, this message translates to:
  /// **'Yordam'**
  String get profileHelpLabel;

  /// No description provided for @profileReportsLabel.
  ///
  /// In uz, this message translates to:
  /// **'Hisobotlar'**
  String get profileReportsLabel;

  /// No description provided for @chatTabAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get chatTabAll;

  /// No description provided for @chatTabPersonal.
  ///
  /// In uz, this message translates to:
  /// **'Shaxsiy'**
  String get chatTabPersonal;

  /// No description provided for @chatTabGroup.
  ///
  /// In uz, this message translates to:
  /// **'Guruh'**
  String get chatTabGroup;

  /// No description provided for @chatSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'Suhbatlarni qidirish'**
  String get chatSearchHint;

  /// No description provided for @chatEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Suhbatlar topilmadi'**
  String get chatEmptyTitle;

  /// No description provided for @chatEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha birorta suhbat yo\'q'**
  String get chatEmptyMessage;

  /// No description provided for @chatEmptyFilteredMessage.
  ///
  /// In uz, this message translates to:
  /// **'Qidiruv bo\'yicha hech narsa topilmadi'**
  String get chatEmptyFilteredMessage;

  /// No description provided for @chatErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Suhbatlarni yuklab bo\'lmadi'**
  String get chatErrorTitle;

  /// Suhbatdagi ishtirokchilar soni (suhbat sahifasi sarlavhasi ostida)
  ///
  /// In uz, this message translates to:
  /// **'{count} ishtirokchi'**
  String chatParticipantsCount(int count);

  /// No description provided for @conversationEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xabarlar yo\'q'**
  String get conversationEmptyTitle;

  /// No description provided for @conversationEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Birinchi xabarni yuboring'**
  String get conversationEmptyMessage;

  /// No description provided for @conversationErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xabarlarni yuklab bo\'lmadi'**
  String get conversationErrorTitle;

  /// No description provided for @chatMessageHint.
  ///
  /// In uz, this message translates to:
  /// **'Xabar yozing...'**
  String get chatMessageHint;

  /// No description provided for @chatAttachSheetTitle.
  ///
  /// In uz, this message translates to:
  /// **'Biriktirish'**
  String get chatAttachSheetTitle;

  /// No description provided for @chatAttachRoundVideo.
  ///
  /// In uz, this message translates to:
  /// **'Dumaloq video xabar'**
  String get chatAttachRoundVideo;

  /// No description provided for @chatAttachSticker.
  ///
  /// In uz, this message translates to:
  /// **'Stiker'**
  String get chatAttachSticker;

  /// No description provided for @chatStickerSheetTitle.
  ///
  /// In uz, this message translates to:
  /// **'Stikerni tanlang'**
  String get chatStickerSheetTitle;

  /// Suhbat ichidagi sana ajratgichi — bugungi xabarlar uchun (Telegram uslubidagi markazlashgan 'pill')
  ///
  /// In uz, this message translates to:
  /// **'Bugun'**
  String get chatDateToday;

  /// Suhbat ichidagi sana ajratgichi — kechagi xabarlar uchun
  ///
  /// In uz, this message translates to:
  /// **'Kecha'**
  String get chatDateYesterday;

  /// Shaxsiy suhbat sarlavhasi ostidagi mavjudlik holati — foydalanuvchi onlayn (mock presence)
  ///
  /// In uz, this message translates to:
  /// **'onlayn'**
  String get chatPresenceOnline;

  /// No description provided for @profileLanguageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Til'**
  String get profileLanguageTitle;

  /// No description provided for @languageNameUzbek.
  ///
  /// In uz, this message translates to:
  /// **'O\'zbek'**
  String get languageNameUzbek;

  /// No description provided for @languageNameRussian.
  ///
  /// In uz, this message translates to:
  /// **'Русский'**
  String get languageNameRussian;

  /// No description provided for @profileThemeTitle.
  ///
  /// In uz, this message translates to:
  /// **'Mavzu'**
  String get profileThemeTitle;

  /// No description provided for @profileThemeOptionLight.
  ///
  /// In uz, this message translates to:
  /// **'Yorug\''**
  String get profileThemeOptionLight;

  /// No description provided for @profileThemeOptionDark.
  ///
  /// In uz, this message translates to:
  /// **'Qorong\'i'**
  String get profileThemeOptionDark;

  /// No description provided for @profileWorkInfoTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ish ma\'lumotlari'**
  String get profileWorkInfoTitle;

  /// No description provided for @profileWorkingHoursLabel.
  ///
  /// In uz, this message translates to:
  /// **'Ish soatlari'**
  String get profileWorkingHoursLabel;

  /// No description provided for @profileRatingLabel.
  ///
  /// In uz, this message translates to:
  /// **'Reyting'**
  String get profileRatingLabel;

  /// No description provided for @profileDepartmentLabel.
  ///
  /// In uz, this message translates to:
  /// **'Bo\'lim'**
  String get profileDepartmentLabel;

  /// No description provided for @profileAboutTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ilova haqida'**
  String get profileAboutTitle;

  /// No description provided for @profileAppVersionLabel.
  ///
  /// In uz, this message translates to:
  /// **'Ilova versiyasi'**
  String get profileAppVersionLabel;

  /// Ishchi identifikatori (profil sarlavhasida)
  ///
  /// In uz, this message translates to:
  /// **'ID: {id}'**
  String profileWorkerIdLabel(String id);

  /// No description provided for @mapPermissionTitle.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuvga ruxsat kerak'**
  String get mapPermissionTitle;

  /// No description provided for @mapPermissionMessage.
  ///
  /// In uz, this message translates to:
  /// **'Xodimning joylashuvini kuzatish uchun joylashuvga ruxsat bering'**
  String get mapPermissionMessage;

  /// No description provided for @mapGrantPermission.
  ///
  /// In uz, this message translates to:
  /// **'Ruxsat berish'**
  String get mapGrantPermission;

  /// No description provided for @mapErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuvni kuzatib bo\'lmadi'**
  String get mapErrorTitle;

  /// No description provided for @mapNotTracking.
  ///
  /// In uz, this message translates to:
  /// **'Kuzatuv faol emas'**
  String get mapNotTracking;

  /// No description provided for @mapLocating.
  ///
  /// In uz, this message translates to:
  /// **'Joylashuv aniqlanmoqda…'**
  String get mapLocating;

  /// No description provided for @mapStartTracking.
  ///
  /// In uz, this message translates to:
  /// **'Kuzatishni boshlash'**
  String get mapStartTracking;

  /// No description provided for @mapStopTracking.
  ///
  /// In uz, this message translates to:
  /// **'Kuzatishni to\'xtatish'**
  String get mapStopTracking;

  /// No description provided for @mapRecenterTooltip.
  ///
  /// In uz, this message translates to:
  /// **'Joriy joylashuvga markazlashtirish'**
  String get mapRecenterTooltip;

  /// No description provided for @pinSetTitle.
  ///
  /// In uz, this message translates to:
  /// **'PIN kod o\'rnating'**
  String get pinSetTitle;

  /// No description provided for @pinSetSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Ilovaga tezkor va xavfsiz kirish uchun 4 xonali PIN kod yarating'**
  String get pinSetSubtitle;

  /// No description provided for @pinConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'PIN kodni tasdiqlang'**
  String get pinConfirmTitle;

  /// No description provided for @pinConfirmSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Tanlagan PIN kodingizni yana bir marta kiriting'**
  String get pinConfirmSubtitle;

  /// No description provided for @pinMismatchError.
  ///
  /// In uz, this message translates to:
  /// **'PIN kodlar mos kelmadi. Qaytadan urinib ko\'ring'**
  String get pinMismatchError;

  /// No description provided for @pinSetSuccessTitle.
  ///
  /// In uz, this message translates to:
  /// **'PIN kod muvaffaqiyatli o\'rnatildi!'**
  String get pinSetSuccessTitle;

  /// No description provided for @pinUnlockTitle.
  ///
  /// In uz, this message translates to:
  /// **'PIN kodni kiriting'**
  String get pinUnlockTitle;

  /// No description provided for @pinUnlockSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish uchun PIN kodingizni kiriting'**
  String get pinUnlockSubtitle;

  /// No description provided for @pinWrongError.
  ///
  /// In uz, this message translates to:
  /// **'Noto\'g\'ri PIN kod'**
  String get pinWrongError;

  /// No description provided for @pinStorageErrorMessage.
  ///
  /// In uz, this message translates to:
  /// **'PIN kodni saqlab bo\'lmadi. Qaytadan urinib ko\'ring'**
  String get pinStorageErrorMessage;

  /// No description provided for @pinLockedOutMessage.
  ///
  /// In uz, this message translates to:
  /// **'Juda ko\'p noto\'g\'ri urinish. Birozdan so\'ng qayta urinib ko\'ring'**
  String get pinLockedOutMessage;

  /// No description provided for @workerAppName.
  ///
  /// In uz, this message translates to:
  /// **'Hokimiyat Ishchi'**
  String get workerAppName;

  /// No description provided for @createRequestCategoryUtilities.
  ///
  /// In uz, this message translates to:
  /// **'Kommunal xizmat'**
  String get createRequestCategoryUtilities;

  /// No description provided for @createRequestCategoryRoads.
  ///
  /// In uz, this message translates to:
  /// **'Yo\'l xo\'jaligi'**
  String get createRequestCategoryRoads;

  /// No description provided for @createRequestCategoryReference.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotnoma'**
  String get createRequestCategoryReference;

  /// No description provided for @createRequestCategorySanitation.
  ///
  /// In uz, this message translates to:
  /// **'Sanitariya'**
  String get createRequestCategorySanitation;

  /// No description provided for @createRequestCategorySocialInfra.
  ///
  /// In uz, this message translates to:
  /// **'Ijtimoiy infratuzilma'**
  String get createRequestCategorySocialInfra;

  /// No description provided for @createRequestCategoryPublicOrder.
  ///
  /// In uz, this message translates to:
  /// **'Jamoat tartibi'**
  String get createRequestCategoryPublicOrder;

  /// No description provided for @createRequestCategorySocialAid.
  ///
  /// In uz, this message translates to:
  /// **'Ijtimoiy yordam'**
  String get createRequestCategorySocialAid;

  /// No description provided for @createRequestCategoryEducation.
  ///
  /// In uz, this message translates to:
  /// **'Ta\'lim'**
  String get createRequestCategoryEducation;

  /// No description provided for @createRequestCategoryConstruction.
  ///
  /// In uz, this message translates to:
  /// **'Qurilish'**
  String get createRequestCategoryConstruction;

  /// No description provided for @searchHint.
  ///
  /// In uz, this message translates to:
  /// **'Qidirish'**
  String get searchHint;

  /// No description provided for @registrationPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get registrationPageTitle;

  /// No description provided for @registrationHeadline.
  ///
  /// In uz, this message translates to:
  /// **'Shaxsiy ma\'lumotlaringiz'**
  String get registrationHeadline;

  /// No description provided for @registrationSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish uchun quyidagi ma\'lumotlarni to\'ldiring'**
  String get registrationSubtitle;

  /// No description provided for @registrationFullNameLabel.
  ///
  /// In uz, this message translates to:
  /// **'F.I.Sh. (to\'liq ism)'**
  String get registrationFullNameLabel;

  /// No description provided for @registrationFullNameHint.
  ///
  /// In uz, this message translates to:
  /// **'Familiya Ism Sharif'**
  String get registrationFullNameHint;

  /// No description provided for @registrationDocumentTypeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Hujjat turi'**
  String get registrationDocumentTypeLabel;

  /// No description provided for @registrationDocumentTypePinfl.
  ///
  /// In uz, this message translates to:
  /// **'JSHSHIR'**
  String get registrationDocumentTypePinfl;

  /// No description provided for @registrationDocumentTypePassport.
  ///
  /// In uz, this message translates to:
  /// **'Pasport'**
  String get registrationDocumentTypePassport;

  /// No description provided for @registrationPinflLabel.
  ///
  /// In uz, this message translates to:
  /// **'JSHSHIR (14 raqam)'**
  String get registrationPinflLabel;

  /// No description provided for @registrationPinflHint.
  ///
  /// In uz, this message translates to:
  /// **'12345678901234'**
  String get registrationPinflHint;

  /// No description provided for @registrationPassportLabel.
  ///
  /// In uz, this message translates to:
  /// **'Pasport seriya va raqami'**
  String get registrationPassportLabel;

  /// No description provided for @registrationPassportHint.
  ///
  /// In uz, this message translates to:
  /// **'AA1234567'**
  String get registrationPassportHint;

  /// No description provided for @registrationBirthDateLabel.
  ///
  /// In uz, this message translates to:
  /// **'Tug\'ilgan sana'**
  String get registrationBirthDateLabel;

  /// No description provided for @registrationBirthDateHint.
  ///
  /// In uz, this message translates to:
  /// **'KK.OO.YYYY'**
  String get registrationBirthDateHint;

  /// No description provided for @registrationRegionLabel.
  ///
  /// In uz, this message translates to:
  /// **'Viloyat'**
  String get registrationRegionLabel;

  /// No description provided for @registrationRegionHint.
  ///
  /// In uz, this message translates to:
  /// **'Viloyatni tanlang'**
  String get registrationRegionHint;

  /// No description provided for @registrationDistrictLabel.
  ///
  /// In uz, this message translates to:
  /// **'Tuman'**
  String get registrationDistrictLabel;

  /// No description provided for @registrationDistrictHint.
  ///
  /// In uz, this message translates to:
  /// **'Tumanni tanlang'**
  String get registrationDistrictHint;

  /// No description provided for @registrationDistrictHintNoRegion.
  ///
  /// In uz, this message translates to:
  /// **'Avval viloyatni tanlang'**
  String get registrationDistrictHintNoRegion;

  /// No description provided for @registrationAddressLabel.
  ///
  /// In uz, this message translates to:
  /// **'Yashash manzili'**
  String get registrationAddressLabel;

  /// No description provided for @registrationAddressHint.
  ///
  /// In uz, this message translates to:
  /// **'Uy manzilingizni kiriting'**
  String get registrationAddressHint;

  /// No description provided for @registrationSubmit.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish'**
  String get registrationSubmit;

  /// No description provided for @registrationSuccessTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlar muvaffaqiyatli saqlandi!'**
  String get registrationSuccessTitle;

  /// No description provided for @registrationFullNameError.
  ///
  /// In uz, this message translates to:
  /// **'To\'liq ismingizni kiriting (kamida ism va familiya)'**
  String get registrationFullNameError;

  /// No description provided for @registrationPinflError.
  ///
  /// In uz, this message translates to:
  /// **'JSHSHIR 14 ta raqamdan iborat bo\'lishi kerak'**
  String get registrationPinflError;

  /// No description provided for @registrationPassportError.
  ///
  /// In uz, this message translates to:
  /// **'Pasport: 2 harf + 7 raqam (masalan AA1234567)'**
  String get registrationPassportError;

  /// No description provided for @registrationBirthDateError.
  ///
  /// In uz, this message translates to:
  /// **'Tug\'ilgan sanani to\'g\'ri kiriting (masalan 01.01.1990)'**
  String get registrationBirthDateError;

  /// No description provided for @registrationRegionError.
  ///
  /// In uz, this message translates to:
  /// **'Viloyatni tanlang'**
  String get registrationRegionError;

  /// No description provided for @registrationDistrictError.
  ///
  /// In uz, this message translates to:
  /// **'Tumanni tanlang'**
  String get registrationDistrictError;

  /// No description provided for @registrationAddressError.
  ///
  /// In uz, this message translates to:
  /// **'Manzilingizni kiriting (kamida 5 belgi)'**
  String get registrationAddressError;

  /// No description provided for @registrationStorageErrorMessage.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlarni saqlab bo\'lmadi. Qaytadan urinib ko\'ring'**
  String get registrationStorageErrorMessage;

  /// No description provided for @registrationRegionToshkentShahri.
  ///
  /// In uz, this message translates to:
  /// **'Toshkent shahri'**
  String get registrationRegionToshkentShahri;

  /// No description provided for @registrationRegionToshkentViloyati.
  ///
  /// In uz, this message translates to:
  /// **'Toshkent viloyati'**
  String get registrationRegionToshkentViloyati;

  /// No description provided for @registrationRegionAndijon.
  ///
  /// In uz, this message translates to:
  /// **'Andijon viloyati'**
  String get registrationRegionAndijon;

  /// No description provided for @registrationRegionFargona.
  ///
  /// In uz, this message translates to:
  /// **'Farg\'ona viloyati'**
  String get registrationRegionFargona;

  /// No description provided for @registrationRegionNamangan.
  ///
  /// In uz, this message translates to:
  /// **'Namangan viloyati'**
  String get registrationRegionNamangan;

  /// No description provided for @registrationRegionSamarqand.
  ///
  /// In uz, this message translates to:
  /// **'Samarqand viloyati'**
  String get registrationRegionSamarqand;

  /// No description provided for @registrationRegionBuxoro.
  ///
  /// In uz, this message translates to:
  /// **'Buxoro viloyati'**
  String get registrationRegionBuxoro;

  /// No description provided for @registrationRegionXorazm.
  ///
  /// In uz, this message translates to:
  /// **'Xorazm viloyati'**
  String get registrationRegionXorazm;

  /// No description provided for @registrationRegionNavoiy.
  ///
  /// In uz, this message translates to:
  /// **'Navoiy viloyati'**
  String get registrationRegionNavoiy;

  /// No description provided for @registrationRegionQashqadaryo.
  ///
  /// In uz, this message translates to:
  /// **'Qashqadaryo viloyati'**
  String get registrationRegionQashqadaryo;

  /// No description provided for @registrationRegionSurxondaryo.
  ///
  /// In uz, this message translates to:
  /// **'Surxondaryo viloyati'**
  String get registrationRegionSurxondaryo;

  /// No description provided for @registrationRegionJizzax.
  ///
  /// In uz, this message translates to:
  /// **'Jizzax viloyati'**
  String get registrationRegionJizzax;

  /// No description provided for @registrationRegionSirdaryo.
  ///
  /// In uz, this message translates to:
  /// **'Sirdaryo viloyati'**
  String get registrationRegionSirdaryo;

  /// No description provided for @registrationRegionQoraqalpogiston.
  ///
  /// In uz, this message translates to:
  /// **'Qoraqalpog\'iston Respublikasi'**
  String get registrationRegionQoraqalpogiston;

  /// No description provided for @registrationDistrictChilonzor.
  ///
  /// In uz, this message translates to:
  /// **'Chilonzor tumani'**
  String get registrationDistrictChilonzor;

  /// No description provided for @registrationDistrictYunusobod.
  ///
  /// In uz, this message translates to:
  /// **'Yunusobod tumani'**
  String get registrationDistrictYunusobod;

  /// No description provided for @registrationDistrictZangiota.
  ///
  /// In uz, this message translates to:
  /// **'Zangiota tumani'**
  String get registrationDistrictZangiota;

  /// No description provided for @registrationDistrictQibray.
  ///
  /// In uz, this message translates to:
  /// **'Qibray tumani'**
  String get registrationDistrictQibray;

  /// No description provided for @registrationDistrictAndijonShahri.
  ///
  /// In uz, this message translates to:
  /// **'Andijon shahri'**
  String get registrationDistrictAndijonShahri;

  /// No description provided for @registrationDistrictAsaka.
  ///
  /// In uz, this message translates to:
  /// **'Asaka tumani'**
  String get registrationDistrictAsaka;

  /// No description provided for @registrationDistrictFargonaShahri.
  ///
  /// In uz, this message translates to:
  /// **'Farg\'ona shahri'**
  String get registrationDistrictFargonaShahri;

  /// No description provided for @registrationDistrictQoqon.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'qon shahri'**
  String get registrationDistrictQoqon;

  /// No description provided for @registrationDistrictNamanganShahri.
  ///
  /// In uz, this message translates to:
  /// **'Namangan shahri'**
  String get registrationDistrictNamanganShahri;

  /// No description provided for @registrationDistrictChust.
  ///
  /// In uz, this message translates to:
  /// **'Chust tumani'**
  String get registrationDistrictChust;

  /// No description provided for @registrationDistrictSamarqandShahri.
  ///
  /// In uz, this message translates to:
  /// **'Samarqand shahri'**
  String get registrationDistrictSamarqandShahri;

  /// No description provided for @registrationDistrictUrgut.
  ///
  /// In uz, this message translates to:
  /// **'Urgut tumani'**
  String get registrationDistrictUrgut;

  /// No description provided for @registrationDistrictBuxoroShahri.
  ///
  /// In uz, this message translates to:
  /// **'Buxoro shahri'**
  String get registrationDistrictBuxoroShahri;

  /// No description provided for @registrationDistrictGijduvon.
  ///
  /// In uz, this message translates to:
  /// **'G\'ijduvon tumani'**
  String get registrationDistrictGijduvon;

  /// No description provided for @registrationDistrictUrganch.
  ///
  /// In uz, this message translates to:
  /// **'Urganch shahri'**
  String get registrationDistrictUrganch;

  /// No description provided for @registrationDistrictXiva.
  ///
  /// In uz, this message translates to:
  /// **'Xiva tumani'**
  String get registrationDistrictXiva;

  /// No description provided for @registrationDistrictNavoiyShahri.
  ///
  /// In uz, this message translates to:
  /// **'Navoiy shahri'**
  String get registrationDistrictNavoiyShahri;

  /// No description provided for @registrationDistrictZarafshon.
  ///
  /// In uz, this message translates to:
  /// **'Zarafshon shahri'**
  String get registrationDistrictZarafshon;

  /// No description provided for @registrationDistrictQarshi.
  ///
  /// In uz, this message translates to:
  /// **'Qarshi shahri'**
  String get registrationDistrictQarshi;

  /// No description provided for @registrationDistrictShahrisabz.
  ///
  /// In uz, this message translates to:
  /// **'Shahrisabz tumani'**
  String get registrationDistrictShahrisabz;

  /// No description provided for @registrationDistrictTermiz.
  ///
  /// In uz, this message translates to:
  /// **'Termiz shahri'**
  String get registrationDistrictTermiz;

  /// No description provided for @registrationDistrictDenov.
  ///
  /// In uz, this message translates to:
  /// **'Denov tumani'**
  String get registrationDistrictDenov;

  /// No description provided for @registrationDistrictJizzaxShahri.
  ///
  /// In uz, this message translates to:
  /// **'Jizzax shahri'**
  String get registrationDistrictJizzaxShahri;

  /// No description provided for @registrationDistrictZomin.
  ///
  /// In uz, this message translates to:
  /// **'Zomin tumani'**
  String get registrationDistrictZomin;

  /// No description provided for @registrationDistrictGuliston.
  ///
  /// In uz, this message translates to:
  /// **'Guliston shahri'**
  String get registrationDistrictGuliston;

  /// No description provided for @registrationDistrictShirin.
  ///
  /// In uz, this message translates to:
  /// **'Shirin tumani'**
  String get registrationDistrictShirin;

  /// No description provided for @registrationDistrictNukus.
  ///
  /// In uz, this message translates to:
  /// **'Nukus shahri'**
  String get registrationDistrictNukus;

  /// No description provided for @registrationDistrictXojayli.
  ///
  /// In uz, this message translates to:
  /// **'Xo\'jayli tumani'**
  String get registrationDistrictXojayli;

  /// Profil sarlavhasida yuz shu sanada ro'yxatdan o'tilgani
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tilgan: {date}'**
  String profileEnrolledOn(String date);

  /// No description provided for @meetingsPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Majlislar'**
  String get meetingsPageTitle;

  /// No description provided for @meetingsFilterAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get meetingsFilterAll;

  /// No description provided for @meetingStatusLive.
  ///
  /// In uz, this message translates to:
  /// **'Jonli'**
  String get meetingStatusLive;

  /// No description provided for @meetingStatusScheduled.
  ///
  /// In uz, this message translates to:
  /// **'Rejalashtirilgan'**
  String get meetingStatusScheduled;

  /// No description provided for @meetingStatusEnded.
  ///
  /// In uz, this message translates to:
  /// **'Tugagan'**
  String get meetingStatusEnded;

  /// No description provided for @meetingsEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Majlislar topilmadi'**
  String get meetingsEmptyTitle;

  /// No description provided for @meetingsEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha ko\'rsatish uchun majlislar yo\'q'**
  String get meetingsEmptyMessage;

  /// No description provided for @meetingsErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Majlislarni yuklab bo\'lmadi'**
  String get meetingsErrorTitle;

  /// No description provided for @meetingJoinShortCta.
  ///
  /// In uz, this message translates to:
  /// **'Ulanish'**
  String get meetingJoinShortCta;

  /// No description provided for @meetingDetailTitle.
  ///
  /// In uz, this message translates to:
  /// **'Majlis tafsilotlari'**
  String get meetingDetailTitle;

  /// No description provided for @meetingHostLabel.
  ///
  /// In uz, this message translates to:
  /// **'Tashkilotchi'**
  String get meetingHostLabel;

  /// Majlis davomiyligi daqiqalarda
  ///
  /// In uz, this message translates to:
  /// **'{minutes} daqiqa'**
  String meetingDurationLabel(int minutes);

  /// No description provided for @meetingDescriptionTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kun tartibi'**
  String get meetingDescriptionTitle;

  /// No description provided for @meetingNoDescription.
  ///
  /// In uz, this message translates to:
  /// **'Kun tartibi kiritilmagan'**
  String get meetingNoDescription;

  /// Majlisdagi ishtirokchilar soni (tafsilotlar sahifasi bo'lim sarlavhasi)
  ///
  /// In uz, this message translates to:
  /// **'{count} ishtirokchi'**
  String meetingParticipantsCount(int count);

  /// No description provided for @meetingJoinCta.
  ///
  /// In uz, this message translates to:
  /// **'Majlisga ulanish'**
  String get meetingJoinCta;

  /// No description provided for @meetingJoiningStatus.
  ///
  /// In uz, this message translates to:
  /// **'Ulanmoqda…'**
  String get meetingJoiningStatus;

  /// No description provided for @meetingEndedNotice.
  ///
  /// In uz, this message translates to:
  /// **'Bu majlis allaqachon yakunlangan'**
  String get meetingEndedNotice;

  /// No description provided for @meetingJoinedTitle.
  ///
  /// In uz, this message translates to:
  /// **'Siz ulandingiz!'**
  String get meetingJoinedTitle;

  /// No description provided for @meetingJoinedMessage.
  ///
  /// In uz, this message translates to:
  /// **'Quyidagi havola orqali majlisga qo\'shiling'**
  String get meetingJoinedMessage;

  /// No description provided for @meetingJoinUrlCopied.
  ///
  /// In uz, this message translates to:
  /// **'Havola nusxalandi'**
  String get meetingJoinUrlCopied;

  /// No description provided for @meetingCopyLink.
  ///
  /// In uz, this message translates to:
  /// **'Havolani nusxalash'**
  String get meetingCopyLink;

  /// No description provided for @meetingNotFoundTitle.
  ///
  /// In uz, this message translates to:
  /// **'Majlis topilmadi'**
  String get meetingNotFoundTitle;

  /// No description provided for @callBrandLabel.
  ///
  /// In uz, this message translates to:
  /// **'Video konferensiya'**
  String get callBrandLabel;

  /// No description provided for @callSecureConnection.
  ///
  /// In uz, this message translates to:
  /// **'Xavfsiz ulanish'**
  String get callSecureConnection;

  /// No description provided for @callInitializingMedia.
  ///
  /// In uz, this message translates to:
  /// **'Kamera va mikrofon yoqilmoqda…'**
  String get callInitializingMedia;

  /// No description provided for @callLobbyJoinNow.
  ///
  /// In uz, this message translates to:
  /// **'Hozir qo\'shilish'**
  String get callLobbyJoinNow;

  /// No description provided for @callJoinWithoutCamera.
  ///
  /// In uz, this message translates to:
  /// **'Kamerasiz qo\'shilish'**
  String get callJoinWithoutCamera;

  /// Majlisga ulanish lobisida kutilayotgan ishtirokchilar soni
  ///
  /// In uz, this message translates to:
  /// **'{count} ta ishtirokchi kutilmoqda'**
  String callParticipantsWaiting(int count);

  /// No description provided for @callYouAreFirst.
  ///
  /// In uz, this message translates to:
  /// **'Siz birinchi qo\'shilyapsiz'**
  String get callYouAreFirst;

  /// No description provided for @callYou.
  ///
  /// In uz, this message translates to:
  /// **'Siz'**
  String get callYou;

  /// No description provided for @callYouSuffix.
  ///
  /// In uz, this message translates to:
  /// **'(siz)'**
  String get callYouSuffix;

  /// No description provided for @callCameraOff.
  ///
  /// In uz, this message translates to:
  /// **'Kamera o\'chiq'**
  String get callCameraOff;

  /// No description provided for @callMic.
  ///
  /// In uz, this message translates to:
  /// **'Mikrofon'**
  String get callMic;

  /// No description provided for @callCamera.
  ///
  /// In uz, this message translates to:
  /// **'Kamera'**
  String get callCamera;

  /// No description provided for @callScreen.
  ///
  /// In uz, this message translates to:
  /// **'Ekran'**
  String get callScreen;

  /// No description provided for @callReaction.
  ///
  /// In uz, this message translates to:
  /// **'Reaksiya'**
  String get callReaction;

  /// No description provided for @callEnd.
  ///
  /// In uz, this message translates to:
  /// **'Tugatish'**
  String get callEnd;

  /// No description provided for @callEndConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'ng\'iroqni tugatasizmi?'**
  String get callEndConfirmTitle;

  /// No description provided for @callEndConfirmMessage.
  ///
  /// In uz, this message translates to:
  /// **'Video-konferensiyadan chiqasiz — hamma ishtirokchilar uchun sizning ulanishingiz uziladi.'**
  String get callEndConfirmMessage;

  /// No description provided for @callLive.
  ///
  /// In uz, this message translates to:
  /// **'LIVE'**
  String get callLive;

  /// Video-qo'ng'iroqdagi ishtirokchilar paneli sarlavhasi
  ///
  /// In uz, this message translates to:
  /// **'Ishtirokchilar ({count})'**
  String callParticipantsTitle(int count);

  /// Ishtirokchi video-qo'ng'iroqqa qo'shilganda ko'rsatiladigan qisqa bildirishnoma
  ///
  /// In uz, this message translates to:
  /// **'{name} qo\'shildi'**
  String callParticipantJoined(String name);

  /// No description provided for @callDeviceOnlyNote.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shilish orqali kamera/mikrofon faqat shu qurilmangizda ishlatiladi.'**
  String get callDeviceOnlyNote;

  /// No description provided for @callSharingBanner.
  ///
  /// In uz, this message translates to:
  /// **'Siz ekraningizni ulashyapsiz'**
  String get callSharingBanner;

  /// No description provided for @homeQuickActionsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tezkor'**
  String get homeQuickActionsTitle;

  /// No description provided for @pointsPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ballarim'**
  String get pointsPageTitle;

  /// No description provided for @pointsTotalLabel.
  ///
  /// In uz, this message translates to:
  /// **'Umumiy ball'**
  String get pointsTotalLabel;

  /// Xodimning reyting o'rni (ball hero kartasida)
  ///
  /// In uz, this message translates to:
  /// **'{rank}-o\'rin'**
  String pointsRankLabel(int rank);

  /// No description provided for @pointsSummaryPositiveLabel.
  ///
  /// In uz, this message translates to:
  /// **'Qo\'shilgan'**
  String get pointsSummaryPositiveLabel;

  /// No description provided for @pointsSummaryNegativeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Ayirilgan'**
  String get pointsSummaryNegativeLabel;

  /// No description provided for @pointsHistoryTitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'zgarishlar tarixi'**
  String get pointsHistoryTitle;

  /// No description provided for @pointsEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ball tarixi topilmadi'**
  String get pointsEmptyTitle;

  /// No description provided for @pointsEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hali ball o\'zgarishlari mavjud emas'**
  String get pointsEmptyMessage;

  /// No description provided for @pointsErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ballarni yuklab bo\'lmadi'**
  String get pointsErrorTitle;

  /// No description provided for @suggestionsPageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Takliflar'**
  String get suggestionsPageTitle;

  /// No description provided for @suggestionsFilterTitle.
  ///
  /// In uz, this message translates to:
  /// **'Filtr'**
  String get suggestionsFilterTitle;

  /// No description provided for @suggestionsFilterStatusLabel.
  ///
  /// In uz, this message translates to:
  /// **'Holat'**
  String get suggestionsFilterStatusLabel;

  /// No description provided for @suggestionsFilterAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get suggestionsFilterAll;

  /// No description provided for @suggestionsSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'Takliflarni qidirish'**
  String get suggestionsSearchHint;

  /// No description provided for @suggestionsEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Takliflar topilmadi'**
  String get suggestionsEmptyTitle;

  /// No description provided for @suggestionsEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha ko\'rsatish uchun takliflar yo\'q'**
  String get suggestionsEmptyMessage;

  /// No description provided for @suggestionsEmptyFilteredMessage.
  ///
  /// In uz, this message translates to:
  /// **'Tanlangan filtrlar bo\'yicha takliflar topilmadi'**
  String get suggestionsEmptyFilteredMessage;

  /// No description provided for @suggestionsErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Takliflarni yuklab bo\'lmadi'**
  String get suggestionsErrorTitle;

  /// No description provided for @suggestionStatusYangi.
  ///
  /// In uz, this message translates to:
  /// **'Yangi'**
  String get suggestionStatusYangi;

  /// No description provided for @suggestionStatusKorilmoqda.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'rilmoqda'**
  String get suggestionStatusKorilmoqda;

  /// No description provided for @suggestionStatusQabulQilindi.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qilindi'**
  String get suggestionStatusQabulQilindi;

  /// No description provided for @suggestionStatusRad.
  ///
  /// In uz, this message translates to:
  /// **'Rad etildi'**
  String get suggestionStatusRad;

  /// No description provided for @suggestionCategoryDigital.
  ///
  /// In uz, this message translates to:
  /// **'Raqamlashtirish'**
  String get suggestionCategoryDigital;

  /// No description provided for @suggestionCategoryProcess.
  ///
  /// In uz, this message translates to:
  /// **'Ish jarayoni'**
  String get suggestionCategoryProcess;

  /// No description provided for @suggestionCategorySocial.
  ///
  /// In uz, this message translates to:
  /// **'Ijtimoiy'**
  String get suggestionCategorySocial;

  /// No description provided for @suggestionCategoryInfra.
  ///
  /// In uz, this message translates to:
  /// **'Infratuzilma'**
  String get suggestionCategoryInfra;

  /// No description provided for @suggestionCategoryOther.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa'**
  String get suggestionCategoryOther;

  /// No description provided for @submitSuggestionTitle.
  ///
  /// In uz, this message translates to:
  /// **'Taklif yuborish'**
  String get submitSuggestionTitle;

  /// No description provided for @submitSuggestionTitleLabel.
  ///
  /// In uz, this message translates to:
  /// **'Sarlavha'**
  String get submitSuggestionTitleLabel;

  /// No description provided for @submitSuggestionTitleHint.
  ///
  /// In uz, this message translates to:
  /// **'Taklif sarlavhasini kiriting'**
  String get submitSuggestionTitleHint;

  /// No description provided for @submitSuggestionCategoryLabel.
  ///
  /// In uz, this message translates to:
  /// **'Kategoriya'**
  String get submitSuggestionCategoryLabel;

  /// No description provided for @submitSuggestionCategoryHint.
  ///
  /// In uz, this message translates to:
  /// **'Kategoriyani tanlang'**
  String get submitSuggestionCategoryHint;

  /// No description provided for @submitSuggestionBodyLabel.
  ///
  /// In uz, this message translates to:
  /// **'Taklif matni'**
  String get submitSuggestionBodyLabel;

  /// No description provided for @submitSuggestionBodyHint.
  ///
  /// In uz, this message translates to:
  /// **'G\'oyangizni batafsil yozing'**
  String get submitSuggestionBodyHint;

  /// No description provided for @submitSuggestionSubmit.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get submitSuggestionSubmit;

  /// No description provided for @submitSuggestionSuccessTitle.
  ///
  /// In uz, this message translates to:
  /// **'Taklif yuborildi'**
  String get submitSuggestionSuccessTitle;

  /// No description provided for @submitSuggestionSuccessMessage.
  ///
  /// In uz, this message translates to:
  /// **'Taklifingiz muvaffaqiyatli yuborildi'**
  String get submitSuggestionSuccessMessage;

  /// No description provided for @homeTodayOverviewTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bugungi ko\'rinish'**
  String get homeTodayOverviewTitle;

  /// No description provided for @homeStripNewRequests.
  ///
  /// In uz, this message translates to:
  /// **'Yangi murojaat'**
  String get homeStripNewRequests;

  /// No description provided for @homeStripUnreadChat.
  ///
  /// In uz, this message translates to:
  /// **'O\'qilmagan xabar'**
  String get homeStripUnreadChat;

  /// No description provided for @homeStripMeetingsToday.
  ///
  /// In uz, this message translates to:
  /// **'Bugungi majlis'**
  String get homeStripMeetingsToday;

  /// No description provided for @homeSectionsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bo\'limlar'**
  String get homeSectionsTitle;

  /// Bosh sahifadagi 'Murojaatlar' bo'lim-kartasi ostidagi belgi — bugun biriktirilgan yangi murojaatlar soni
  ///
  /// In uz, this message translates to:
  /// **'{count} yangi'**
  String homeNewRequestsBadge(int count);

  /// Bosh sahifadagi 'Chat' bo'lim-kartasi ostidagi belgi — o'qilmagan xabarlar soni
  ///
  /// In uz, this message translates to:
  /// **'{count} o\'qilmagan'**
  String homeUnreadChatBadge(int count);

  /// Bosh sahifadagi 'Majlislar' bo'lim-kartasi ostidagi belgi — bugungi majlislar soni
  ///
  /// In uz, this message translates to:
  /// **'{count} bugun'**
  String homeMeetingsTodayBadge(int count);

  /// No description provided for @homeAnalyticsTile.
  ///
  /// In uz, this message translates to:
  /// **'Tahlil'**
  String get homeAnalyticsTile;

  /// No description provided for @homeRecentActivityTitle.
  ///
  /// In uz, this message translates to:
  /// **'So\'nggi faoliyat'**
  String get homeRecentActivityTitle;

  /// No description provided for @homeActivityNewRequest.
  ///
  /// In uz, this message translates to:
  /// **'Yangi murojaat biriktirildi'**
  String get homeActivityNewRequest;

  /// No description provided for @homeActivityMeetingStarting.
  ///
  /// In uz, this message translates to:
  /// **'Majlis boshlanadi'**
  String get homeActivityMeetingStarting;

  /// No description provided for @homeActivityNewMessage.
  ///
  /// In uz, this message translates to:
  /// **'Chatda yangi xabar bor'**
  String get homeActivityNewMessage;

  /// No description provided for @homeGeofenceInside.
  ///
  /// In uz, this message translates to:
  /// **'Ichkarida'**
  String get homeGeofenceInside;

  /// No description provided for @homeGeofenceOutside.
  ///
  /// In uz, this message translates to:
  /// **'Tashqarida'**
  String get homeGeofenceOutside;

  /// No description provided for @workScheduleTileLabel.
  ///
  /// In uz, this message translates to:
  /// **'Ish jadvali'**
  String get workScheduleTileLabel;

  /// No description provided for @workSchedulePageTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ish jadvali'**
  String get workSchedulePageTitle;

  /// No description provided for @workScheduleSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Haftalik ish vaqti — 6 kunlik ish haftasi'**
  String get workScheduleSubtitle;

  /// No description provided for @workScheduleTodayBadge.
  ///
  /// In uz, this message translates to:
  /// **'Bugun'**
  String get workScheduleTodayBadge;

  /// No description provided for @workScheduleRestDay.
  ///
  /// In uz, this message translates to:
  /// **'Dam olish'**
  String get workScheduleRestDay;

  /// No description provided for @workScheduleHours.
  ///
  /// In uz, this message translates to:
  /// **'09:00–18:00'**
  String get workScheduleHours;

  /// No description provided for @weekdayMonday.
  ///
  /// In uz, this message translates to:
  /// **'Dushanba'**
  String get weekdayMonday;

  /// No description provided for @weekdayTuesday.
  ///
  /// In uz, this message translates to:
  /// **'Seshanba'**
  String get weekdayTuesday;

  /// No description provided for @weekdayWednesday.
  ///
  /// In uz, this message translates to:
  /// **'Chorshanba'**
  String get weekdayWednesday;

  /// No description provided for @weekdayThursday.
  ///
  /// In uz, this message translates to:
  /// **'Payshanba'**
  String get weekdayThursday;

  /// No description provided for @weekdayFriday.
  ///
  /// In uz, this message translates to:
  /// **'Juma'**
  String get weekdayFriday;

  /// No description provided for @weekdaySaturday.
  ///
  /// In uz, this message translates to:
  /// **'Shanba'**
  String get weekdaySaturday;

  /// No description provided for @weekdaySunday.
  ///
  /// In uz, this message translates to:
  /// **'Yakshanba'**
  String get weekdaySunday;

  /// No description provided for @mapWorkZoneLegend.
  ///
  /// In uz, this message translates to:
  /// **'Ish hududi'**
  String get mapWorkZoneLegend;

  /// No description provided for @mapWorkHourInsideMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozir ish vaqti — ish hududidasiz'**
  String get mapWorkHourInsideMessage;

  /// No description provided for @mapWorkHourOutsideMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozir ish vaqti — ish hududiga qayting'**
  String get mapWorkHourOutsideMessage;

  /// No description provided for @mapOffWorkHoursMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozir ish vaqti emas'**
  String get mapOffWorkHoursMessage;

  /// No description provided for @mapWorkZoneRuleTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ish hududi qoidasi'**
  String get mapWorkZoneRuleTitle;

  /// No description provided for @mapWorkZoneRuleText.
  ///
  /// In uz, this message translates to:
  /// **'Ish vaqtida ish hududida bo\'ling. Ish hududidan 30 daqiqadan ortiq uzoqlashsangiz, ballaringiz kamayadi.'**
  String get mapWorkZoneRuleText;

  /// No description provided for @notificationsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get notificationsTitle;

  /// No description provided for @notificationsMarkAllRead.
  ///
  /// In uz, this message translates to:
  /// **'Hammasini o\'qilgan deb belgilash'**
  String get notificationsMarkAllRead;

  /// No description provided for @notificationsEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar yo\'q'**
  String get notificationsEmptyTitle;

  /// No description provided for @notificationsEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha sizga hech qanday bildirishnoma kelmagan'**
  String get notificationsEmptyMessage;

  /// No description provided for @notificationsErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Yuklashda xatolik'**
  String get notificationsErrorTitle;

  /// No description provided for @notificationsJustNow.
  ///
  /// In uz, this message translates to:
  /// **'Hozir'**
  String get notificationsJustNow;

  /// No description provided for @notificationsMinutesAgoSuffix.
  ///
  /// In uz, this message translates to:
  /// **'daqiqa oldin'**
  String get notificationsMinutesAgoSuffix;

  /// No description provided for @notificationsHoursAgoSuffix.
  ///
  /// In uz, this message translates to:
  /// **'soat oldin'**
  String get notificationsHoursAgoSuffix;

  /// No description provided for @notificationsDaysAgoSuffix.
  ///
  /// In uz, this message translates to:
  /// **'kun oldin'**
  String get notificationsDaysAgoSuffix;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ru', 'uz'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ru':
      return AppLocalizationsRu();
    case 'uz':
      return AppLocalizationsUz();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
