import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/app/router/go_router_refresh_stream.dart';
import 'package:worker_app/app/router/redirect_policy.dart';
import 'package:worker_app/app/shell/main_shell.dart';
import 'package:worker_app/features/attendance/presentation/bloc/attendance_cubit.dart';
import 'package:worker_app/features/attendance/presentation/pages/home_page.dart';
import 'package:worker_app/features/attendance/presentation/pages/work_schedule_page.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/auth/presentation/pages/login_page.dart';
import 'package:worker_app/features/auth/presentation/pages/otp_page.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/presentation/bloc/chat_list_cubit.dart';
import 'package:worker_app/features/chat/presentation/bloc/conversation_cubit.dart';
import 'package:worker_app/features/chat/presentation/pages/chat_page.dart';
import 'package:worker_app/features/chat/presentation/pages/conversation_page.dart';
import 'package:worker_app/features/face/domain/entities/attendance_scan_kind.dart';
import 'package:worker_app/features/face/presentation/bloc/face_cubit.dart';
import 'package:worker_app/features/face/presentation/pages/face_checkin_page.dart';
import 'package:worker_app/features/face/presentation/pages/face_enroll_page.dart';
import 'package:worker_app/features/leave/presentation/pages/leave_request_page.dart';
import 'package:worker_app/features/map/presentation/bloc/map_cubit.dart';
import 'package:worker_app/features/map/presentation/pages/map_page.dart';
import 'package:worker_app/features/meetings/presentation/bloc/meeting_detail_cubit.dart';
import 'package:worker_app/features/meetings/presentation/bloc/meetings_cubit.dart';
import 'package:worker_app/features/meetings/presentation/pages/meeting_detail_page.dart';
import 'package:worker_app/features/meetings/presentation/pages/meetings_page.dart';
import 'package:worker_app/features/documents/presentation/bloc/document_detail_cubit.dart';
import 'package:worker_app/features/documents/presentation/bloc/documents_cubit.dart';
import 'package:worker_app/features/documents/presentation/pages/document_detail_page.dart';
import 'package:worker_app/features/documents/presentation/pages/documents_page.dart';
import 'package:worker_app/features/news/presentation/bloc/news_cubit.dart';
import 'package:worker_app/features/news/presentation/bloc/news_detail_cubit.dart';
import 'package:worker_app/features/news/presentation/pages/news_detail_page.dart';
import 'package:worker_app/features/news/presentation/pages/news_page.dart';
import 'package:worker_app/features/notifications/presentation/pages/notifications_page.dart';
import 'package:worker_app/features/points/presentation/bloc/points_cubit.dart';
import 'package:worker_app/features/points/presentation/pages/points_page.dart';
import 'package:worker_app/features/premya/presentation/pages/premya_request_page.dart';
import 'package:worker_app/features/profile/presentation/pages/profile_page.dart';
import 'package:worker_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:worker_app/features/requests/presentation/bloc/requests_cubit.dart';
import 'package:worker_app/features/requests/presentation/pages/request_detail_page.dart';
import 'package:worker_app/features/requests/presentation/pages/request_respond_page.dart';
import 'package:worker_app/features/requests/presentation/pages/requests_page.dart';
import 'package:worker_app/features/suggestions/presentation/bloc/suggestions_cubit.dart';
import 'package:worker_app/features/suggestions/presentation/pages/submit_suggestion_page.dart';
import 'package:worker_app/features/suggestions/presentation/pages/suggestions_page.dart';
import 'package:worker_app/injection.dart';

