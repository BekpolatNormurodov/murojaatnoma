part of 'notifications_cubit.dart';

/// "Bildirishnomalar" ro'yxat sahifasining barcha holatlari.
///
/// `sealed` — `NotificationsPage`dagi `switch` ifodasi compiler tomonidan
/// to'liq (exhaustive) tekshiriladi — hech qachon oq/bo'sh ekran YO'Q
/// mandatining bir qismi (`RequestsState` bilan bir xil naqsh).
sealed class NotificationsState extends Equatable {
  const NotificationsState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda — ro'yxat skeleton (`AppSkeletonList`) ko'rsatadi.
class NotificationsLoading extends NotificationsState {
  const NotificationsLoading();
}

/// Bildirishnomalar ro'yxati muvaffaqiyatli yuklandi va bo'sh emas.
class NotificationsLoaded extends NotificationsState {
  const NotificationsLoaded(this.items);

  final List<NotificationItem> items;

  @override
  List<Object?> get props => [items];
}

/// Foydalanuvchida hech qanday bildirishnoma yo'q.
class NotificationsEmpty extends NotificationsState {
  const NotificationsEmpty();
}

/// Ro'yxatni yuklashda xatolik — [message] "Qayta urinish" tugmasi bilan
/// birga ko'rsatiladi.
class NotificationsError extends NotificationsState {
  const NotificationsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
