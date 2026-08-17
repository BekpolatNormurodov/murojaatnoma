part of 'pay_cubit.dart';

/// To'lov sahifasining barcha holatlari.
sealed class PayState extends Equatable {
  const PayState();

  @override
  List<Object?> get props => [];
}

/// Boshlang'ich holat — foydalanuvchi summa/karta kiritmoqda.
class PayIdle extends PayState {
  const PayIdle();
}

/// Summa/karta tekshirilgach, SMS tasdiqlash kodi kutilmoqda — haqiqiy
/// (mock) to'lov HALI YUBORILMAGAN. [demoCode] — mock namuna sifatida UI
/// ostida ko'rsatiladigan kod (haqiqiy SMS yuborilmaydi, istalgan
/// 4 xonali kod qabul qilinadi).
class PayAwaitingOtp extends PayState {
  const PayAwaitingOtp(this.demoCode);

  final String demoCode;

  @override
  List<Object?> get props => [demoCode];
}

/// To'lov yuborilmoqda — tugma loading holatida.
class PaySubmitting extends PayState {
  const PaySubmitting();
}

/// To'lov muvaffaqiyatli amalga oshdi.
class PaySuccess extends PayState {
  const PaySuccess(this.payment);

  final Payment payment;

  @override
  List<Object?> get props => [payment];
}

/// To'lov amalga oshmadi — [message] xabar sifatida ko'rsatiladi.
class PayFailure extends PayState {
  const PayFailure(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
