import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/app/router/app_router.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/core/notifications/notification_service.dart';
import 'package:worker_app/features/attendance/data/datasources/attendance_remote_data_source.dart';
import 'package:worker_app/features/attendance/data/repositories/attendance_repository_impl.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_out.dart';
import 'package:worker_app/features/attendance/domain/usecases/get_my_attendance.dart';
import 'package:worker_app/features/attendance/presentation/bloc/attendance_cubit.dart';
import 'package:worker_app/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:worker_app/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:worker_app/features/auth/domain/usecases/restore_session.dart';
import 'package:worker_app/features/auth/domain/usecases/send_otp.dart';
import 'package:worker_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/chat/data/datasources/chat_remote_data_source.dart';
import 'package:worker_app/features/chat/data/repositories/chat_repository_impl.dart';
import 'package:worker_app/features/chat/domain/repositories/chat_repository.dart';
import 'package:worker_app/features/chat/domain/usecases/get_conversations.dart';
import 'package:worker_app/features/chat/domain/usecases/get_messages.dart';
import 'package:worker_app/features/chat/domain/usecases/send_message.dart';
import 'package:worker_app/features/chat/presentation/bloc/chat_list_cubit.dart';
import 'package:worker_app/features/chat/presentation/bloc/conversation_cubit.dart';
import 'package:worker_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:worker_app/features/face/data/datasources/face_remote_data_source.dart';
import 'package:worker_app/features/face/data/repositories/face_repository_impl.dart';
import 'package:worker_app/features/face/data/services/face_detector_service.dart';
import 'package:worker_app/features/face/data/services/face_embedder.dart';
import 'package:worker_app/features/face/data/services/face_photo_store.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';
import 'package:worker_app/features/face/domain/usecases/enroll_face.dart';
import 'package:worker_app/features/face/domain/usecases/verify_face.dart';
import 'package:worker_app/features/face/presentation/bloc/face_cubit.dart';
import 'package:worker_app/features/map/presentation/bloc/map_cubit.dart';
import 'package:worker_app/features/meetings/data/datasources/meetings_remote_data_source.dart';
import 'package:worker_app/features/meetings/data/repositories/meetings_repository_impl.dart';
import 'package:worker_app/features/meetings/domain/repositories/meetings_repository.dart';
import 'package:worker_app/features/meetings/domain/usecases/get_meeting.dart';
import 'package:worker_app/features/meetings/domain/usecases/get_meetings.dart';
import 'package:worker_app/features/meetings/domain/usecases/join_meeting.dart';
import 'package:worker_app/features/meetings/presentation/bloc/meeting_detail_cubit.dart';
import 'package:worker_app/features/meetings/presentation/bloc/meetings_cubit.dart';
import 'package:worker_app/features/notifications/data/datasources/notifications_remote_data_source.dart';
import 'package:worker_app/features/notifications/data/repositories/notifications_repository_impl.dart';
import 'package:worker_app/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:worker_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:worker_app/features/points/data/datasources/points_remote_data_source.dart';
import 'package:worker_app/features/points/data/repositories/points_repository_impl.dart';
import 'package:worker_app/features/points/domain/repositories/points_repository.dart';
import 'package:worker_app/features/points/domain/usecases/get_current_points.dart';
import 'package:worker_app/features/points/domain/usecases/get_points_history.dart';
import 'package:worker_app/features/points/presentation/bloc/points_cubit.dart';
import 'package:worker_app/features/requests/data/datasources/applications_remote_data_source.dart';
import 'package:worker_app/features/requests/data/repositories/applications_repository_impl.dart';
import 'package:worker_app/features/requests/domain/repositories/applications_repository.dart';
import 'package:worker_app/features/requests/domain/usecases/get_application.dart';
import 'package:worker_app/features/requests/domain/usecases/get_applications.dart';
import 'package:worker_app/features/requests/domain/usecases/rate_application.dart';
import 'package:worker_app/features/requests/domain/usecases/respond_application.dart';
import 'package:worker_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:worker_app/features/requests/presentation/bloc/requests_cubit.dart';
import 'package:worker_app/features/suggestions/data/datasources/suggestions_remote_data_source.dart';
import 'package:worker_app/features/suggestions/data/repositories/suggestions_repository_impl.dart';
import 'package:worker_app/features/suggestions/domain/repositories/suggestions_repository.dart';
import 'package:worker_app/features/suggestions/domain/usecases/get_suggestions.dart';
import 'package:worker_app/features/suggestions/domain/usecases/submit_suggestion.dart';
import 'package:worker_app/features/suggestions/domain/usecases/vote_suggestion.dart';
import 'package:worker_app/features/suggestions/presentation/bloc/suggestions_cubit.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';

