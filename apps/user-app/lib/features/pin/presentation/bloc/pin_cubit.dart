import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/pin/data/datasources/pin_attempt_store.dart';
import 'package:user_app/features/pin/domain/usecases/set_pin.dart';
import 'package:user_app/features/pin/domain/usecases/verify_pin.dart';

part 'pin_state.dart';

/// Ilova-qulf PIN kodini boshqaruvchi Cubit — SET (birinchi marta
/// o'rnatish + tasdiqlash) VA VERIFY (qulfni ochish) ikkalasini ham
/// qamrab oladi.
///
/// PIN raqamlarining o'zi (`AppPinInput` ichida) widget holatida
/// yig'iladi — bu Cubit faqat TO'LIQ (4 xonali) kiritish tugagandan
/// keyingi ASINXRON biznes-mantiqni boshqaradi: xeshlash, xavfsiz
/// xotiraga yozish/o'qish, solishtirish. Hech qachon uncaught qolmaydi —
/// `SetPin`/`VerifyPin` (demak, `PinRepository`) allaqachon barcha
/// istisnolarni `Either<Failure, _>`ga aylantiradi.
class PinCubit extends Cubit<PinState> {
  PinCubit({
    required SetPin setPin,
    required VerifyPin verifyPin,
    PinAttemptStore? attempts,
  }) : _setPin = setPin,
       _verifyPin = verifyPin,
       _attempts = attempts,
       super(const PinInitial());

  /// Urinishlar sonini saqlovchi — ilovani qayta ochish hisobni nollamaydi.
  final PinAttemptStore? _attempts;

  final SetPin _setPin;
  final VerifyPin _verifyPin;

  /// SET rejimi, 1-qadam: birinchi 4 xona kiritildi. Faqat xotirada
  /// saqlanadi (hali diskka yozilmaydi) — tasdiqlash kiritilishini
  /// kutadi.
  String? _pendingPin;

  /// Shundan ko'p ketma-ket noto'g'ri VERIFY urinishidan keyin — yumshoq
  /// bloklash ([PinLockedOut]).
  static const maxAttempts = 5;

  /// Ketma-ket noto'g'ri VERIFY urinishlar hisoblagichi.
  int _failedAttempts = 0;

  /// SET rejimi, 1-qadam: birinchi kiritishni qabul qiladi.
  ///
  /// `PinSetPage` buni `AppPinInput.onCompleted`dan chaqiradi — joriy
  /// holat `PinAwaitingConfirmation` BO'LMAGANDA (ya'ni 1-qadamda yoki
  /// oldingi urinish mos kelmagandan keyin) har bir to'liq kiritish shu
  /// metodga yo'naltiriladi.
  void submitFirstEntry(String pin) {
    _pendingPin = pin;
    emit(const PinAwaitingConfirmation());
  }

  /// SET rejimi, 2-qadam: tasdiqlash kiritildi. Mos kelmasa
  /// [PinMismatch] (1-qadamga qaytariladi — chaqiruvchi keyingi 4 xonani
  /// yana [submitFirstEntry]ga yuboradi); mos kelsa xeshlab saqlaydi.
  Future<void> confirmEntry(String pin) async {
    final pending = _pendingPin;
    _pendingPin = null;
    if (pending == null || pending != pin) {
      emit(const PinMismatch());
      return;
    }

    emit(const PinSaving());
    final result = await _setPin(SetPinParams(pin));
    if (result.isRight()) await _attempts?.write(0);
    if (isClosed) return;
    result.fold(
      (failure) => emit(PinStorageError(failure.message)),
      (_) => emit(const PinSetSuccess()),
    );
  }

  /// VERIFY rejimi: kiritilgan PIN saqlangan xesh bilan mos kelsa
  /// [PinVerifySuccess] (hisoblagich nolga tushadi), aks holda
  /// hisoblagich oshadi va [PinVerifyError] chiqariladi — [maxAttempts]ga
  /// yetganda esa (to'g'ri PIN hali ham qabul qilinadi, "yumshoq" bloklash)
  /// [PinLockedOut].
  Future<void> verifyPin(String pin) async {
    if (state is PinVerifying) return;
    emit(const PinVerifying());
    final store = _attempts;
    if (store != null) {
      _failedAttempts = await store.read();
      if (isClosed) return;
      // Limit allaqachon tugagan (ilova qayta ochilgan) — tekshirmaymiz.
      if (_failedAttempts >= maxAttempts) {
        emit(const PinLockedOut());
        return;
      }
    }
    final result = await _verifyPin(VerifyPinParams(pin));
    if (isClosed) return;
    await result.fold(
      (failure) async => emit(PinStorageError(failure.message)),
      (matches) async {
        _failedAttempts = matches ? 0 : _failedAttempts + 1;
        await store?.write(_failedAttempts);
        if (isClosed) return;
        emit(
          matches
              ? const PinVerifySuccess()
              : _failedAttempts >= maxAttempts
              ? const PinLockedOut()
              : const PinVerifyError(),
        );
      },
    );
  }
}
