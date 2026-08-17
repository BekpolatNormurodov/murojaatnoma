import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:user_app/app/router/app_router.dart';
import 'package:user_app/core/cache/cache_service.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/core/notifications/notification_service.dart';
import 'package:user_app/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:user_app/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:user_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:user_app/features/auth/domain/usecases/restore_session.dart';
import 'package:user_app/features/auth/domain/usecases/send_otp.dart';
import 'package:user_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:user_app/features/face/data/repositories/face_repository_impl.dart';
import 'package:user_app/features/face/data/services/face_detector_service.dart';
import 'package:user_app/features/face/data/services/face_embedder.dart';
import 'package:user_app/features/face/data/services/face_photo_store.dart';
import 'package:user_app/features/face/domain/repositories/face_repository.dart';
import 'package:user_app/features/face/domain/usecases/enroll_face.dart';
import 'package:user_app/features/face/presentation/bloc/face_cubit.dart';
import 'package:user_app/features/home/presentation/bloc/home_cubit.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:user_app/features/payments/data/datasources/payments_remote_data_source.dart';
import 'package:user_app/features/payments/data/repositories/payments_repository_impl.dart';
import 'package:user_app/features/payments/domain/repositories/payments_repository.dart';
import 'package:user_app/features/payments/domain/usecases/get_payment_history.dart';
import 'package:user_app/features/payments/domain/usecases/get_utilities.dart';
import 'package:user_app/features/payments/domain/usecases/pay_utility.dart';
import 'package:user_app/features/payments/presentation/bloc/pay_cubit.dart';
import 'package:user_app/features/payments/presentation/bloc/payment_history_cubit.dart';
import 'package:user_app/features/payments/presentation/bloc/utilities_cubit.dart';
import 'package:user_app/features/pin/data/datasources/pin_local_data_source.dart';
import 'package:user_app/features/pin/data/repositories/pin_repository_impl.dart';
import 'package:user_app/features/pin/domain/repositories/pin_repository.dart';
import 'package:user_app/features/pin/domain/usecases/set_pin.dart';
import 'package:user_app/features/pin/domain/usecases/verify_pin.dart';
import 'package:user_app/features/pin/presentation/bloc/pin_cubit.dart';
import 'package:user_app/features/registration/data/datasources/registration_local_data_source.dart';
import 'package:user_app/features/registration/data/repositories/registration_repository_impl.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';
import 'package:user_app/features/registration/domain/usecases/save_citizen_profile.dart';
import 'package:user_app/features/registration/presentation/bloc/registration_cubit.dart';
import 'package:user_app/features/reports/presentation/bloc/reports_cubit.dart';
import 'package:user_app/features/requests/data/datasources/citizen_requests_remote_data_source.dart';
import 'package:user_app/features/requests/data/repositories/citizen_requests_repository_impl.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_request.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_requests.dart';
import 'package:user_app/features/requests/domain/usecases/get_request_messages.dart';
import 'package:user_app/features/requests/domain/usecases/send_request_message.dart';
import 'package:user_app/features/requests/domain/usecases/submit_citizen_request.dart';
import 'package:user_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:user_app/features/requests/presentation/bloc/requests_cubit.dart';
import 'package:user_app/features/requests/presentation/bloc/submit_request_cubit.dart';

/// Global service locator.
final getIt = GetIt.instance;

