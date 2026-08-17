import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/cache/cache_service.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/notifications/data/datasources/notifications_mock_data_source.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';
import 'package:user_app/injection.dart';

part 'notifications_state.dart';

/// "Bildirishnomalar" ro'yxat sahifasini boshqaruvchi Cubit.
///
/// `HomeCubit` bilan bir xil naqsh: LAZY SINGLETON sifatida ro'yxatdan
/// o'tkaziladi (qarang: `injection.dart`) — shu tufayli bosh sahifadagi
/// qo'ng'iroq belgisi (unread-son) VA `/notifications` sahifasi XUDDI SHU
/// instansiyani ko'radi, hech qanday qo'shimcha sinxronlash shart emas.
///
/// **Cache-then-network**: [load] avval `CacheService`dagi oxirgi
/// ro'yxatni (masalan avvalgi seansdagi o'qilgan/o'qilmagan belgilar bilan)
/// DARHOL ko'rsatadi (skeleton'siz), so'ng (mock) manbadan yangisini
/// so'raydi va natijani/keshni yangilaydi.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [NotificationsError] holatiga aylanadi (kesh bo'sh bo'lsa).
class NotificationsCubit extends Cubit<NotificationsState> {
  NotificationsCubit({
    NotificationsMockDataSource? dataSource,
    CacheService? cache,
  }) : _dataSource = dataSource ?? NotificationsMockDataSource(),
       _cache =
           cache ??
           (getIt.isRegistered<CacheService>()
               ? getIt<CacheService>()
               : null),
       super(const NotificationsLoading());

  final NotificationsMockDataSource _dataSource;
  final CacheService? _cache;
  static const _logger = AppLogger();

  /// Joriy o'qilmagan bildirishnomalar soni — holatdan qat'i nazar
  /// (`Loaded` bo'lmasa 0), bosh sahifadagi qo'ng'iroq belgisi uchun.
  int get unreadCount {
    final current = state;
    return current is NotificationsLoaded
        ? current.items.where((n) => !n.read).length
        : 0;
  }

  Future<void> load() async {
    final cached = _cache?.getJsonList<NotificationItem>(
      NotificationItem.cacheKey,
      NotificationItem.fromJson,
    );
    if (cached != null && cached.isNotEmpty) {
      emit(NotificationsLoaded(cached));
    } else {
      emit(const NotificationsLoading());
    }

    try {
      final items = await _dataSource.fetch();
      final sorted = [...items]
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      unawaited(
        _cache?.setJson(
          NotificationItem.cacheKey,
          sorted.map((n) => n.toJson()).toList(),
        ),
      );
      emit(
        sorted.isEmpty
            ? const NotificationsEmpty()
            : NotificationsLoaded(sorted),
      );
    } on Object catch (e) {
      if (cached != null && cached.isNotEmpty) {
        _logger.logError(e, null, reason: 'NotificationsCubit.load');
      } else {
        emit(NotificationsError('Kutilmagan xatolik: $e'));
      }
    }
  }

  /// Bitta yozuvni o'qilgan deb belgilaydi (masalan ro'yxatda ustiga
  /// bosilganda). `Loaded` bo'lmasa jim hech narsa qilmaydi.
  void markRead(String id) {
    final current = state;
    if (current is! NotificationsLoaded) return;
    final updated = [
      for (final item in current.items)
        if (item.id == id) item.copyWith(read: true) else item,
    ];
    _persist(updated);
    emit(NotificationsLoaded(updated));
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
  }

  /// Joriy ro'yxatni (o'qilgan-belgilar bilan) keshga yozadi — shu tufayli
  /// ilova qayta ochilganda [load] darhol so'nggi o'qilgan-holatni
  /// ko'rsatadi, keyin fon-tarmoq javobi bilan tasdiqlanadi/yangilanadi.
  void _persist(List<NotificationItem> items) {
    unawaited(
      _cache?.setJson(
        NotificationItem.cacheKey,
        items.map((n) => n.toJson()).toList(),
      ),
    );
  }
}
