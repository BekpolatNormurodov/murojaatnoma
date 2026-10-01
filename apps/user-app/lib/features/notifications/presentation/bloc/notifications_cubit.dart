import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/cache/cache_service.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/notifications/data/datasources/notifications_mock_data_source.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';
import 'package:user_app/injection.dart';

part 'notifications_state.dart';

/// "Bildirishnomalar" — bosh sahifadagi qo'ng'iroq belgisi (unread-son) va
/// `/notifications` sahifasi XUDDI SHU LAZY SINGLETON instansiyani ko'radi.
///
/// **Cache-then-network**: [load] avval keshdagi oxirgi ro'yxatni darhol
/// ko'rsatadi, so'ng serverdan (`/notifications/citizen`) yangisini oladi.
/// Fuqaroda socket yo'q — shu tufayli [startAutoRefresh] ilova ochiq
/// turganda har daqiqada ro'yxatni fonda yangilaydi (≤100 yozuv).
///
/// Hech qachon uncaught tashlamaydi — kesh bo'sh bo'lsa xato
/// [NotificationsError] holatiga aylanadi.
class NotificationsCubit extends Cubit<NotificationsState> {
  NotificationsCubit({NotificationsDataSource? dataSource, CacheService? cache})
    : _dataSource =
          dataSource ??
          (getIt.isRegistered<NotificationsDataSource>()
              ? getIt<NotificationsDataSource>()
              : NotificationsMockDataSource()),
      _cache =
          cache ??
          (getIt.isRegistered<CacheService>() ? getIt<CacheService>() : null),
      super(const NotificationsLoading());

  final NotificationsDataSource _dataSource;
  final CacheService? _cache;
  Timer? _poll;
  static const _logger = AppLogger();

  /// Joriy o'qilmagan bildirishnomalar soni — holatdan qat'i nazar
  /// (`Loaded` bo'lmasa 0), bosh sahifadagi qo'ng'iroq belgisi uchun.
  int get unreadCount {
    final current = state;
    return current is NotificationsLoaded
        ? current.items.where((n) => !n.read).length
        : 0;
  }

  /// [silent] — ekrandagi ro'yxatni skeleton/keshga qaytarmasdan, fonda
  /// yangilaydi (bosh sahifa ochilganda, avto-yangilashda); xatoda joriy
  /// holat saqlanadi.
  Future<void> load({bool silent = false}) async {
    List<NotificationItem>? cached;
    if (!silent) {
      cached = _cache?.getJsonList<NotificationItem>(
        NotificationItem.cacheKey,
        NotificationItem.fromJson,
      );
      if (cached != null && cached.isNotEmpty) {
        emit(NotificationsLoaded(cached));
      } else {
        emit(const NotificationsLoading());
      }
    }

    try {
      final items = await _dataSource.fetch();
      final sorted = [...items]
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      _persist(sorted);
      if (isClosed) return;
      emit(
        sorted.isEmpty
            ? const NotificationsEmpty()
            : NotificationsLoaded(sorted),
      );
    } on Object catch (e) {
      _logger.logError(e, null, reason: 'NotificationsCubit.load');
      if (silent || isClosed) return;
      if (cached == null || cached.isEmpty) {
        emit(
          NotificationsError(
            e is ServerException ? e.message : "Ma'lumotni yuklab bo'lmadi",
          ),
        );
      }
    }
  }

  /// Har daqiqada (ilova ochiq turganda) yangi bildirishnoma bor-yo'qligini
  /// tekshiradi. Bir necha marta chaqirilsa ham bitta taymer.
  void startAutoRefresh({Duration every = const Duration(minutes: 1)}) {
    _poll ??= Timer.periodic(every, (_) => load(silent: true));
  }

  /// Bitta yozuvni o'qilgan deb belgilaydi — darhol ekranda, keyin serverda.
  void markRead(String id) {
    final current = state;
    if (current is! NotificationsLoaded) return;
    final target = current.items.where((n) => n.id == id).firstOrNull;
    if (target == null || target.read) return;
    final updated = [
      for (final item in current.items)
        if (item.id == id) item.copyWith(read: true) else item,
    ];
    _persist(updated);
    emit(NotificationsLoaded(updated));
    unawaited(
      _dataSource.markRead(id).catchError((Object e) {
        _logger.logError(e, null, reason: 'NotificationsCubit.markRead');
      }),
    );
  }

  /// Barcha yozuvlarni o'qilgan deb belgilaydi (app bar'dagi harakat).
  void markAllRead() {
    final current = state;
    if (current is! NotificationsLoaded) return;
    final updated = [
      for (final item in current.items) item.copyWith(read: true),
    ];
    _persist(updated);
    emit(NotificationsLoaded(updated));
    unawaited(
      _dataSource.markAllRead().catchError((Object e) {
        _logger.logError(e, null, reason: 'NotificationsCubit.markAllRead');
      }),
    );
  }

  void _persist(List<NotificationItem> items) {
    unawaited(
      _cache?.setJson(
        NotificationItem.cacheKey,
        items.map((n) => n.toJson()).toList(),
      ),
    );
  }

  @override
  Future<void> close() {
    _poll?.cancel();
    return super.close();
  }
}
