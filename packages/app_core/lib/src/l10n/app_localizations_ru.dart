// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get appName => 'Хокимият';

  @override
  String get splashTagline => 'Цифровая платформа управления';

  @override
  String get login => 'Вход';

  @override
  String get phoneNumber => 'Ваш номер телефона';

  @override
  String get sendCode => 'Отправить код';

  @override
  String get enterCode => 'Введите код';

  @override
  String get faceEnrollTitle => 'Зарегистрируйте своё лицо';

  @override
  String get faceCheckinTitle => 'Подтверждение по лицу';

  @override
  String get faceHoldStill => 'Расположите лицо в овале';

  @override
  String get blinkPrompt => 'Моргните глазами';

  @override
  String get turnLeftPrompt => 'Поверните голову влево';

  @override
  String get turnRightPrompt => 'Поверните голову вправо';

  @override
  String get smilePrompt => 'Улыбнитесь';

  @override
  String get faceInitializing => 'Камера готовится…';

  @override
  String get facePermissionTitle => 'Требуется доступ к камере';

  @override
  String get faceCameraPermissionMessage =>
      'Разрешите доступ к камере, чтобы зарегистрировать лицо';

  @override
  String get faceGrantPermission => 'Разрешить';

  @override
  String get faceOpenSettings => 'Открыть настройки';

  @override
  String get faceCameraErrorTitle => 'Ошибка камеры';

  @override
  String get faceCameraErrorMessage => 'Не удалось запустить камеру';

  @override
  String get faceModelErrorTitle => 'Ошибка модели';

  @override
  String get faceModelErrorMessage =>
      'Не удалось загрузить модель распознавания лица';

  @override
  String get retry => 'Повторить попытку';

  @override
  String get faceTooFar => 'Подойдите ближе';

  @override
  String get faceTooClose => 'Отойдите немного дальше';

  @override
  String get faceMoveLeft => 'Сдвиньтесь левее';

  @override
  String get faceMoveRight => 'Сдвиньтесь правее';

  @override
  String get faceMoveUp => 'Сдвиньтесь выше';

  @override
  String get faceMoveDown => 'Сдвиньтесь ниже';

  @override
  String get faceTurned => 'Держите голову прямо';

  @override
  String get faceEyesClosed => 'Откройте глаза';

  @override
  String get faceLowLight => 'Перейдите в более светлое место';

  @override
  String get faceKeepStill => 'Отлично! Не двигайтесь';

  @override
  String get faceCapturingStatus => 'Идёт съёмка…';

  @override
  String get faceEmbeddingStatus => 'Обработка…';

  @override
  String get faceEnrollingStatus => 'Сохранение…';

  @override
  String get faceEnrollSuccess => 'Вы успешно зарегистрированы!';

  @override
  String get faceErrorTitle => 'Ошибка';

  @override
  String get faceCheckinCameraPermissionMessage =>
      'Разрешите доступ к камере, чтобы отметить посещаемость';

  @override
  String get faceVerifyingStatus => 'Проверка…';

  @override
  String get faceCheckingInStatus => 'Запись посещаемости…';

  @override
  String get faceCheckinTimeLabel => 'Отмеченное время';

  @override
  String get faceCheckinDone => 'Отлично! Ваша посещаемость сегодня отмечена.';

  @override
  String get faceContinue => 'Продолжить';

  @override
  String get faceCheckoutTitle => 'Уход с работы';

  @override
  String get faceCheckoutDone => 'Отлично! Ваш рабочий день сегодня завершён.';

  @override
  String get faceMatchFailedTitle => 'Лицо не распознано';

  @override
  String get faceMatchFailedMessage =>
      'Ваше лицо не совпало с сохранённым образцом. Попробуйте снова или обратитесь к администратору.';

  @override
  String get faceLivenessFailedTitle => 'Живость не подтверждена';

  @override
  String get faceLivenessFailedMessage =>
      'Вы не успели выполнить действие. Попробуйте снова.';

  @override
  String get faceGeofenceOutsideMessage =>
      'Чтобы отметить посещаемость, подойдите ближе к рабочей зоне.';

  @override
  String get faceLiveBannerUnknown => 'Определение местоположения…';

  @override
  String get insideGeofence => 'Вы на рабочей территории';

  @override
  String get faceGeofenceDistanceLabel => 'До места работы';

  @override
  String get meterSuffix => 'm';

  @override
  String get outsideGeofence => 'Вы находитесь за пределами рабочей зоны';

  @override
  String get checkinSuccess => 'Посещаемость подтверждена';

  @override
  String get checkoutSuccess => 'Уход подтверждён';

  @override
  String get home => 'Главная';

  @override
  String get requests => 'Обращения';

  @override
  String get chat => 'Чат';

  @override
  String get map => 'Карта';

  @override
  String get profile => 'Профиль';

  @override
  String get citizenTagline => 'Цифровые услуги для граждан';

  @override
  String get welcomeGreeting => 'Добро пожаловать,';

  @override
  String get otpChannelInfo => 'Отправим SMS-код для подтверждения';

  @override
  String get helpLine => 'Помощь: 1090';

  @override
  String otpSentTo(String phone) {
    return 'Код отправлен на номер $phone';
  }

  @override
  String get resendCode => 'Отправить код повторно';

  @override
  String get confirm => 'Подтвердить';

  @override
  String get errorGeneric => 'Ошибка';

  @override
  String get logout => 'Выход';

  @override
  String get logoutConfirmTitle => 'Подтвердите выход';

  @override
  String get logoutConfirmMessage =>
      'Вы выйдете из аккаунта — потребуется повторный вход.';

  @override
  String get logoutConfirmCta => 'Да, выйти';

  @override
  String get cancel => 'Отмена';

  @override
  String get homeGreeting => 'Добро пожаловать';

  @override
  String get todayStatusTitle => 'Статус на сегодня';

  @override
  String get attendanceStatusPresent => 'Пришёл';

  @override
  String get attendanceStatusLate => 'Опоздал';

  @override
  String get attendanceStatusAbsent => 'Не пришёл';

  @override
  String get attendanceStatusLeave => 'В отпуске';

  @override
  String get notCheckedInYet => 'Ещё не отмечено';

  @override
  String get checkInTimeLabel => 'Время прихода';

  @override
  String get homeCheckinCta => 'Подтвердить по лицу';

  @override
  String get locationCheckFailed => 'Не удалось определить местоположение';

  @override
  String get weeklyChartTitle => 'Последние 7 дней';

  @override
  String get statHoursThisWeek => 'Часов за неделю';

  @override
  String get statDaysPresent => 'Дней присутствия';

  @override
  String get statLateDays => 'Дней с опозданием';

  @override
  String get attendanceEmptyTitle => 'История посещаемости не найдена';

  @override
  String get attendanceEmptyMessage => 'Записей о посещаемости пока нет';

  @override
  String get attendanceErrorTitle => 'Не удалось загрузить посещаемость';

  @override
  String get comingSoonTitle => 'Скоро';

  @override
  String get comingSoonMessage => 'Этот раздел ещё разрабатывается';

  @override
  String get routeNotFoundTitle => 'Страница не найдена';

  @override
  String get routeNotFoundMessage => 'Такого адреса не существует';

  @override
  String get quickActionsTitle => 'Быстрые услуги';

  @override
  String get quickActionKommunalka => 'Коммунальные услуги';

  @override
  String get quickActionNewApplication => 'Заявление';

  @override
  String get quickActionComplaint => 'Жалоба';

  @override
  String get quickActionPaymentHistory => 'История платежей';

  @override
  String get totalDueTitle => 'Общая задолженность';

  @override
  String get totalDueCaption => 'По всем коммунальным услугам';

  @override
  String get homeDueEmptyTitle => 'Долгов нет';

  @override
  String get homeDueEmptyMessage => 'Все коммунальные платежи оплачены';

  @override
  String get dataLoadErrorTitle => 'Не удалось загрузить данные';

  @override
  String get utilitiesPageTitle => 'Коммунальные услуги';

  @override
  String get utilitiesEmptyTitle => 'Услуги не найдены';

  @override
  String get utilitiesEmptyMessage =>
      'У вас нет привязанных коммунальных услуг';

  @override
  String get utilityTypeElektr => 'Электроэнергия';

  @override
  String get utilityTypeGaz => 'Природный газ';

  @override
  String get utilityTypeSuv => 'Водоснабжение';

  @override
  String get utilityTypeIssiqlik => 'Теплоснабжение';

  @override
  String get utilityTypeChiqindi => 'Вывоз мусора';

  @override
  String get accountNumberLabel => 'Номер счёта';

  @override
  String get noDebtLabel => 'Нет долга';

  @override
  String get payButtonLabel => 'Оплатить';

  @override
  String get payPageTitle => 'Оплата';

  @override
  String get amountLabel => 'Сумма платежа';

  @override
  String get amountHint => 'Введите сумму';

  @override
  String get amountSuffix => 'сум';

  @override
  String get cardNumberLabel => 'Номер карты';

  @override
  String get cardNumberHint => '0000 0000 0000 0000';

  @override
  String get cardMockNotice =>
      'Это мок-карта, реальные средства не списываются';

  @override
  String get payConfirmButton => 'Подтвердить платёж';

  @override
  String get paySuccessTitle => 'Платёж выполнен успешно!';

  @override
  String get paySuccessMessage => 'Ваш платёж успешно принят';

  @override
  String get closeLabel => 'Закрыть';

  @override
  String get paymentHistoryPageTitle => 'История платежей';

  @override
  String get paymentHistoryEmptyTitle => 'Платежи не найдены';

  @override
  String get paymentHistoryEmptyMessage => 'Платежи пока не выполнялись';

  @override
  String get paymentStatusSuccess => 'Успешно';

  @override
  String get paymentStatusFailed => 'Неуспешно';

  @override
  String get paymentStatusPending => 'В ожидании';

  @override
  String paidWithCard(String last4) {
    return 'Карта •••• $last4';
  }

  @override
  String get cardExpiryLabel => 'Срок действия';

  @override
  String get cardExpiryHint => 'ММ/ГГ';

  @override
  String get savedCardsSectionLabel => 'Выберите карту';

  @override
  String get addNewCardOption => 'Новая карта';

  @override
  String get cardBalanceLabel => 'Баланс';

  @override
  String get insufficientFundsMessage => 'На карте недостаточно средств';

  @override
  String get smsConfirmTitle => 'Подтвердите код';

  @override
  String get smsConfirmMessage =>
      'Код подтверждения отправлен на номер, привязанный к карте';

  @override
  String smsDemoCodeHint(String code) {
    return 'Для примера (мок): $code';
  }

  @override
  String get receiptPageTitle => 'Чек';

  @override
  String get receiptDateLabel => 'Дата';

  @override
  String get receiptTransactionIdLabel => 'Номер транзакции';

  @override
  String get receiptShareButton => 'Поделиться';

  @override
  String get receiptShareError => 'Не удалось поделиться чеком';

  @override
  String get filterTypeAll => 'Все';

  @override
  String get filterTypeElektr => 'Электро';

  @override
  String get filterTypeGaz => 'Газ';

  @override
  String get filterTypeSuv => 'Вода';

  @override
  String get filterTypeIssiqlik => 'Тепло';

  @override
  String get filterTypeChiqindi => 'Мусор';

  @override
  String get paymentsTab => 'Платежи';

  @override
  String get applicationsTab => 'Обращения';

  @override
  String get requestsTabAssigned => 'Мне назначено';

  @override
  String get requestsTabRelevant => 'Относящиеся';

  @override
  String get requestsSearchHint => 'Поиск обращений';

  @override
  String get requestsFilterTitle => 'Фильтр';

  @override
  String get requestsFilterStatusLabel => 'Статус';

  @override
  String get requestsFilterPriorityLabel => 'Приоритет';

  @override
  String get requestsFilterAll => 'Все';

  @override
  String get requestsEmptyTitle => 'Обращения не найдены';

  @override
  String get requestsEmptyMessage => 'Пока нет обращений для отображения';

  @override
  String get requestsEmptyFilteredMessage =>
      'По выбранным фильтрам обращений не найдено';

  @override
  String get requestsErrorTitle => 'Не удалось загрузить обращения';

  @override
  String get statusYangi => 'Новое';

  @override
  String get statusJarayonda => 'В процессе';

  @override
  String get statusJavobBerildi => 'Отвечено';

  @override
  String get statusYopildi => 'Закрыто';

  @override
  String get statusRad => 'Отклонено';

  @override
  String get priorityPast => 'Низкий';

  @override
  String get priorityOrta => 'Средний';

  @override
  String get priorityYuqori => 'Высокий';

  @override
  String get pointsSuffix => 'баллов';

  @override
  String get requestDetailTitle => 'Детали обращения';

  @override
  String get requestDescriptionTitle => 'Описание';

  @override
  String get requestCitizenInfoTitle => 'Информация о гражданине';

  @override
  String get requestAttachmentsTitle => 'Прикреплённые файлы';

  @override
  String get requestNoAttachments => 'Нет прикреплённых файлов';

  @override
  String get requestResponseTitle => 'Ответ сотрудника';

  @override
  String get requestDeadlineLabel => 'Срок';

  @override
  String get requestRespondCta => 'Написать ответ';

  @override
  String get requestRateCta => 'Поставить баллы';

  @override
  String get requestRespondPageTitle => 'Ответ на обращение';

  @override
  String get requestResponseHint => 'Введите текст ответа';

  @override
  String get requestResponseEmptyError => 'Введите текст ответа';

  @override
  String get requestSendResponse => 'Отправить';

  @override
  String get requestRateSheetTitle => 'Поставить баллы';

  @override
  String get requestRateHint => 'Выберите количество звёзд';

  @override
  String get requestRateSubmit => 'Подтвердить';

  @override
  String get requestRespondSuccessTitle => 'Ответ отправлен';

  @override
  String get requestRespondSuccessMessage => 'Ваш ответ на обращение сохранён';

  @override
  String get requestRateSuccessTitle => 'Баллы выставлены';

  @override
  String get requestRateSuccessMessage => 'Обращение успешно оценено';

  @override
  String get requestNotFoundTitle => 'Обращение не найдено';

  @override
  String get leaveRequestTileLabel => 'Запросить отгул';

  @override
  String get premyaRequestTileLabel => 'Запросить премию';

  @override
  String get leaveRequestPageTitle => 'Запросить отгул';

  @override
  String get leaveRequestDurationTypeLabel => 'Тип продолжительности';

  @override
  String get leaveRequestDurationHours => 'Часами';

  @override
  String get leaveRequestDurationDays => 'Днями';

  @override
  String get leaveRequestAmountLabel => 'Количество';

  @override
  String get leaveRequestHoursUnit => 'ч';

  @override
  String get leaveRequestDaysUnit => 'дн';

  @override
  String get leaveRequestStartDateLabel => 'Дата начала';

  @override
  String get leaveRequestStartTimeLabel => 'Время начала';

  @override
  String get leaveRequestReasonLabel => 'Причина';

  @override
  String get leaveRequestReasonHint => 'Укажите причину запроса';

  @override
  String get leaveRequestReasonEmptyError => 'Укажите причину';

  @override
  String get leaveRequestMaxNote =>
      'Максимум — 1 рабочая неделя (6 рабочих дней)';

  @override
  String get leaveRequestSubmitCta => 'Отправить';

  @override
  String get leaveRequestSuccessTitle => 'Запрос отправлен';

  @override
  String get leaveRequestSuccessMessage =>
      'Ваш запрос на отгул отправлен и находится на рассмотрении';

  @override
  String get createRequestTitle => 'Создать обращение';

  @override
  String get createRequestTitleLabel => 'Заголовок';

  @override
  String get createRequestTitleHint => 'Введите заголовок обращения';

  @override
  String get createRequestCategoryLabel => 'Категория';

  @override
  String get createRequestCategoryHint => 'Выберите категорию';

  @override
  String get createRequestPriorityLabel => 'Уровень приоритета';

  @override
  String get createRequestDescriptionLabel => 'Описание';

  @override
  String get createRequestDescriptionHint => 'Подробно опишите обращение';

  @override
  String get createRequestAttachmentsLabel => 'Прикреплённые файлы';

  @override
  String get createRequestSubmit => 'Отправить';

  @override
  String get createRequestSuccessTitle => 'Обращение отправлено';

  @override
  String get createRequestSuccessMessage => 'Ваше обращение успешно отправлено';

  @override
  String get createRequestValidationError => 'Обязательное поле';

  @override
  String get attachmentAddImage => 'Фото';

  @override
  String get attachmentAddVideo => 'Видео';

  @override
  String get attachmentAddVoice => 'Голосовое';

  @override
  String get attachmentAddFile => 'Файл';

  @override
  String get attachmentPickSource => 'Выберите источник';

  @override
  String get attachmentCamera => 'Камера';

  @override
  String get attachmentGallery => 'Галерея';

  @override
  String get attachmentPickError => 'Не удалось выбрать файл';

  @override
  String get attachmentPlaybackError => 'Не удалось воспроизвести';

  @override
  String get recorderGrantPermission => 'Разрешить';

  @override
  String get recorderOpenSettings => 'Открыть настройки';

  @override
  String get voiceRecorderTitle => 'Голосовое сообщение';

  @override
  String get voiceRecorderIdleHint =>
      'Нажмите на микрофон, чтобы начать запись';

  @override
  String get voiceRecorderRecordingHint => 'Идёт запись…';

  @override
  String get voiceRecorderReadyHint => 'Прослушайте и прикрепите';

  @override
  String get voiceRecorderRetake => 'Заново';

  @override
  String get voiceRecorderAttach => 'Прикрепить';

  @override
  String get voiceRecorderPermissionTitle => 'Требуется доступ к микрофону';

  @override
  String get voiceRecorderPermissionMessage =>
      'Разрешите доступ к микрофону для записи голосового сообщения.';

  @override
  String get voiceRecorderError => 'Не удалось записать голос';

  @override
  String get videoRecorderTitle => 'Запись видео';

  @override
  String get videoRecorderPermissionTitle => 'Требуется доступ к камере';

  @override
  String get videoRecorderPermissionMessage =>
      'Разрешите доступ к камере и микрофону для записи видео.';

  @override
  String get videoRecorderError => 'Не удалось записать видео';

  @override
  String get videoRecorderRetake => 'Заново';

  @override
  String get videoRecorderAttach => 'Использовать';

  @override
  String get requestKindAriza => 'Заявление';

  @override
  String get requestKindShikoyat => 'Жалоба';

  @override
  String get citizenRequestStatusYuborilgan => 'Отправлено';

  @override
  String get citizenRequestStatusKorilmoqda => 'Рассматривается';

  @override
  String get citizenRequestStatusJavobBerildi => 'Отвечено';

  @override
  String get citizenRequestStatusYopildi => 'Закрыто';

  @override
  String get citizenRequestsPageTitle => 'Мои обращения';

  @override
  String get citizenRequestsAddTooltip => 'Новое обращение';

  @override
  String get citizenRequestKindLabel => 'Тип обращения';

  @override
  String get citizenRequestSubmitTitle => 'Отправка обращения';

  @override
  String get reportsPageTitle => 'Отчёт';

  @override
  String get reportsPaymentsCountLabel => 'Количество платежей';

  @override
  String get reportsPaymentsAmountLabel => 'Сумма платежей';

  @override
  String get reportsAppealsCountLabel => 'Количество заявлений';

  @override
  String get reportsComplaintsCountLabel => 'Количество жалоб';

  @override
  String get reportsByStatusTitle => 'Распределение по статусу';

  @override
  String get profileLanguageLabel => 'Язык';

  @override
  String get profileLanguageUz => 'Узбекский';

  @override
  String get profileLanguageRu => 'Русский';

  @override
  String get profileThemeLabel => 'Тема';

  @override
  String get profileThemeLight => 'Светлая';

  @override
  String get profileThemeDark => 'Тёмная';

  @override
  String get profilePinLabel => 'Изменить PIN';

  @override
  String get profileHelpLabel => 'Помощь';

  @override
  String get profileReportsLabel => 'Отчёты';

  @override
  String get profileNewsTileLabel => 'Новости';

  @override
  String get profileDocumentsTileLabel => 'Документы';

  @override
  String get chatTabAll => 'Все';

  @override
  String get chatTabPersonal => 'Личные';

  @override
  String get chatTabGroup => 'Группы';

  @override
  String get chatSearchHint => 'Поиск чатов';

  @override
  String get chatEmptyTitle => 'Чаты не найдены';

  @override
  String get chatEmptyMessage => 'Пока нет ни одного чата';

  @override
  String get chatEmptyFilteredMessage => 'По запросу ничего не найдено';

  @override
  String get chatErrorTitle => 'Не удалось загрузить чаты';

  @override
  String chatParticipantsCount(int count) {
    return '$count участников';
  }

  @override
  String get conversationEmptyTitle => 'Сообщений нет';

  @override
  String get conversationEmptyMessage => 'Отправьте первое сообщение';

  @override
  String get conversationErrorTitle => 'Не удалось загрузить сообщения';

  @override
  String get chatMessageHint => 'Введите сообщение...';

  @override
  String get chatAttachSheetTitle => 'Прикрепить';

  @override
  String get chatAttachRoundVideo => 'Круглое видео';

  @override
  String get chatAttachSticker => 'Стикер';

  @override
  String get chatStickerSheetTitle => 'Выберите стикер';

  @override
  String get chatDateToday => 'Сегодня';

  @override
  String get chatDateYesterday => 'Вчера';

  @override
  String get chatPresenceOnline => 'онлайн';

  @override
  String get profileLanguageTitle => 'Язык';

  @override
  String get languageNameUzbek => 'O\'zbek';

  @override
  String get languageNameRussian => 'Русский';

  @override
  String get profileThemeTitle => 'Тема';

  @override
  String get profileThemeOptionLight => 'Светлая';

  @override
  String get profileThemeOptionDark => 'Тёмная';

  @override
  String get profileWorkInfoTitle => 'Рабочая информация';

  @override
  String get profileWorkingHoursLabel => 'Часы работы';

  @override
  String get profileRatingLabel => 'Рейтинг';

  @override
  String get profileDepartmentLabel => 'Отдел';

  @override
  String get profileAboutTitle => 'О приложении';

  @override
  String get profileAppVersionLabel => 'Версия приложения';

  @override
  String profileWorkerIdLabel(String id) {
    return 'ID: $id';
  }

  @override
  String get mapPermissionTitle => 'Требуется доступ к геолокации';

  @override
  String get mapPermissionMessage =>
      'Разрешите доступ к геолокации, чтобы отслеживать местоположение сотрудника';

  @override
  String get mapGrantPermission => 'Разрешить доступ';

  @override
  String get mapErrorTitle => 'Не удалось отследить местоположение';

  @override
  String get mapNotTracking => 'Отслеживание не активно';

  @override
  String get mapLocating => 'Определение местоположения…';

  @override
  String get mapStartTracking => 'Начать отслеживание';

  @override
  String get mapStopTracking => 'Остановить отслеживание';

  @override
  String get mapRecenterTooltip => 'Центрировать по текущему местоположению';

  @override
  String get pinSetTitle => 'Установите PIN-код';

  @override
  String get pinSetSubtitle =>
      'Придумайте 4-значный PIN-код для быстрого и безопасного доступа к приложению';

  @override
  String get pinConfirmTitle => 'Подтвердите PIN-код';

  @override
  String get pinConfirmSubtitle => 'Введите выбранный PIN-код ещё раз';

  @override
  String get pinMismatchError => 'PIN-коды не совпадают. Попробуйте снова';

  @override
  String get pinSetSuccessTitle => 'PIN-код успешно установлен!';

  @override
  String get pinUnlockTitle => 'Введите PIN-код';

  @override
  String get pinUnlockSubtitle => 'Введите свой PIN-код, чтобы продолжить';

  @override
  String get pinWrongError => 'Неверный PIN-код';

  @override
  String get pinStorageErrorMessage =>
      'Не удалось сохранить PIN-код. Попробуйте снова';

  @override
  String get pinLockedOutMessage =>
      'Слишком много неверных попыток. Повторите попытку позже';

  @override
  String get workerAppName => 'Хокимият Сотрудник';

  @override
  String get createRequestCategoryUtilities => 'Коммунальные услуги';

  @override
  String get createRequestCategoryRoads => 'Дорожное хозяйство';

  @override
  String get createRequestCategoryReference => 'Справка';

  @override
  String get createRequestCategorySanitation => 'Санитария';

  @override
  String get createRequestCategorySocialInfra => 'Социальная инфраструктура';

  @override
  String get createRequestCategoryPublicOrder => 'Общественный порядок';

  @override
  String get createRequestCategorySocialAid => 'Социальная помощь';

  @override
  String get createRequestCategoryEducation => 'Образование';

  @override
  String get createRequestCategoryConstruction => 'Строительство';

  @override
  String get searchHint => 'Поиск';

  @override
  String get registrationPageTitle => 'Регистрация';

  @override
  String get registrationHeadline => 'Ваши личные данные';

  @override
  String get registrationSubtitle => 'Чтобы продолжить, заполните данные ниже';

  @override
  String get registrationFullNameLabel => 'Ф.И.О. (полное имя)';

  @override
  String get registrationFullNameHint => 'Фамилия Имя Отчество';

  @override
  String get registrationDocumentTypeLabel => 'Тип документа';

  @override
  String get registrationDocumentTypePinfl => 'ПИНФЛ';

  @override
  String get registrationDocumentTypePassport => 'Паспорт';

  @override
  String get registrationPinflLabel => 'ПИНФЛ (14 цифр)';

  @override
  String get registrationPinflHint => '12345678901234';

  @override
  String get registrationPassportLabel => 'Серия и номер паспорта';

  @override
  String get registrationPassportHint => 'AA1234567';

  @override
  String get registrationBirthDateLabel => 'Дата рождения';

  @override
  String get registrationBirthDateHint => 'ДД.ММ.ГГГГ';

  @override
  String get registrationRegionLabel => 'Область';

  @override
  String get registrationRegionHint => 'Выберите область';

  @override
  String get registrationDistrictLabel => 'Район';

  @override
  String get registrationDistrictHint => 'Выберите район';

  @override
  String get registrationDistrictHintNoRegion => 'Сначала выберите область';

  @override
  String get registrationAddressLabel => 'Адрес проживания';

  @override
  String get registrationAddressHint => 'Введите адрес проживания';

  @override
  String get registrationSubmit => 'Продолжить';

  @override
  String get registrationSuccessTitle => 'Данные успешно сохранены!';

  @override
  String get registrationFullNameError =>
      'Введите полное имя (минимум имя и фамилия)';

  @override
  String get registrationPinflError => 'ПИНФЛ должен состоять из 14 цифр';

  @override
  String get registrationPassportError =>
      'Паспорт: 2 буквы + 7 цифр (например AA1234567)';

  @override
  String get registrationBirthDateError =>
      'Введите корректную дату рождения (например 01.01.1990)';

  @override
  String get registrationRegionError => 'Выберите область';

  @override
  String get registrationDistrictError => 'Выберите район';

  @override
  String get registrationAddressError =>
      'Введите ваш адрес (минимум 5 символов)';

  @override
  String get registrationStorageErrorMessage =>
      'Не удалось сохранить данные. Попробуйте снова';

  @override
  String get registrationRegionToshkentShahri => 'город Ташкент';

  @override
  String get registrationRegionToshkentViloyati => 'Ташкентская область';

  @override
  String get registrationRegionAndijon => 'Андижанская область';

  @override
  String get registrationRegionFargona => 'Ферганская область';

  @override
  String get registrationRegionNamangan => 'Наманганская область';

  @override
  String get registrationRegionSamarqand => 'Самаркандская область';

  @override
  String get registrationRegionBuxoro => 'Бухарская область';

  @override
  String get registrationRegionXorazm => 'Хорезмская область';

  @override
  String get registrationRegionNavoiy => 'Навоийская область';

  @override
  String get registrationRegionQashqadaryo => 'Кашкадарьинская область';

  @override
  String get registrationRegionSurxondaryo => 'Сурхандарьинская область';

  @override
  String get registrationRegionJizzax => 'Джизакская область';

  @override
  String get registrationRegionSirdaryo => 'Сырдарьинская область';

  @override
  String get registrationRegionQoraqalpogiston => 'Республика Каракалпакстан';

  @override
  String get registrationDistrictChilonzor => 'Чиланзарский район';

  @override
  String get registrationDistrictYunusobod => 'Юнусабадский район';

  @override
  String get registrationDistrictZangiota => 'Зангиатинский район';

  @override
  String get registrationDistrictQibray => 'Кибрайский район';

  @override
  String get registrationDistrictAndijonShahri => 'город Андижан';

  @override
  String get registrationDistrictAsaka => 'Асакинский район';

  @override
  String get registrationDistrictFargonaShahri => 'город Фергана';

  @override
  String get registrationDistrictQoqon => 'город Коканд';

  @override
  String get registrationDistrictNamanganShahri => 'город Наманган';

  @override
  String get registrationDistrictChust => 'Чустский район';

  @override
  String get registrationDistrictSamarqandShahri => 'город Самарканд';

  @override
  String get registrationDistrictUrgut => 'Ургутский район';

  @override
  String get registrationDistrictBuxoroShahri => 'город Бухара';

  @override
  String get registrationDistrictGijduvon => 'Гиждуванский район';

  @override
  String get registrationDistrictUrganch => 'город Ургенч';

  @override
  String get registrationDistrictXiva => 'Хивинский район';

  @override
  String get registrationDistrictNavoiyShahri => 'город Навои';

  @override
  String get registrationDistrictZarafshon => 'город Зарафшан';

  @override
  String get registrationDistrictQarshi => 'город Карши';

  @override
  String get registrationDistrictShahrisabz => 'Шахрисабзский район';

  @override
  String get registrationDistrictTermiz => 'город Термез';

  @override
  String get registrationDistrictDenov => 'Денауский район';

  @override
  String get registrationDistrictJizzaxShahri => 'город Джизак';

  @override
  String get registrationDistrictZomin => 'Зааминский район';

  @override
  String get registrationDistrictGuliston => 'город Гулистан';

  @override
  String get registrationDistrictShirin => 'Ширинский район';

  @override
  String get registrationDistrictNukus => 'город Нукус';

  @override
  String get registrationDistrictXojayli => 'Ходжейлийский район';

  @override
  String profileEnrolledOn(String date) {
    return 'Зарегистрирован: $date';
  }

  @override
  String get meetingsPageTitle => 'Совещания';

  @override
  String get meetingsFilterAll => 'Все';

  @override
  String get meetingStatusLive => 'В эфире';

  @override
  String get meetingStatusScheduled => 'Запланировано';

  @override
  String get meetingStatusEnded => 'Завершено';

  @override
  String get meetingsEmptyTitle => 'Совещания не найдены';

  @override
  String get meetingsEmptyMessage => 'Пока нет совещаний для отображения';

  @override
  String get meetingsErrorTitle => 'Не удалось загрузить совещания';

  @override
  String get meetingJoinShortCta => 'Подключиться';

  @override
  String get meetingDetailTitle => 'Детали совещания';

  @override
  String get meetingHostLabel => 'Организатор';

  @override
  String meetingDurationLabel(int minutes) {
    return '$minutes мин.';
  }

  @override
  String get meetingDescriptionTitle => 'Повестка дня';

  @override
  String get meetingNoDescription => 'Повестка дня не указана';

  @override
  String meetingParticipantsCount(int count) {
    return '$count участников';
  }

  @override
  String get meetingJoinCta => 'Подключиться к совещанию';

  @override
  String get meetingJoiningStatus => 'Подключение…';

  @override
  String get meetingEndedNotice => 'Это совещание уже завершено';

  @override
  String get meetingJoinedTitle => 'Вы подключились!';

  @override
  String get meetingJoinedMessage =>
      'Присоединитесь к совещанию по ссылке ниже';

  @override
  String get meetingJoinUrlCopied => 'Ссылка скопирована';

  @override
  String get meetingCopyLink => 'Скопировать ссылку';

  @override
  String get meetingNotFoundTitle => 'Совещание не найдено';

  @override
  String get callBrandLabel => 'Видеоконференция';

  @override
  String get callSecureConnection => 'Безопасное соединение';

  @override
  String get callInitializingMedia => 'Включение камеры и микрофона…';

  @override
  String get callLobbyJoinNow => 'Присоединиться сейчас';

  @override
  String get callJoinWithoutCamera => 'Присоединиться без камеры';

  @override
  String callParticipantsWaiting(int count) {
    return 'Ожидают подключения: $count';
  }

  @override
  String get callYouAreFirst => 'Вы подключаетесь первым';

  @override
  String get callYou => 'Вы';

  @override
  String get callYouSuffix => '(вы)';

  @override
  String get callCameraOff => 'Камера выключена';

  @override
  String get callMic => 'Микрофон';

  @override
  String get callCamera => 'Камера';

  @override
  String get callScreen => 'Экран';

  @override
  String get callReaction => 'Реакция';

  @override
  String get callEnd => 'Завершить';

  @override
  String get callEndConfirmTitle => 'Завершить звонок?';

  @override
  String get callEndConfirmMessage =>
      'Вы выйдете из видеоконференции — соединение будет прервано для вас.';

  @override
  String get callLive => 'LIVE';

  @override
  String callParticipantsTitle(int count) {
    return 'Участники ($count)';
  }

  @override
  String callParticipantJoined(String name) {
    return '$name присоединился(-ась)';
  }

  @override
  String get callDeviceOnlyNote =>
      'Подключаясь, вы соглашаетесь на использование камеры и микрофона только на этом устройстве.';

  @override
  String get callSharingBanner => 'Вы демонстрируете экран';

  @override
  String get homeQuickActionsTitle => 'Быстрые действия';

  @override
  String get pointsPageTitle => 'Мои баллы';

  @override
  String get pointsTotalLabel => 'Общий балл';

  @override
  String pointsRankLabel(int rank) {
    return '$rank-е место';
  }

  @override
  String get pointsSummaryPositiveLabel => 'Начислено';

  @override
  String get pointsSummaryNegativeLabel => 'Списано';

  @override
  String get pointsHistoryTitle => 'История изменений';

  @override
  String get pointsEmptyTitle => 'История баллов не найдена';

  @override
  String get pointsEmptyMessage => 'Пока нет изменений баллов';

  @override
  String get pointsErrorTitle => 'Не удалось загрузить баллы';

  @override
  String get suggestionsPageTitle => 'Предложения';

  @override
  String get suggestionsFilterTitle => 'Фильтр';

  @override
  String get suggestionsFilterStatusLabel => 'Статус';

  @override
  String get suggestionsFilterAll => 'Все';

  @override
  String get suggestionsSearchHint => 'Поиск предложений';

  @override
  String get suggestionsEmptyTitle => 'Предложения не найдены';

  @override
  String get suggestionsEmptyMessage => 'Пока нет предложений для отображения';

  @override
  String get suggestionsEmptyFilteredMessage =>
      'По выбранным фильтрам предложений не найдено';

  @override
  String get suggestionsErrorTitle => 'Не удалось загрузить предложения';

  @override
  String get suggestionStatusYangi => 'Новое';

  @override
  String get suggestionStatusKorilmoqda => 'Рассматривается';

  @override
  String get suggestionStatusQabulQilindi => 'Принято';

  @override
  String get suggestionStatusRad => 'Отклонено';

  @override
  String get suggestionCategoryDigital => 'Цифровизация';

  @override
  String get suggestionCategoryProcess => 'Рабочий процесс';

  @override
  String get suggestionCategorySocial => 'Социальное';

  @override
  String get suggestionCategoryInfra => 'Инфраструктура';

  @override
  String get suggestionCategoryOther => 'Другое';

  @override
  String get submitSuggestionTitle => 'Отправить предложение';

  @override
  String get submitSuggestionTitleLabel => 'Заголовок';

  @override
  String get submitSuggestionTitleHint => 'Введите заголовок предложения';

  @override
  String get submitSuggestionCategoryLabel => 'Категория';

  @override
  String get submitSuggestionCategoryHint => 'Выберите категорию';

  @override
  String get submitSuggestionBodyLabel => 'Текст предложения';

  @override
  String get submitSuggestionBodyHint => 'Опишите вашу идею подробно';

  @override
  String get submitSuggestionSubmit => 'Отправить';

  @override
  String get submitSuggestionSuccessTitle => 'Предложение отправлено';

  @override
  String get submitSuggestionSuccessMessage =>
      'Ваше предложение успешно отправлено';

  @override
  String get homeTodayOverviewTitle => 'Обзор на сегодня';

  @override
  String get homeStripNewRequests => 'Новые обращения';

  @override
  String get homeStripUnreadChat => 'Непрочитанные';

  @override
  String get homeStripMeetingsToday => 'Совещания сегодня';

  @override
  String get homeSectionsTitle => 'Разделы';

  @override
  String homeNewRequestsBadge(int count) {
    return '$count новых';
  }

  @override
  String homeUnreadChatBadge(int count) {
    return '$count непрочитано';
  }

  @override
  String homeMeetingsTodayBadge(int count) {
    return '$count сегодня';
  }

  @override
  String get homeAnalyticsTile => 'Аналитика';

  @override
  String get homeRecentActivityTitle => 'Последние события';

  @override
  String get homeActivityNewRequest => 'Вам назначено новое обращение';

  @override
  String get homeActivityMeetingStarting => 'Совещание начинается';

  @override
  String get homeActivityNewMessage => 'Новое сообщение в чате';

  @override
  String get homeGeofenceInside => 'Внутри';

  @override
  String get homeGeofenceOutside => 'Снаружи';

  @override
  String get workScheduleTileLabel => 'График работы';

  @override
  String get workSchedulePageTitle => 'График работы';

  @override
  String get workScheduleSubtitle =>
      'Недельный график — 6-дневная рабочая неделя';

  @override
  String get workScheduleTodayBadge => 'Сегодня';

  @override
  String get workScheduleRestDay => 'Выходной';

  @override
  String get workScheduleHours => '09:00–18:00';

  @override
  String get weekdayMonday => 'Понедельник';

  @override
  String get weekdayTuesday => 'Вторник';

  @override
  String get weekdayWednesday => 'Среда';

  @override
  String get weekdayThursday => 'Четверг';

  @override
  String get weekdayFriday => 'Пятница';

  @override
  String get weekdaySaturday => 'Суббота';

  @override
  String get weekdaySunday => 'Воскресенье';

  @override
  String get mapWorkZoneLegend => 'Рабочая зона';

  @override
  String get mapWorkHourInsideMessage =>
      'Сейчас рабочее время — вы в рабочей зоне';

  @override
  String get mapWorkHourOutsideMessage =>
      'Сейчас рабочее время — вернитесь в рабочую зону';

  @override
  String get mapOffWorkHoursMessage => 'Сейчас не рабочее время';

  @override
  String get mapWorkZoneRuleTitle => 'Правило рабочей зоны';

  @override
  String get mapWorkZoneRuleText =>
      'Находитесь в рабочей зоне в рабочее время. Если вы покинете рабочую зону более чем на 30 минут, ваши баллы будут снижены.';

  @override
  String get notificationsTitle => 'Уведомления';

  @override
  String get notificationsMarkAllRead => 'Отметить все как прочитанные';

  @override
  String get notificationsEmptyTitle => 'Нет уведомлений';

  @override
  String get notificationsEmptyMessage => 'У вас пока нет уведомлений';

  @override
  String get notificationsErrorTitle => 'Ошибка загрузки';

  @override
  String get notificationsJustNow => 'Только что';

  @override
  String get notificationsMinutesAgoSuffix => 'мин. назад';

  @override
  String get notificationsHoursAgoSuffix => 'ч. назад';

  @override
  String get notificationsDaysAgoSuffix => 'дн. назад';
}