/// Barcha bog'liqliklarni ro'yxatdan o'tkazish.
Future<void> configureDependencies() async {
  final prefs = await SharedPreferences.getInstance();
  getIt
    // ---- External ----
    ..registerSingleton<SharedPreferences>(prefs)
    ..registerLazySingleton<DioClient>(DioClient.new)
    ..registerLazySingleton<FlutterSecureStorage>(
      () => const FlutterSecureStorage(),
    )
    // `NotificationService` — HAQIQIY on-device mahalliy bildirishnomalar
    // (`flutter_local_notifications` ustidan yupqa qatlam). Lazy singleton:
    // butun ilova davomida BITTA plagin instansiyasi (`init()` bir marta,
    // `bootstrap()`da) kifoya.
    ..registerLazySingleton<NotificationService>(NotificationService.new)
    // `CacheService` — SharedPreferences ustidagi yupqa, ixtiyoriy TTL'ga
    // ega JSON kesh. "Cache-then-network" ro'yxat ekranlari uchun: lazy
    // singleton, chunki butun ilova davomida bitta `SharedPreferences`
    // instansiyasi ustida ishlaydi (yuqoridagi bilan bir xil).
    ..registerLazySingleton<CacheService>(
      () => CacheService(getIt<SharedPreferences>()),
    )
    // `AppLogger` — debug-only konsol logging seam'i (kelajakdagi
    // crash/monitoring backend uchun). Holatsiz, shuning uchun lazy
    // singleton xavfsiz va yetarli.
    ..registerLazySingleton<AppLogger>(AppLogger.new)
    // ---- App-level cubits (theme + locale) ----
    ..registerFactory<ThemeCubit>(ThemeCubit.new)
    ..registerFactory<LocaleCubit>(LocaleCubit.new)
    // ---- Router ----
    ..registerLazySingleton<AppRouter>(AppRouter.new)
    // ---- Auth ----
    // MUROJAAT (arizalar/shikoyatlar) funksiyasi HAQIQIY, jonli backendga
    // (`https://murojaatnoma.uz/api`) ulanadi — bu esa fuqaroning
    // avtorizatsiya qilingan bo'lishini talab qiladi. Shu sabab Auth
    // ATAYLAB `AppConfig.useMock`dan MUSTAQIL RAVISHDA doim HAQIQIY
    // `AuthApiImpl`ga ulanadi (boshqa barcha funksiyalar — to'lovlar va
    // h.k. — hali ham o'zining `AppConfig.useMock` shartiga bo'ysunadi,
    // ularning backendi hali tayyor emas). `AuthRemoteDataSourceMockImpl`
    // shu tufayli endi hech qayerdan ro'yxatdan o'tkazilmaydi (klass
    // o'zi hali ham mavjud — kelajakda kerak bo'lsa qaytarish oson).
    ..registerLazySingleton<AuthRemoteDataSource>(
      () => AuthApiImpl(getIt<DioClient>()),
    )
    ..registerLazySingleton<AuthRepository>(
      () => AuthRepositoryImpl(
        remote: getIt<AuthRemoteDataSource>(),
        prefs: getIt<SharedPreferences>(),
      ),
    )
    ..registerLazySingleton<SendOtp>(() => SendOtp(getIt<AuthRepository>()))
    ..registerLazySingleton<VerifyOtp>(() => VerifyOtp(getIt<AuthRepository>()))
    ..registerLazySingleton<RestoreSession>(
      () => RestoreSession(getIt<AuthRepository>()),
    )
    // `registerLazySingleton` (FACTORY EMAS): `AppRouter`
    // (`redirect`/`refreshListenable`) va ilova ildizidagi `BlocProvider`
    // (`app.dart`) ikkalasi ham `getIt<AuthCubit>()` chaqiradi — agar
    // factory bo'lganida ikkalasi IKKI XIL instansiya olar edi va router
    // hech qachon widget daraxti ko'rayotgan haqiqiy auth holatini
    // ko'rmagan bo'lardi (redirect doim eskirgan/boshlang'ich holatga
    // asoslanib qolardi). Butun ilova davomida BITTA instansiya kerak
    // (`worker_app`da bir xil naqsh, bir xil sabab bilan).
    ..registerLazySingleton<AuthCubit>(
      () => AuthCubit(
        sendOtp: getIt<SendOtp>(),
        verifyOtp: getIt<VerifyOtp>(),
        restoreSession: getIt<RestoreSession>(),
      ),
    )
    // ---- Registration (Faza 3: shaxsiy ma'lumotlar — OTP dan keyin, yuz/
    // PIN bosqichlaridan oldin, bir martalik, xavfsiz saqlash) ----
    ..registerLazySingleton<RegistrationLocalDataSource>(
      () => RegistrationLocalDataSourceImpl(getIt<FlutterSecureStorage>()),
    )
    ..registerLazySingleton<RegistrationRepository>(
      () => RegistrationRepositoryImpl(
        local: getIt<RegistrationLocalDataSource>(),
      ),
    )
    ..registerLazySingleton<SaveCitizenProfile>(
      () => SaveCitizenProfile(getIt<RegistrationRepository>()),
    )
    // `RegistrationCubit` — har bir `/register` ochilishida YANGI
    // instansiya (factory), `PinCubit`/`SubmitRequestCubit` bilan bir xil
    // naqsh: bu shakl ilova davomida amalda faqat bir marta ko'rinadi,
    // lekin factory bo'lishi holatning keyingi tashrifga "sizib
    // qolmasligini" kafolatlaydi.
    ..registerFactory<RegistrationCubit>(
      () => RegistrationCubit(saveCitizenProfile: getIt<SaveCitizenProfile>()),
    )
    // ---- Face (Faza 3: identity enrollment — xavfsiz saqlash) ----
    ..registerLazySingleton<FaceLocalDataSource>(
      () => FaceLocalDataSourceImpl(getIt<FlutterSecureStorage>()),
    )
    ..registerLazySingleton<FaceRepository>(
      () => FaceRepositoryImpl(local: getIt<FaceLocalDataSource>()),
    )
    ..registerLazySingleton<EnrollFace>(
      () => EnrollFace(getIt<FaceRepository>()),
    )
    // `FaceEmbedder` — UI/controller qatlami kamera kadrlaridan embedding
    // hisoblash uchun ishlatadi.
    ..registerLazySingleton<FaceEmbedder>(FaceEmbedder.new)
    // `FacePhotoStore` — ro'yxatdan o'tkazishda skanerlangan yuzni profil
    // avatari uchun lokal JPG'ga saqlaydi (best-effort); Profil sahifasi
    // uni `currentPath()` orqali o'qiydi.
    ..registerLazySingleton<FacePhotoStore>(FacePhotoStoreImpl.new)
    // `FaceDetectorService` — har safar YANGI instance (factory): ichida
    // native ML Kit `FaceDetector` ushlaydi, `FaceCubit.close()` uni
    // `dispose()` qiladi. Singleton bo'lganda birinchi sahifadan
    // chiqishda butun ilova uchun bitta detector yopilib qolar edi.
    ..registerFactory<FaceDetectorService>(FaceDetectorService.new)
    // `FaceCubit` — `/face/onboarding` ochilganda joriy sessiyaning
    // `userId`si bilan yaratiladi: `getIt<FaceCubit>(param1: ownerId)`
    // (`worker_app`dagi `FaceCubit(param1: workerId)` bilan bir xil naqsh).
    ..registerFactoryParam<FaceCubit, String, void>(
      (ownerId, _) => FaceCubit(
        detector: getIt<FaceDetectorService>(),
        embedder: getIt<FaceEmbedder>(),
        enrollFace: getIt<EnrollFace>(),
        ownerId: ownerId,
        facePhotoStore: getIt<FacePhotoStore>(),
      ),
    )
    // ---- PIN (Faza 3: ilova-qulf — xeshlangan saqlash) ----
    ..registerLazySingleton<PinLocalDataSource>(
      () => PinLocalDataSourceImpl(getIt<FlutterSecureStorage>()),
    )
    ..registerLazySingleton<PinRepository>(
      () => PinRepositoryImpl(local: getIt<PinLocalDataSource>()),
    )
    ..registerLazySingleton<SetPin>(() => SetPin(getIt<PinRepository>()))
    ..registerLazySingleton<VerifyPin>(() => VerifyPin(getIt<PinRepository>()))
    // `PinCubit` — har bir `/pin/set` / `/pin/unlock` ochilishida YANGI
    // instansiya (factory): ikkala sahifa ham bir xil turdagi cubit'ni
    // ishlatadi, lekin ularning holati bir-biriga "sizib qolmasligi"
    // kerak (`RequestDetailCubit` bilan bir xil naqsh).
    ..registerFactory<PinCubit>(
      () => PinCubit(setPin: getIt<SetPin>(), verifyPin: getIt<VerifyPin>()),
    )
    // ---- Payments (kommunalka) — Mock/Api seam via AppConfig.useMock ----
    ..registerLazySingleton<PaymentsRemoteDataSource>(
      () => AppConfig.useMock
          ? PaymentsRemoteDataSourceMockImpl()
          : PaymentsApiImpl(getIt<DioClient>()),
    )
    ..registerLazySingleton<PaymentsRepository>(
      () => PaymentsRepositoryImpl(remote: getIt<PaymentsRemoteDataSource>()),
    )
    ..registerLazySingleton<GetUtilities>(
      () => GetUtilities(getIt<PaymentsRepository>()),
    )
    ..registerLazySingleton<PayUtility>(
      () => PayUtility(getIt<PaymentsRepository>()),
    )
    ..registerLazySingleton<GetPaymentHistory>(
      () => GetPaymentHistory(getIt<PaymentsRepository>()),
    )
    // `HomeCubit`/`UtilitiesCubit` — LAZY SINGLETON (factory emas), xuddi
    // `AuthCubit` kabi: to'lov muvaffaqiyatli bo'lgach ularni istalgan
    // joydan (masalan `PayPage`, ildiz navigatorida — shell subtree'siga
    // kirmaydi) `getIt<...>().load()` orqali to'g'ridan-to'g'ri qayta
    // yuklash kerak. Factory bo'lganida bu chaqiruv YANGI, ekranga
    // bog'lanmagan instansiya yaratib, hech narsani yangilamas edi.
    ..registerLazySingleton<HomeCubit>(
      () => HomeCubit(getUtilities: getIt<GetUtilities>()),
    )
    ..registerLazySingleton<UtilitiesCubit>(
      () => UtilitiesCubit(getUtilities: getIt<GetUtilities>()),
    )
    ..registerFactory<PayCubit>(() => PayCubit(payUtility: getIt<PayUtility>()))
    ..registerFactory<PaymentHistoryCubit>(
      () => PaymentHistoryCubit(getPaymentHistory: getIt<GetPaymentHistory>()),
    )
    // ---- Citizen requests (arizalar/shikoyatlar — MUROJAAT) ----
    // Shu ilova sessiyasining asosiy vazifasi: MUROJAAT ATAYLAB doim
    // HAQIQIY `CitizenRequestsApiImpl`ga ulanadi (`AppConfig.useMock`dan
    // MUSTAQIL, xuddi Auth kabi) — `https://murojaatnoma.uz/api
    // /applications*`. Boshqa barcha funksiyalar (to'lovlar va h.k.)
    // o'zining mavjud `AppConfig.useMock` shartida qoladi —
    // `AppConfig.apiBaseUrl` global o'zgarmagani uchun ularning backendi
    // hali tayyor bo'lmasa ham buzilmaydi.
    ..registerLazySingleton<CitizenRequestsRemoteDataSource>(
      () => CitizenRequestsApiImpl(
        getIt<DioClient>(),
        authRepository: getIt<AuthRepository>(),
        registrationRepository: getIt<RegistrationRepository>(),
      ),
    )
    ..registerLazySingleton<CitizenRequestsRepository>(
      () => CitizenRequestsRepositoryImpl(
        remote: getIt<CitizenRequestsRemoteDataSource>(),
      ),
    )
    ..registerLazySingleton<GetCitizenRequests>(
      () => GetCitizenRequests(getIt<CitizenRequestsRepository>()),
    )
    ..registerLazySingleton<GetCitizenRequest>(
      () => GetCitizenRequest(getIt<CitizenRequestsRepository>()),
    )
    ..registerLazySingleton<SubmitCitizenRequest>(
      () => SubmitCitizenRequest(getIt<CitizenRequestsRepository>()),
    )
    ..registerLazySingleton<GetRequestMessages>(
      () => GetRequestMessages(getIt<CitizenRequestsRepository>()),
    )
    ..registerLazySingleton<SendRequestMessage>(
      () => SendRequestMessage(getIt<CitizenRequestsRepository>()),
    )
    // `RequestsCubit` — router'ning "applications" shell branchida
    // yaratiladi: factory, chunki `StatefulShellRoute.indexedStack` branch
    // holatini o'zi saqlaydi — amalda ilova davomida faqat BIR MARTA
    // yaratiladi (`worker-app`dagi `RequestsCubit` bilan bir xil naqsh).
    ..registerFactory<RequestsCubit>(
      () => RequestsCubit(getCitizenRequests: getIt<GetCitizenRequests>()),
    )
    // `RequestDetailCubit` — har bir `/applications/:id` ochilishida YANGI
    // instansiya (factory): oldingi murojaatning holati keyingisiga
    // "sizib qolmasligi" kerak.
    ..registerFactory<RequestDetailCubit>(
      () => RequestDetailCubit(
        getCitizenRequest: getIt<GetCitizenRequest>(),
        getRequestMessages: getIt<GetRequestMessages>(),
        sendRequestMessage: getIt<SendRequestMessage>(),
      ),
    )
    // `SubmitRequestCubit` — har bir `/applications/submit` ochilishida
    // YANGI instansiya, xuddi `PayCubit` kabi.
    ..registerFactory<SubmitRequestCubit>(
      () => SubmitRequestCubit(
        submitCitizenRequest: getIt<SubmitCitizenRequest>(),
      ),
    )
    // ---- Reports (hisobot) — mavjud to'lovlar/murojaatlar repolaridan
    // hisoblanadi, alohida data qatlami yo'q ----
    ..registerFactory<ReportsCubit>(
      () => ReportsCubit(
        getPaymentHistory: getIt<GetPaymentHistory>(),
        getCitizenRequests: getIt<GetCitizenRequests>(),
      ),
    )
    // ---- Bildirishnomalar/Notifications (mock-first ro'yxat) ----
    // `HomeCubit` bilan bir xil naqsh: LAZY SINGLETON (factory EMAS) —
    // bosh sahifadagi qo'ng'iroq belgisi VA `/notifications` sahifasi
    // XUDDI SHU instansiyani (va uning unread-sonini) ko'rishi kerak.
    ..registerLazySingleton<NotificationsCubit>(NotificationsCubit.new);
}
