import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/notifications/data/datasources/notifications_mock_data_source.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';

part 'notifications_state.dart';

/// "Bildirishnomalar" ro'yxat sahifasini boshqaruvchi Cubit.
///
/// `HomeCubit` bilan bir xil naqsh: LAZY SINGLETON sifatida ro'yxatdan
/// o'tkaziladi (qarang: `injection.dart`) — shu tufayli bosh sahifadagi
/// qo'ng'iroq belgisi (unread-son) VA `/notifications` sahifasi XUDDI SHU
/// instansiyani ko'radi, hech qanday qo'shimcha sinxronlash shart emas.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [NotificationsError] holatiga aylanadi.
class NotificationsCubit extends Cubit<NotificationsState> {
  NotificationsCubit({NotificationsMockDataSource? dataSource})
    : _dataSource = dataSource ?? NotificationsMockDataSource(),
      super(const NotificationsLoading());

  final NotificationsMockDataSource _dataSource;

  /// Joriy o'qilmagan bildirishnomalar soni — holatdan qat'i nazar
  /// (`Loaded` bo'lmasa 0), bosh sahifadagi qo'ng'iroq belgisi uchun.
  int get unreadCount {
    final current = state;
    return current is NotificationsLoaded
        ? current.items.where((n) => !n.read).length
        : 0;
  }

  Future<void> load() async {
    emit(const NotificationsLoading());
    try {
      final items = await _dataSource.fetch();
      final sorted = [...items]
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      emit(
        sorted.isEmpty
            ? const NotificationsEmpty()
            : NotificationsLoaded(sorted),
      );
    } on Object catch (e) {
      emit(NotificationsError('Kutilmagan xatolik: $e'));
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
    emit(NotificationsLoaded(updated));
  }

  /// Barcha yozuvlarni o'qilgan deb belgilaydi (app bar'dagi harakat).
  void markAllRead() {
    final current = state;
    if (current is! NotificationsLoaded) return;
    final updated = [
      for (final item in current.items) item.copyWith(read: true),
    ];
    emit(NotificationsLoaded(updated));
  }
}
