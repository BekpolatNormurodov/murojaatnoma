import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:user_app/core/cache/cache_service.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_requests.dart';

part 'requests_state.dart';

/// "Murojaatlarim" (Arizalar tabi) ro'yxat sahifasini boshqaruvchi Cubit.
///
/// Joriy filtrlarni (`kind`/`status`/`query`) ichida saqlaydi — shu
/// tufayli [reload] (pull-to-refresh, "Qayta urinish" yoki detail/yuborish
/// sahifasidan qaytgach) parametrsiz chaqirilib, so'nggi ishlatilgan
/// filtrlar bilan qayta so'rov yuboradi.
///
/// "Cache-then-network": [load] avval [CacheService]dagi so'nggi
/// muvaffaqiyatli ro'yxatni (agar mos kelsa — [query] bo'sh bo'lganda,
/// `kind`+`status` bo'yicha) DARHOL ko'rsatadi (fon yangilanish bayrog'i
/// bilan — [RequestsLoaded.isRefreshing]), so'ng tarmoqdan yangisini olib
/// keshni yangilaydi. Kesh `SharedPreferences` orqali saqlangani uchun
/// ilova butunlay qayta ishga tushirilgandan keyin ham darhol (bo'sh
/// skeleton'siz) so'nggi ma'lumotni ko'rsatishga imkon beradi.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [RequestsError] holatiga aylanadi (agar keshlangan zaxira ma'lumot
/// bo'lmasa — bo'lsa, eski ro'yxat saqlanib qoladi, faqat xatolik
/// [AppLogger] orqali qayd etiladi).
class RequestsCubit extends Cubit<RequestsState> {
  RequestsCubit({
    required GetCitizenRequests getCitizenRequests,
    CacheService? cache,
    AppLogger? logger,
  }) : _getCitizenRequests = getCitizenRequests,
       _cache = cache ?? _resolveCache(),
       _logger = logger ?? const AppLogger(),
       super(const RequestsLoading());

  final GetCitizenRequests _getCitizenRequests;

  /// `null` bo'lishi mumkin — masalan `CacheService` ro'yxatdan
  /// o'tkazilmagan test/host muhitida (`GetIt.isRegistered` orqali
  /// xavfsiz tekshiriladi, hech qachon `throw` qilmaydi). `null` bo'lsa
  /// [load] shunchaki keshsiz — to'g'ridan-to'g'ri tarmoq — rejimida
  /// ishlaydi (avvalgi xatti-harakat bilan bir xil).
  final CacheService? _cache;
  final AppLogger _logger;

  static const _cachePrefix = 'requests_cache_v1';

  /// [GetIt.instance]dan [CacheService]ni XAVFSIZ oladi — agar ro'yxatdan
  /// o'tkazilmagan bo'lsa (masalan unit test'da GetIt sozlanmagan) `throw`
  /// qilish o'rniga `null` qaytaradi.
  static CacheService? _resolveCache() {
    final it = GetIt.instance;
    return it.isRegistered<CacheService>() ? it<CacheService>() : null;
  }

  RequestKind _kind = RequestKind.ariza;
  RequestStatus? _status;
  String? _query;

  RequestKind get kind => _kind;
  RequestStatus? get statusFilter => _status;
  String? get query => _query;

  /// `true` bo'lsa holat filtri tanlangan — filtr tugmasining faol-holat
  /// ko'rsatkichi uchun.
  bool get hasActiveFilters => _status != null;

  /// Faqat asosiy (qidiruvsiz) ro'yxat holati keshlanadi — erkin qidiruv
  /// natijalarini har bir bosilgan harf uchun diskka yozish shart emas
  /// (vaqtinchalik, "restart'dan keyin ham kerak" emas).
  String? _cacheKeyFor({
    required RequestKind kind,
    required RequestStatus? status,
    required String? query,
  }) {
    if (query != null && query.trim().isNotEmpty) return null;
    return '$_cachePrefix::${kind.name}::${status?.name ?? 'all'}';
  }

  /// Murojaatlar ro'yxatini (berilgan filtrlar bilan) yuklaydi.
  ///
  /// Mos keshlangan ro'yxat topilsa — darhol shu ro'yxat bilan
  /// [RequestsLoaded] (`isRefreshing: true`) emit qilinadi (hech qachon
  /// bo'sh/oq ekran ko'rinmaydi), so'ng tarmoq so'rovi fon rejimida davom
  /// etadi. Kesh topilmasa — avvalgidek [RequestsLoading] bilan boshlanadi.
  Future<void> load({
    required RequestKind kind,
    RequestStatus? status,
    String? query,
  }) async {
    _kind = kind;
    _status = status;
    _query = query;

    final cache = _cache;
    final cacheKey = cache == null
        ? null
        : _cacheKeyFor(kind: kind, status: status, query: query);
    final cached = cache == null || cacheKey == null
        ? null
        : cache.getJsonList<CitizenRequest>(cacheKey, CitizenRequest.fromJson);

    if (cached != null && cached.isNotEmpty) {
      emit(RequestsLoaded(cached, isRefreshing: true));
    } else {
      emit(const RequestsLoading());
    }

    try {
      final result = await _getCitizenRequests(
        GetCitizenRequestsParams(kind: kind, status: status, query: query),
      );
      await result.fold(
        (failure) async {
          _logger.logError(
            failure,
            StackTrace.current,
            reason: 'RequestsCubit.load',
          );
          // Kesh bo'lsa — foydalanuvchi hech narsani yo'qotmaydi: eski
          // ro'yxat ko'rinishda qoladi, faqat "yangilanmoqda" ko'rsatkichi
          // o'chadi. Kesh bo'lmasagina to'liq xato holatiga o'tiladi.
          if (cached != null && cached.isNotEmpty) {
            emit(RequestsLoaded(cached));
          } else {
            emit(RequestsError(failure.message));
          }
        },
        (items) async {
          if (cache != null && cacheKey != null) {
            await cache.setJson(
              cacheKey,
              items.map((r) => r.toJson()).toList(),
            );
          }
          emit(items.isEmpty ? const RequestsEmpty() : RequestsLoaded(items));
        },
      );
    } on Object catch (e, stackTrace) {
      _logger.logError(e, stackTrace, reason: 'RequestsCubit.load');
      if (cached != null && cached.isNotEmpty) {
        emit(RequestsLoaded(cached));
      } else {
        emit(RequestsError('Kutilmagan xatolik: $e'));
      }
    }
  }

  /// So'nggi ishlatilgan filtrlar bilan qayta yuklaydi (pull-to-refresh,
  /// "Qayta urinish" tugmasi, yoki detail/yuborish sahifasidan qaytgach —
  /// u yerda yangi murojaat ro'yxatga ta'sir qilgan bo'lishi mumkin).
  Future<void> reload() => load(kind: _kind, status: _status, query: _query);
}
