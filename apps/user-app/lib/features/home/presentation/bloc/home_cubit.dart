import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/cache/cache_service.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/usecases/get_utilities.dart';
import 'package:user_app/injection.dart';

part 'home_state.dart';

/// Fuqaro bosh sahifasi (dashboard)ini boshqaruvchi Cubit.
///
/// Umumiy "jami qarz" kartasi va tezkor xizmatlar uchun
/// `PaymentsRepository.utilities()`dan kelgan ro'yxatga tayanadi — to'liq
/// kommunal xizmatlar ro'yxati esa `UtilitiesCubit` orqali alohida
/// yuklanadi (bir xil ma'lumot, ikki mustaqil ekran/holat).
///
/// **Cache-then-network**: [load] avval `CacheService`dagi oxirgi
/// ro'yxatni (bo'lsa) DARHOL ko'rsatadi (hech qanday skeleton'siz), so'ng
/// fonda tarmoqdan yangisini so'raydi va kelgach holatni/keshni yangilaydi.
/// Kesh mavjud bo'lib tarmoq muvaffaqiyatsiz bo'lsa — eski (kesh)
/// ma'lumot ekranda QOLDIRILADI (xato faqat log qilinadi), foydalanuvchi
/// keraksiz "xatolik" ekranini ko'rmaydi.
class HomeCubit extends Cubit<HomeState> {
  HomeCubit({required GetUtilities getUtilities, CacheService? cache})
    : _getUtilities = getUtilities,
      _cache =
          cache ??
          (getIt.isRegistered<CacheService>()
              ? getIt<CacheService>()
              : null),
      super(const HomeLoading());

  final GetUtilities _getUtilities;
  final CacheService? _cache;
  static const _logger = AppLogger();

  /// Kommunal xizmatlar ro'yxatini yuklaydi (yoki qayta yuklaydi — masalan
  /// pull-to-refresh yoki muvaffaqiyatli to'lovdan keyin).
  Future<void> load() async {
    final cached = _cache?.getJsonList<Utility>(
      Utility.cacheKey,
      Utility.fromJson,
    );
    if (cached != null && cached.isNotEmpty) {
      emit(HomeLoaded(cached));
    } else {
      emit(const HomeLoading());
    }

    final result = await _getUtilities(const NoParams());
    result.fold(
      (failure) {
        if (cached != null && cached.isNotEmpty) {
          // Eski (kesh) ma'lumot allaqachon ekranda — foydalanuvchini
          // keraksiz xato ekraniga tashlamaymiz, faqat diagnostika uchun
          // log qilamiz.
          _logger.logError(failure, null, reason: 'HomeCubit.load');
        } else {
          emit(HomeError(failure.message));
        }
      },
      (utilities) {
        unawaited(
          _cache?.setJson(
            Utility.cacheKey,
            utilities.map((u) => u.toJson()).toList(),
          ),
        );
        emit(
          utilities.isEmpty ? const HomeEmpty() : HomeLoaded(utilities),
        );
      },
    );
  }
}
