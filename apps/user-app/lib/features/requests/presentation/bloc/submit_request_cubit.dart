import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/usecases/submit_citizen_request.dart';

part 'submit_request_state.dart';

/// Yangi ariza/shikoyat yuborish oqimini boshqaruvchi Cubit.
///
/// Har bir `SubmitRequestPage` chaqiruvi uchun YANGI instansiya (factory)
/// — oldingi urinishning holati keyingisiga sizib o'tmasligi kerak
/// (`PayCubit` bilan bir xil naqsh).
class SubmitRequestCubit extends Cubit<SubmitRequestState> {
  SubmitRequestCubit({
    required SubmitCitizenRequest submitCitizenRequest,
    AppLogger? logger,
  }) : _submitCitizenRequest = submitCitizenRequest,
       _logger = logger ?? const AppLogger(),
       super(const SubmitRequestIdle());

  final SubmitCitizenRequest _submitCitizenRequest;
  final AppLogger _logger;

  /// Tayyorlangan [draft]ni yuboradi. Darhol [SubmitRequestSubmitting]ga
  /// o'tadi — sahifa shu holatni ko'rib forma ustini bloklaydi va
  /// yuborish tugmasini loading holatiga o'tkazadi (aniq yuklanish
  /// signali, ikki marta bosishning oldini oladi).
  Future<void> submit(CitizenRequest draft) async {
    emit(const SubmitRequestSubmitting());
    final result = await _submitCitizenRequest(draft);
    result.fold((failure) {
      _logger.logError(
        failure,
        StackTrace.current,
        reason: 'SubmitRequestCubit.submit',
      );
      emit(SubmitRequestFailure(failure.message));
    }, (created) => emit(SubmitRequestSuccess(created)));
  }
}
