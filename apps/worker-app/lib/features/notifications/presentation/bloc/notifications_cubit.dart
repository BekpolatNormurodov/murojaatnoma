import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/notifications/domain/entities/notification_item.dart';
import 'package:worker_app/features/notifications/domain/repositories/notifications_repository.dart';

part 'notifications_state.dart';

/// "Bildirishnomalar" ro'yxat sahifasini boshqaruvchi Cubit.
///
/// `RequestsCubit`/`HomeCubit` bilan bir xil naqsh: LAZY SINGLETON sifatida
/// ro'yxatdan o'tkaziladi (qarang: `injection.dart`) — shu tufayli bosh
/// sahifadagi qo'ng'iroq belgisi (unread-son) VA `/notifications` sahifasi
/// XUDDI SHU instansiyani ko'radi, hech qanday qo'shimcha sinxronlash
/// shart emas.
///
/// `AuthCubit`ga bevosita bog'liq (boshqa ro'yxat cubit'laridan farqli
/// o'laroq, masalan `RequestsCubit`) — chunki backend
/// `GET /notifications/employee/:employeeId` marshruti JWT'dan emas,
/// aniq `employeeId` path-parametridan xodimni aniqlaydi (qarang:
/// `notifications.controller.ts`). Joriy `workerId` HAR SAFAR `load()`da
/// (konstruktordagi bir martalik o'rniga) qayta o'qiladi — shu tufayli
/// ilova ildizidagi birinchi `..load()` chaqiruvi hali avtorizatsiya
/// tugallanmagan bo'lsa ham (masalan birinchi marta kirilganda),
/// keyingi `load()` chaqiruvlari (sahifa ochilishi/pull-to-refresh)
/// to'g'ri sessiyani ko'radi.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [NotificationsError] holatiga aylanadi.
class NotificationsCubit extends Cubit<NotificationsState> {
  NotificationsCubit({
    required NotificationsRepository repository,
    required AuthCubit authCubit,
  }) : _repository = repository,
       _authCubit = authCubit,
       super(const NotificationsLoading());

  final NotificationsRepository _repository;
  final AuthCubit _authCubit;

  /// Joriy o'qilmagan bildirishnomalar soni — holatdan qat'i nazar
  /// (`Loaded` bo'lmasa 0), bosh sahifadagi qo'ng'iroq belgisi uchun.
  ///
  /// Backendda alohida `GET /notifications/unread-count` marshruti
  /// YO'Q — son har doim allaqachon yuklangan ro'yxatdan hisoblanadi,
  /// qo'shimcha so'rov shart emas.
  int get unreadCount {
    final current = state;
    return current is NotificationsLoaded
        ? current.items.where((n) => !n.read).length
        : 0;
  }

  Future<void> load() async {
    emit(const NotificationsLoading());
    final employeeId = _authCubit.state.session?.workerId;
    if (employeeId == null || employeeId.isEmpty) {
      // Hali авторизация qilinmagan (masalan ilova sovuq boshlanishda) —
      // xato EMAS, shunchaki hozircha ko'rsatadigan narsa yo'q. `AuthCubit`
      // avtorizatsiyalangach, sahifa qayta ochilganda/pull-to-refresh'da
      // to'g'ri `employeeId` bilan qayta yuklanadi.
      emit(const NotificationsEmpty());
      return;
    }
    final result = await _repository.list(employeeId);
    result.fold(
      (failure) => emit(NotificationsError(failure.message)),
      (items) {
        final sorted = [...items]
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        emit(
          sorted.isEmpty
              ? const NotificationsEmpty()
              : NotificationsLoaded(sorted),
        );
      },
    );
  }

  /// Bitta yozuvni o'qilgan deb belgilaydi (masalan ro'yxatda ustiga
  /// bosilganda). `Loaded` bo'lmasa jim hech narsa qilmaydi.
  ///
  /// UI darhol (optimistik) yangilanadi; backendga xabar berish
  /// (`PATCH /notifications/:id/read`) fonda, BEST-EFFORT tarzda —
  /// muvaffaqiyatsiz bo'lsa ham foydalanuvchi ko'rgan holat (o'qilgan)
  /// orqaga qaytarilmaydi, chunki bu faqat "ko'rilganlik" belgisi.
  void markRead(String id) {
    final current = state;
    if (current is! NotificationsLoaded) return;
    final wasUnread = current.items.any((n) => n.id == id && !n.read);
    if (!wasUnread) return;
    final updated = [
      for (final item in current.items)
        if (item.id == id) item.copyWith(read: true) else item,
    ];
    emit(NotificationsLoaded(updated));
    unawaited(_syncMarkRead(id));
  }

  /// Barcha yozuvlarni o'qilgan deb belgilaydi (app bar'dagi harakat).
  ///
  /// `markRead` bilan bir xil optimistik+best-effort naqsh — faqat bir
  /// nechta yozuv uchun birdaniga.
  void markAllRead() {
    final current = state;
    if (current is! NotificationsLoaded) return;
    final unreadIds = [
      for (final item in current.items)
        if (!item.read) item.id,
    ];
    if (unreadIds.isEmpty) return;
    final updated = [
      for (final item in current.items) item.copyWith(read: true),
    ];
    emit(NotificationsLoaded(updated));
    for (final id in unreadIds) {
      unawaited(_syncMarkRead(id));
    }
  }

  /// `_repository.markRead` ni xato yutib chaqiradi — qarang: `markRead`
  /// hujjati (best-effort, UI holatini orqaga qaytarmaydi).
  Future<void> _syncMarkRead(String id) async {
    try {
      await _repository.markRead(id);
    } on Object {
      // Jim o'tkazib yuboriladi — best-effort fon sinxronizatsiyasi.
    }
  }
}
