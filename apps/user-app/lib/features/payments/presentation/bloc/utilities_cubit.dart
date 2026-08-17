import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/cache/cache_service.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/usecases/get_utilities.dart';
import 'package:user_app/injection.dart';

part 'utilities_state.dart';

/// "Kommunalka" (To'lovlar tabi) sahifasini boshqaruvchi Cubit.
///
/// **Cache-then-network**: [load] avval `CacheService`dagi oxirgi
/// ro'yxatni (bo'lsa) DARHOL ko'rsatadi (skeleton'siz), so'ng fonda
/// tarmoqdan yangisini so'raydi. Kesh mavjud bo'lib tarmoq muvaffaqiyatsiz
/// bo'lsa — eski (kesh) ro'yxat ekranda QOLDIRILADI, xato faqat log
/// qilinadi.
class UtilitiesCubit extends Cubit<UtilitiesState> {
  UtilitiesCubit({required GetUtilities getUtilities, CacheService? cache})
    : _getUtilities = getUtilities,
      _cache =
          cache ??
          (getIt.isRegistered<CacheService>()
              ? getIt<CacheService>()
              : null),
      super(const UtilitiesLoading());

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
      emit(UtilitiesLoaded(cached));
    } else {
      emit(const UtilitiesLoading());
    }

    final result = await _getUtilities(const NoParams());
    result.fold(
      (failure) {
        if (cached != null && cached.isNotEmpty) {
          _logger.logError(failure, null, reason: 'UtilitiesCubit.load');
        } else {
          emit(UtilitiesError(failure.message));
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
          utilities.isEmpty
              ? const UtilitiesEmpty()
              : UtilitiesLoaded(utilities),
        );
      },
    );
  }
}