/// Global service locator.
final getIt = GetIt.instance;

/// Barcha bog'liqliklarni ro'yxatdan o'tkazish.
Future<void> configureDependencies() async {
  final prefs = await SharedPreferences.getInstance();
  getIt
    // ---- External ----
    ..registerSingleton<SharedPreferences>(prefs)
    ..registerLazySingleton<DioClient>(DioClient.new)
    // ---- Doimiy lokatsiya kuzatuvi (xodim -> backend /locations) ----
    // Uzluksiz GPS hisobotlari + offline outbox. Auth muvaffaqiyatli
    // bo'lgach `getIt<LocationTrackingService>().start()` chaqiriladi.
    ..registerLazySingleton<LocationTrackingService>(
      () => LocationTrackingService(getIt<DioClient>().dio),
    )
    ..registerLazySingleton<FlutterSecureStorage>(
      () => const FlutterSecureStorage(),
    )
    // `NotificationService` — HAQIQIY on-device mahalliy bildirishnomalar
    // (`flutter_local_notifications` ustidan yupqa qatlam). Lazy singleton:
    // butun ilova davomida BITTA plagin instansiyasi (`init()` bir marta,
    // `bootstrap()`da) kifoya.
    ..registerLazySingleton<NotificationService>(NotificationService.new)
    // ---- App-level cubits (theme + locale) ----
    ..registerFactory<ThemeCubit>(ThemeCubit.new)
    ..registerFactory<LocaleCubit>(LocaleCubit.new)
    // ---- Router ----
    ..registerLazySingleton<AppRouter>(AppRouter.new)
    // ---- Auth (Mock/Api seam — AppConfig.useMock tanlaydi) ----
    ..registerLazySingleton<AuthRemoteDataSource>(
      () => AppConfig.useMock
          ? AuthRemoteDataSourceMockImpl()
          : AuthApiImpl(getIt<DioClient>()),
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
    // `registerLazySingleton` (FACTORY EMAS, Vazifa 18): `AppRouter`
    // (`redirect`/`refreshListenable`) va ilova ildizidagi `BlocProvider`
    // (`app.dart`) ikkalasi ham `getIt<AuthCubit>()` chaqiradi — agar
    // factory bo'lganida ikkalasi IKKI XIL instansiya olar edi va router
    // hech qachon widget daraxti ko'rayotgan haqiqiy auth holatini
    // ko'rmagan bo'lardi (redirect doim eskirgan/boshlang'ich holatga
    // asoslanib qolardi). Butun ilova davomida BITTA instansiya kerak.
    ..registerLazySingleton<AuthCubit>(
      () => AuthCubit(
        sendOtp: getIt<SendOtp>(),
        verifyOtp: getIt<VerifyOtp>(),
        restoreSession: getIt<RestoreSession>(),
      ),
    )
    // ---- Face (Vazifa 13: xavfsiz saqlash + enroll/verify) ----
    ..registerLazySingleton<FaceLocalDataSource>(
      () => FaceLocalDataSourceImpl(getIt<FlutterSecureStorage>()),
    )
    // `FaceRemoteDataSource` — enrollmentda hisoblangan embeddingni
    // backendga yuklash uchun (Mock/Api seam — boshqa modullar bilan bir
    // xil naqsh). Mock implementatsiya no-op (backend umuman yo'q); real
    // (`useMock == false`) rejimda `FaceRepositoryImpl` uni faqat
    // mahalliy shablon MUVAFFAQIYATLI saqlangandan keyin, best-effort
    // sifatida chaqiradi (qarang: `FaceRepositoryImpl._syncToBackend`).
    ..registerLazySingleton<FaceRemoteDataSource>(
      () => AppConfig.useMock
          ? FaceRemoteDataSourceMockImpl()
          : FaceRemoteDataSourceApiImpl(getIt<DioClient>()),
    )
    ..registerLazySingleton<FaceRepository>(
      () => FaceRepositoryImpl(
        local: getIt<FaceLocalDataSource>(),
        remote: getIt<FaceRemoteDataSource>(),
      ),
    )
    ..registerLazySingleton<EnrollFace>(
      () => EnrollFace(getIt<FaceRepository>()),
    )
    ..registerLazySingleton<VerifyFace>(
      () => VerifyFace(getIt<FaceRepository>()),
    )
    // `FaceEmbedder` — UI/controller qatlami (Vazifa 16/17) kamera
    // kadrlaridan probe embedding hisoblash uchun ishlatadi. Repository
    // bu klassga bog'liq emas (probe allaqachon hisoblangan holda keladi).
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
    // ---- Attendance (Vazifa 15: geofence-gated self check-in) ----
    // `FaceCubit` (Vazifa 17: liveness check-in) `CheckIn`/`GeofenceService`ga
    // bog'liq bo'lgani uchun bu blok `FaceCubit` ro'yxatidan OLDIN turadi.
    ..registerLazySingleton<GeofenceService>(GeofenceService.new)
    ..registerLazySingleton<AttendanceRemoteDataSource>(
      () => AppConfig.useMock
          ? AttendanceRemoteDataSourceMockImpl()
          : AttendanceRemoteDataSourceApiImpl(getIt<DioClient>()),
    )
    ..registerLazySingleton<AttendanceRepository>(
      () =>
          AttendanceRepositoryImpl(remote: getIt<AttendanceRemoteDataSource>()),
    )
    ..registerLazySingleton<CheckIn>(
      () => CheckIn(getIt<AttendanceRepository>(), getIt<GeofenceService>()),
    )
    ..registerLazySingleton<CheckOut>(
      () => CheckOut(getIt<AttendanceRepository>(), getIt<GeofenceService>()),
    )
    ..registerLazySingleton<GetMyAttendance>(
      () => GetMyAttendance(getIt<AttendanceRepository>()),
    )
    // `AttendanceCubit` (Vazifa 18: bosh sahifa/davomat dashboard) —
    // router'ning "home" branchida yaratiladi (`getIt<AttendanceCubit>()`).
    // Factory: `StatefulShellRoute.indexedStack` tab holatini
    // (`IndexedStack`) o'zi saqlagani uchun amalda ilova davomida faqat
    // BIR MARTA yaratiladi — alohida instansiyalarga ehtiyoj yo'q, lekin
    // (masalan testlarda) qayta ishlatilishi shart ham emas.
    ..registerFactory<AttendanceCubit>(
      () => AttendanceCubit(
        repository: getIt<AttendanceRepository>(),
        geofence: getIt<GeofenceService>(),
      ),
    )
    // `FaceCubit` — sahifa ochilganda joriy sessiyaning `workerId`si bilan
    // yaratiladi: `getIt<FaceCubit>(param1: workerId)`. Bitta factory
    // ENROLL (Vazifa 16) va CHECK-IN (Vazifa 17) sahifalari uchun ham
    // ishlatiladi — rejimni sahifa o'zi tanlaydi (`startCamera()` vs
    // `startLiveness()` + `startCamera()`).
    ..registerFactoryParam<FaceCubit, String, void>(
      (workerId, _) => FaceCubit(
        detector: getIt<FaceDetectorService>(),
        embedder: getIt<FaceEmbedder>(),
        enrollFace: getIt<EnrollFace>(),
        verifyFace: getIt<VerifyFace>(),
        checkIn: getIt<CheckIn>(),
        geofence: getIt<GeofenceService>(),
        workerId: workerId,
        facePhotoStore: getIt<FacePhotoStore>(),
        // Ataylab sekinroq (~3s) skaner: yuz ramkada barqaror ushlanib
        // turgan holda progress yoyi 3 soniyada to'ladi — "tez o'qib
        // qo'yish" o'rniga ishonchli, bosqichma-bosqich skaner hissi.
        stableDuration: kFaceScanStableDuration,
      ),
    )
    // ---- Map/Xarita (hudud kuzatuvi: jonli joylashuv + breadcrumb + geofence) ----
    // `MapCubit` — router'ning "map" shell branchida yaratiladi
    // (`AttendanceCubit`/`RequestsCubit` bilan bir xil naqsh): factory,
    // chunki `StatefulShellRoute.indexedStack` branch holatini o'zi
    // saqlaydi — amalda ilova davomida faqat BIR MARTA yaratiladi.
    // Mavjud `GeofenceService` singletonini qayta ishlatadi (Vazifa 15) —
    // geofence matematikasi ikki marta amalga oshirilmaydi.
    ..registerFactory<MapCubit>(
      () => MapCubit(geofence: getIt<GeofenceService>()),
    )
    // ---- Requests/Arizalar (fuqarolar murojaatlari) ----
    ..registerLazySingleton<ApplicationsRemoteDataSource>(
      () => AppConfig.useMock
          ? ApplicationsRemoteDataSourceMockImpl()
          : ApplicationsRemoteDataSourceApiImpl(getIt<DioClient>()),
    )
    ..registerLazySingleton<ApplicationsRepository>(
      () => ApplicationsRepositoryImpl(
        remote: getIt<ApplicationsRemoteDataSource>(),
      ),
    )
    ..registerLazySingleton<GetApplications>(
      () => GetApplications(getIt<ApplicationsRepository>()),
    )
    ..registerLazySingleton<GetApplication>(
      () => GetApplication(getIt<ApplicationsRepository>()),
    )
    ..registerLazySingleton<RespondApplication>(
      () => RespondApplication(getIt<ApplicationsRepository>()),
    )
    ..registerLazySingleton<RateApplication>(
      () => RateApplication(getIt<ApplicationsRepository>()),
    )
    // `RequestsCubit` — router'ning "requests" shell branchida yaratiladi
    // (`AttendanceCubit` bilan bir xil naqsh): factory, chunki
    // `StatefulShellRoute.indexedStack` branch holatini o'zi saqlaydi —
    // amalda ilova davomida faqat BIR MARTA yaratiladi.
    ..registerFactory<RequestsCubit>(
      () => RequestsCubit(repository: getIt<ApplicationsRepository>()),
    )
    // `RequestDetailCubit` — har bir `/requests/:id` ochilishida YANGI
    // instansiya (factory): oldingi murojaatning holati (submitting/
    // yuklangan ma'lumot) keyingisiga "sizib qolmasligi" kerak.
    ..registerFactory<RequestDetailCubit>(
      () => RequestDetailCubit(
        getApplication: getIt<GetApplication>(),
        respondApplication: getIt<RespondApplication>(),
        rateApplication: getIt<RateApplication>(),
      ),
    )
    // ---- Chat/Xabarlar (Mock/Api seam — AppConfig.useMock tanlaydi) ----
    ..registerLazySingleton<ChatRemoteDataSource>(
      () => AppConfig.useMock
          ? ChatRemoteDataSourceMockImpl()
          : ChatRemoteDataSourceApiImpl(getIt<DioClient>()),
    )
    ..registerLazySingleton<ChatRepository>(
      () => ChatRepositoryImpl(remote: getIt<ChatRemoteDataSource>()),
    )
    ..registerLazySingleton<GetConversations>(
      () => GetConversations(getIt<ChatRepository>()),
    )
    ..registerLazySingleton<GetMessages>(
      () => GetMessages(getIt<ChatRepository>()),
    )
    ..registerLazySingleton<SendMessage>(
      () => SendMessage(getIt<ChatRepository>()),
    )
    // `ChatListCubit` — router'ning "chat" shell branchida yaratiladi
    // (`RequestsCubit`/`AttendanceCubit` bilan bir xil naqsh): factory,
    // chunki `StatefulShellRoute.indexedStack` branch holatini o'zi
    // saqlaydi — amalda ilova davomida faqat BIR MARTA yaratiladi.
    ..registerFactory<ChatListCubit>(
      () => ChatListCubit(getConversations: getIt<GetConversations>()),
    )
    // `ConversationCubit` — har bir `/chat/:id` ochilishida YANGI
    // instansiya (factory): oldingi suhbatning holati (yuklangan
    // xabarlar/optimistik qo'shilgan xabar) keyingisiga "sizib
    // qolmasligi" kerak (`RequestDetailCubit` bilan bir xil naqsh).
    ..registerFactory<ConversationCubit>(
      () => ConversationCubit(
        getMessages: getIt<GetMessages>(),
        sendMessage: getIt<SendMessage>(),
      ),
    )
    // ---- Majlislar/Meetings (Zoom-uslubidagi ichki yig'ilishlar) ----
    ..registerLazySingleton<MeetingsRemoteDataSource>(
      () => AppConfig.useMock
          ? MeetingsRemoteDataSourceMockImpl()
          : MeetingsRemoteDataSourceApiImpl(getIt<DioClient>()),
    )
    ..registerLazySingleton<MeetingsRepository>(
      () => MeetingsRepositoryImpl(remote: getIt<MeetingsRemoteDataSource>()),
    )
    ..registerLazySingleton<GetMeetings>(
      () => GetMeetings(getIt<MeetingsRepository>()),
    )
    ..registerLazySingleton<GetMeeting>(
      () => GetMeeting(getIt<MeetingsRepository>()),
    )
    ..registerLazySingleton<JoinMeeting>(
      () => JoinMeeting(getIt<MeetingsRepository>()),
    )
    // `MeetingsCubit` — `/meetings` marshrutida yaratiladi (`RequestsCubit`
    // bilan bir xil naqsh): har PUSH'da yangi instansiya (factory) — ro'yxat
    // shell tabi EMAS, holat saqlanishi shart emas.
    ..registerFactory<MeetingsCubit>(
      () => MeetingsCubit(getMeetings: getIt<GetMeetings>()),
    )
    // `MeetingDetailCubit` — har bir `/meetings/:id` ochilishida YANGI
    // instansiya (factory): oldingi majlisning holati (joining/yuklangan
    // ma'lumot) keyingisiga "sizib qolmasligi" kerak (`RequestDetailCubit`
    // bilan bir xil naqsh).
    ..registerFactory<MeetingDetailCubit>(
      () => MeetingDetailCubit(
        getMeeting: getIt<GetMeeting>(),
        joinMeeting: getIt<JoinMeeting>(),
      ),
    )
    // ---- Ball nazorati/Points (xodim ball tarixi) ----
    ..registerLazySingleton<PointsRemoteDataSource>(
      () => AppConfig.useMock
          ? PointsRemoteDataSourceMockImpl()
          : PointsRemoteDataSourceApiImpl(getIt<DioClient>()),
    )
    ..registerLazySingleton<PointsRepository>(
      () => PointsRepositoryImpl(remote: getIt<PointsRemoteDataSource>()),
    )
    ..registerLazySingleton<GetCurrentPoints>(
      () => GetCurrentPoints(getIt<PointsRepository>()),
    )
    // `GetPointsHistory` — `PointsRepository`ning bir qismi sifatida
    // ro'yxatdan o'tkaziladi (kelajakda alohida "to'liq tarix" sahifasi
    // uchun). `PointsPage` hozircha faqat `GetCurrentPoints`ni ishlatadi —
    // uning natijasi (`WorkerPoints`) allaqachon to'liq tarixni o'z ichiga
    // oladi (qarang: `PointsCubit` hujjati), shuning uchun bitta so'rov
    // yetarli.
    ..registerLazySingleton<GetPointsHistory>(
      () => GetPointsHistory(getIt<PointsRepository>()),
    )
    // `PointsCubit` — `/points` marshrutida yaratiladi (`MeetingsCubit`
    // bilan bir xil naqsh): har PUSH'da yangi instansiya (factory).
    ..registerFactory<PointsCubit>(
      () => PointsCubit(getCurrentPoints: getIt<GetCurrentPoints>()),
    )
    // ---- Takliflar/Suggestions (ratsionalizatorlik g'oyalari) ----
    ..registerLazySingleton<SuggestionsRemoteDataSource>(
      () => AppConfig.useMock
          ? SuggestionsRemoteDataSourceMockImpl()
          : SuggestionsRemoteDataSourceApiImpl(getIt<DioClient>()),
    )
    ..registerLazySingleton<SuggestionsRepository>(
      () => SuggestionsRepositoryImpl(
        remote: getIt<SuggestionsRemoteDataSource>(),
      ),
    )
    ..registerLazySingleton<GetSuggestions>(
      () => GetSuggestions(getIt<SuggestionsRepository>()),
    )
    ..registerLazySingleton<SubmitSuggestion>(
      () => SubmitSuggestion(getIt<SuggestionsRepository>()),
    )
    ..registerLazySingleton<VoteSuggestion>(
      () => VoteSuggestion(getIt<SuggestionsRepository>()),
    )
    // `SuggestionsCubit` — `/suggestions` marshrutida yaratiladi
    // (`MeetingsCubit` bilan bir xil naqsh): har PUSH'da yangi instansiya
    // (factory).
    ..registerFactory<SuggestionsCubit>(
      () => SuggestionsCubit(
        getSuggestions: getIt<GetSuggestions>(),
        voteSuggestion: getIt<VoteSuggestion>(),
      ),
    )
    // ---- Bildirishnomalar/Notifications (Mock/Api seam — AppConfig.useMock) ----
    ..registerLazySingleton<NotificationsRemoteDataSource>(
      () => AppConfig.useMock
          ? NotificationsRemoteDataSourceMockImpl()
          : NotificationsRemoteDataSourceApiImpl(getIt<DioClient>()),
    )
    ..registerLazySingleton<NotificationsRepository>(
      () => NotificationsRepositoryImpl(
        remote: getIt<NotificationsRemoteDataSource>(),
      ),
    )
    // `HomeCubit` (user-app) bilan bir xil naqsh: LAZY SINGLETON (factory
    // EMAS) — bosh sahifadagi qo'ng'iroq belgisi VA `/notifications`
    // sahifasi XUDDI SHU instansiyani (va uning unread-sonini) ko'rishi
    // kerak.
    ..registerLazySingleton<NotificationsCubit>(
      () => NotificationsCubit(
        repository: getIt<NotificationsRepository>(),
        authCubit: getIt<AuthCubit>(),
      ),
    );
}
