import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/usecases/pay_utility.dart';

part 'pay_state.dart';

/// Bitta kommunal xizmat bo'yicha to'lov oqimini boshqaruvchi Cubit.
///
/// Har bir `PayPage` chaqiruvi uchun YANGI instansiya (factory) —
/// oldingi to'lov urinishining holati keyingisiga sizib o'tmasligi kerak.
class PayCubit extends Cubit<PayState> {
  PayCubit({required PayUtility payUtility})
    : _payUtility = payUtility,
      super(const PayIdle());

  final PayUtility _payUtility;

  /// SMS bosqichi yakunlanguncha ushlab turiladigan parametrlar — faqat
  /// [confirmOtp] muvaffaqiyatli tasdiqlagach haqiqiy (mock) to'lov
  /// so'roviga yuboriladi.
  PayUtilityParams? _pendingParams;

  /// Mock SMS tasdiqlash kodi — haqiqiy SMS HECH QACHON yuborilmaydi,
  /// faqat UI ostida "namuna" sifatida ko'rsatiladi. Doim FIXED
  /// (tasodifiy emas) — demo/test uchun bashorat qilinadigan.
  static const demoOtpCode = '1234';

  /// 1-bosqich: summa/karta (bosh sahifada allaqachon tekshirilgan) bilan
  /// SMS tasdiqlash bosqichiga o'tadi. Haqiqiy (mock) to'lov HALI
  /// yuborilmaydi — u faqat [confirmOtp] chaqirilgach amalga oshadi.
  void startPayment({
    required UtilityType type,
    required double amount,
    required String cardNumber,
  }) {
    _pendingParams = PayUtilityParams(
      type: type,
      amount: amount,
      cardNumber: cardNumber,
    );
    emit(const PayAwaitingOtp(demoOtpCode));
  }

  /// 2-bosqich: SMS kod (mock — istalgan 4 xonali kod) tasdiqlangach,
  /// [startPayment]da saqlangan parametrlar bilan haqiqiy (mock) to'lovni
  /// yuboradi.
  Future<void> confirmOtp(String code) async {
    final pending = _pendingParams;
    if (pending == null) return;
    emit(const PaySubmitting());
    final result = await _payUtility(pending);
    result.fold(
      (failure) => emit(PayFailure(failure.message)),
      (payment) => emit(PaySuccess(payment)),
    );
    _pendingParams = null;
  }

  /// SMS tasdiqlash bosqichi bekor qilindi (foydalanuvchi varaqni yopdi,
  /// kod kiritmasdan) — boshlang'ich holatga qaytadi.
  void cancelOtp() {
    _pendingParams = null;
    if (state is PayAwaitingOtp) emit(const PayIdle());
  }
}
