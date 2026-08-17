part of 'submit_request_cubit.dart';

/// Murojaat yuborish sahifasining barcha holatlari.
sealed class SubmitRequestState extends Equatable {
  const SubmitRequestState();

  @override
  List<Object?> get props => [];
}

/// Boshlang'ich holat — foydalanuvchi shaklni to'ldirmoqda.
class SubmitRequestIdle extends SubmitRequestState {
  const SubmitRequestIdle();
}

/// Murojaat yuborilmoqda — tugma loading holatida.
class SubmitRequestSubmitting extends SubmitRequestState {
  const SubmitRequestSubmitting();
}

/// Murojaat muvaffaqiyatli yuborildi.
class SubmitRequestSuccess extends SubmitRequestState {
  const SubmitRequestSuccess(this.created);

  final CitizenRequest created;

  @override
  List<Object?> get props => [created];
}

/// Murojaat yuborilmadi — [message] xabar sifatida ko'rsatiladi.
class SubmitRequestFailure extends SubmitRequestState {
  const SubmitRequestFailure(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