/// Ilovaning to'liq routeri (Vazifa 18).
///
/// Uch ustunga qurilgan:
/// - **Redirect** — `resolveAuthRedirect` (sof, to'liq unit-testlangan —
///   qarang: `redirect_policy.dart`) auth/face-enrollment holatiga qarab
///   splash→login→otp→face→home oqimini boshqaradi.
/// - **`refreshListenable`** —
///   `GoRouterRefreshStream(getIt<AuthCubit>().stream)`: `AuthCubit`
///   holati o'zgarganda (masalan OTP tasdiqlangach yoki yuz
///   ro'yxatdan o'tkazilgach) GoRouter buni AVTOMATIK biladi va joriy
///   manzil uchun `redirect`ni qayta baholaydi — sahifalar o'zi qo'lda
///   `context.go(...)` qilishi SHART emas.
/// - **`StatefulShellRoute.indexedStack`** — 5 tabli asosiy qobiq
///   (`MainShell`), har bir tab holati saqlangan holda.
class AppRouter {
  AppRouter() {
    // `AuthCubit` `injection.dart`da `registerLazySingleton` — shu tufayli
    // bu yerdagi `getIt<AuthCubit>()` ilova ildizida `BlocProvider` orqali
    // widget daraxtiga beriladigan XUDDI SHU instansiyani qaytaradi (agar
    // `registerFactory` bo'lganida ikkalasi ikki xil instansiya bo'lib
    // qolar edi — router hech qachon haqiqiy auth o'zgarishlarini
    // ko'rmagan bo'lardi).
    _refresh = GoRouterRefreshStream(getIt<AuthCubit>().stream);
    _router = GoRouter(
      initialLocation: '/splash',
      refreshListenable: _refresh,
      redirect: (context, state) => resolveAuthRedirect(
        authState: context.read<AuthCubit>().state,
        location: state.matchedLocation,
      ),
      errorBuilder: (context, state) => Scaffold(
        body: SafeArea(
          child: EmptyState(
            icon: AppIcons.close,
            title: context.l10n.routeNotFoundTitle,
            message: context.l10n.routeNotFoundMessage,
          ),
        ),
      ),
      routes: [
        GoRoute(
          path: '/splash',
          builder: (context, _) => BrandSplash(
            tagline: context.l10n.splashTagline,
            // Doim shu YAGONA manzilga "urinadi" — HAQIQIY manzil
            // (`/login`, `/face/enroll` yoki `/home`) yuqoridagi
            // `redirect` orqali hal qilinadi (qarang: `resolveAuthRedirect`
            // hujjatidagi splash izohi). Shu tufayli bu yerda `AuthCubit`
            // holatini oldindan o'qishning hojati yo'q.
            onFinished: () => context.go('/home'),
          ),
        ),
        GoRoute(
          path: '/login',
          builder: (context, _) => const LoginPage(),
        ),
        GoRoute(
          path: '/otp',
          builder: (context, state) =>
              OtpPage(phone: state.extra as String? ?? ''),
        ),
        GoRoute(
          path: '/face/enroll',
          builder: (context, _) {
            final workerId =
                context.read<AuthCubit>().state.session?.workerId ?? '';
            return BlocProvider(
              create: (_) => getIt<FaceCubit>(param1: workerId),
              child: const FaceEnrollPage(),
            );
          },
        ),
        GoRoute(
          path: '/face/checkin',
          builder: (context, _) {
            final workerId =
                context.read<AuthCubit>().state.session?.workerId ?? '';
            return BlocProvider(
              create: (_) => getIt<FaceCubit>(param1: workerId),
              child: const FaceCheckinPage(),
            );
          },
        ),
        // `/face/checkout` — Vazifa 19: ish kunini yakunlash ("ketdi")
        // oqimi. `/face/checkin` bilan BIR XIL sahifa/cubit infratuzilmasi
        // (`FaceCheckinPage`/`FaceCubit`) qayta ishlatiladi — faqat
        // `kind: AttendanceScanKind.checkOut` uzatiladi, shu orqali sahifa
        // "Ishdan chiqish" sarlavhasini ko'rsatadi va `FaceCubit`
        // `_afterMatch`da `CheckIn` o'rniga `CheckOut` chaqiradi.
        GoRoute(
          path: '/face/checkout',
          builder: (context, _) {
            final workerId =
                context.read<AuthCubit>().state.session?.workerId ?? '';
            return BlocProvider(
              create: (_) => getIt<FaceCubit>(param1: workerId),
              child: const FaceCheckinPage(kind: AttendanceScanKind.checkOut),
            );
          },
        ),
        // `/requests/:id` — ro'yxatdan PUSH qilinadigan to'liq ekranli
        // murojaatni QAYTA ISHLASH (ishlov berish) sahifasi (`/face/*`
        // bilan bir xil naqsh): shell darajasidan TASHQARIDA, shuning
        // uchun ochilganda pastki navigatsiya paneli yashiriladi. Xodim
        // faqat MAVJUD (kelgan/biriktirilgan) murojaatlarni shu yerda
        // ko'radi/javob beradi — yangi murojaat YARATISH/YUBORISH oqimi
        // ataylab YO'Q (buni faqat fuqaro, `user-app` orqali, qiladi).
        GoRoute(
          path: '/requests/:id',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return BlocProvider(
              create: (_) => getIt<RequestDetailCubit>()..load(id),
              child: const RequestDetailPage(),
            );
          },
          routes: [
            // `/requests/:id/respond` — tafsilot sahifasidagi "Javob
            // yozish" CTA'sidan PUSH qilinadigan TO'LIQ EKRANLI javob
            // sahifasi (ilgari `showAppSheet`-based pastki varaq edi).
            // `extra` — tafsilot sahifasi allaqachon o'qigan XUDDI SHU
            // `RequestDetailCubit` instansiyasi (`BlocProvider.value`) —
            // shu tufayli javob yozilgandan so'ng ortga qaytilganda
            // tafsilot sahifasi qayta yuklamasdan yangilangan holatni
            // ko'rsatadi (`OtpPage(phone: state.extra ...)` bilan bir xil
            // "extra orqali uzatish" naqshi).
            GoRoute(
              path: 'respond',
              builder: (context, state) {
                final cubit = state.extra as RequestDetailCubit?;
                if (cubit != null) {
                  return BlocProvider.value(
                    value: cubit,
                    child: const RequestRespondPage(),
                  );
                }
                // Himoya: to'g'ridan-to'g'ri chuqur havola (deep link) yoki
                // `extra`siz navigatsiya bo'lsa — murojaatni ID bo'yicha
                // qaytadan yuklaydi (hech qachon qulamaydi).
                final id = state.pathParameters['id']!;
                return BlocProvider(
                  create: (_) => getIt<RequestDetailCubit>()..load(id),
                  child: const RequestRespondPage(),
                );
              },
            ),
          ],
        ),
        // `/chat/:id` — ro'yxatdan PUSH qilinadigan to'liq ekranli suhbat
        // sahifasi (`/requests/:id` bilan bir xil naqsh): shell
        // darajasidan TASHQARIDA, shuning uchun ochilganda pastki
        // navigatsiya paneli yashiriladi. `extra` (bo'lsa) ro'yxat
        // sahifasidan uzatilgan to'liq `Conversation`ni olib keladi
        // (sarlavha panelida ko'rsatish uchun — bitta suhbatni olish
        // uchun alohida usecase shart emas, xuddi `OtpPage(phone:
        // state.extra ...)` naqshiga o'xshab).
        GoRoute(
          path: '/chat/:id',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            final conversation = state.extra as Conversation?;
            return BlocProvider(
              create: (_) => getIt<ConversationCubit>()..open(id),
              child: ConversationPage(
                conversationId: id,
                conversation: conversation,
              ),
            );
          },
        ),
        // `/meetings` va `/meetings/:id` — bosh sahifadagi "Tezkor"
        // tugmalaridan PUSH qilinadigan to'liq ekranli sahifalar
        // (`/requests/:id` bilan bir xil naqsh): shell darajasidan
        // TASHQARIDA, shuning uchun ochilganda pastki navigatsiya paneli
        // yashiriladi.
        GoRoute(
          path: '/meetings',
          builder: (context, _) => BlocProvider(
            create: (_) => getIt<MeetingsCubit>()..load(),
            child: const MeetingsPage(),
          ),
        ),
        GoRoute(
          path: '/meetings/:id',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return BlocProvider(
              create: (_) => getIt<MeetingDetailCubit>()..load(id),
              child: const MeetingDetailPage(),
            );
          },
        ),
        // `/news` va `/news/:id` — profil menyusidan PUSH qilinadigan
        // "Yangiliklar" sahifalari (shell darajasidan TASHQARIDA).
        GoRoute(
          path: '/news',
          builder: (context, _) => BlocProvider(
            create: (_) => getIt<NewsCubit>()..load(),
            child: const NewsPage(),
          ),
        ),
        GoRoute(
          path: '/news/:id',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return BlocProvider(
              create: (_) => getIt<NewsDetailCubit>()..load(id),
              child: const NewsDetailPage(),
            );
          },
        ),
        // `/documents` va `/documents/:id` — profil menyusidan PUSH
        // qilinadigan "Hujjatlar" sahifalari (shell darajasidan TASHQARIDA).
        GoRoute(
          path: '/documents',
          builder: (context, _) => BlocProvider(
            create: (_) => getIt<DocumentsCubit>()..load(),
            child: const DocumentsPage(),
          ),
        ),
        GoRoute(
          path: '/documents/:id',
          builder: (context, state) {
            final id = state.pathParameters['id']!;
            return BlocProvider(
              create: (_) => getIt<DocumentDetailCubit>()..load(id),
              child: const DocumentDetailPage(),
            );
          },
        ),
        // `/points` — bosh sahifadagi "Tezkor" tugmasidan PUSH qilinadigan
        // to'liq ekranli "Ballarim" sahifasi (`/meetings` bilan bir xil
        // naqsh): shell darajasidan TASHQARIDA.
        GoRoute(
          path: '/points',
          builder: (context, _) => BlocProvider(
            create: (_) => getIt<PointsCubit>()..load(),
            child: const PointsPage(),
          ),
        ),
        // `/suggestions` va `/suggestions/create` — bosh sahifadagi
        // "Tezkor" tugmalaridan PUSH qilinadigan to'liq ekranli sahifalar
        // (`/meetings` bilan bir xil naqsh): shell darajasidan TASHQARIDA.
        GoRoute(
          path: '/suggestions',
          builder: (context, _) => BlocProvider(
            create: (_) => getIt<SuggestionsCubit>()..load(),
            child: const SuggestionsPage(),
          ),
        ),
        GoRoute(
          path: '/suggestions/create',
          builder: (context, _) => const SubmitSuggestionPage(),
        ),
        // `/schedule` — bosh sahifadagi ("Bo'limlar" to'ridagi) va profil
        // sahifasidagi "Ish soatlari" qatoridan PUSH qilinadigan to'liq
        // ekranli haftalik ish jadvali sahifasi (`/points` bilan bir xil
        // naqsh): shell darajasidan TASHQARIDA, sof taqdimot — hech qanday
        // Cubit/state kerak emas (statik dizayn ma'lumoti).
        GoRoute(
          path: '/schedule',
          builder: (context, _) => const WorkSchedulePage(),
        ),
        // `/leave-request` — bosh sahifadagi va profil sahifasidagi
        // "Javob so'rash" kirish nuqtalaridan PUSH qilinadigan to'liq
        // ekranli ish vaqtidan ozod bo'lish so'rovi sahifasi (`/schedule`
        // bilan bir xil naqsh): shell darajasidan TASHQARIDA, sof
        // taqdimot — HAQIQIY backend hali yo'q (mock-first, qarang:
        // `LeaveRequestPage`), shuning uchun hech qanday Cubit/repository
        // bog'lanmagan.
        GoRoute(
          path: '/leave-request',
          builder: (context, _) => const LeaveRequestPage(),
        ),
        // `/premya-request` — profil sahifasidagi "Premya so'rash" kirish
        // nuqtasidan PUSH qilinadigan to'liq ekranli mukofot so'rovi sahifasi
        // (`/leave-request` bilan bir xil naqsh, shell'dan tashqarida). Usecase
        // (`SubmitPremya`) `getIt` orqali chaqiriladi — HAQIQIY backend
        // (`POST /premya`, mock/api seam) bilan bog'langan.
        GoRoute(
          path: '/premya-request',
          builder: (context, _) => const PremyaRequestPage(),
        ),
        // `/notifications` — bosh sahifadagi qo'ng'iroq belgisidan PUSH
        // qilinadigan to'liq ekranli sahifa (`/points` bilan bir xil
        // naqsh): shell darajasidan TASHQARIDA. `NotificationsCubit`
        // LAZY SINGLETON (ilova ildizida allaqachon `BlocProvider` orqali
        // ta'minlangan — qarang: `app.dart`), shuning uchun bu yerda
        // qo'shimcha `BlocProvider` shart emas.
        GoRoute(
          path: '/notifications',
          builder: (context, _) => const NotificationsPage(),
        ),
        StatefulShellRoute.indexedStack(
          builder: (context, state, shell) => MainShell(shell: shell),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/home',
                  builder: (context, _) => BlocProvider(
                    create: (_) => getIt<AttendanceCubit>()..load(),
                    child: const HomePage(),
                  ),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/requests',
                  builder: (context, _) => BlocProvider(
                    create: (_) => getIt<RequestsCubit>()..load(),
                    child: const RequestsPage(),
                  ),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/chat',
                  builder: (context, _) => BlocProvider(
                    create: (_) => getIt<ChatListCubit>()..load(),
                    child: const ChatPage(),
                  ),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/map',
                  builder: (context, _) => BlocProvider(
                    create: (_) => getIt<MapCubit>()..start(),
                    child: const MapPage(),
                  ),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/profile',
                  builder: (context, _) => const ProfilePage(),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  late final GoRouterRefreshStream _refresh;
  late final GoRouter _router;

  /// `MaterialApp.router` uchun router konfiguratsiyasi.
  GoRouter get config => _router;
}
