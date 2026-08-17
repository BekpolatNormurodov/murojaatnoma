part of 'request_detail_cubit.dart';

/// "Murojaat tafsilotlari" sahifasining barcha holatlari.
sealed class RequestDetailState extends Equatable {
  const RequestDetailState();

  @override
  List<Object?> get props => [];
}

/// Murojaat yuklanmoqda (yoki qayta yuklanmoqda — "Qayta urinish").
class RequestDetailLoading extends RequestDetailState {
  const RequestDetailLoading();
}

/// Murojaat muvaffaqiyatli yuklandi.
///
/// [submitting] — javob yozish/ball qo'yish amali bajarilayotganda
/// `true` (tugmalar shu payt bloklanadi/loading ko'rsatadi), lekin
/// sahifa o'zi almashtirilmaydi — mavjud ma'lumot ustida ko'rsatiladi.
class RequestDetailLoaded extends RequestDetailState {
  const RequestDetailLoaded({
    required this.application,
    this.submitting = false,
  });

  final Application application;
  final bool submitting;

  RequestDetailLoaded copyWith({Application? application, bool? submitting}) {
    return RequestDetailLoaded(
      application: application ?? this.application,
      submitting: submitting ?? this.submitting,
    );
  }

  @override
  List<Object?> get props => [application, submitting];
}

/// Murojaatni yuklashda xatolik (masalan topilmadi/server xatosi) —
/// [message] "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class RequestDetailError extends RequestDetailState {
  const RequestDetailError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
