import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/usecases/submit_citizen_request.dart';
import 'package:user_app/injection.dart';

part 'submit_request_state.dart';

/// Yangi ariza/shikoyat yuborish oqimini boshqaruvchi Cubit.
///
/// Har bir `SubmitRequestPage` chaqiruvi uchun YANGI instansiya (factory)
/// — oldingi urinishning holati keyingisiga sizib o'tmasligi kerak
/// (`PayCubit` bilan bir xil naqsh).
class SubmitRequestCubit extends Cubit<SubmitRequestState> {
  SubmitRequestCubit({
    required SubmitCitizenRequest submitCitizenRequest,
    RegistrationRepository? registrationRepository,
    AppLogger? logger,
  }) : _submitCitizenRequest = submitCitizenRequest,
       // `NotificationsCubit` bilan bir xil naqsh: `injection.dart`da
       // ro'yxatdan o'tkazish o'zgarmasligi uchun (bu fayl tashqarisida
       // tahrirlash TAQIQLANGAN) ICHKI standart qiymat `getIt` orqali
       // olinadi — chaqiruvchi (test) xohlasa o'zining fake'ini berishi
       // ham mumkin.
       _registrationRepository =
           registrationRepository ?? getIt<RegistrationRepository>(),
       _logger = logger ?? const AppLogger(),
       super(const SubmitRequestIdle());

  final SubmitCitizenRequest _submitCitizenRequest;
  final RegistrationRepository _registrationRepository;
  final AppLogger _logger;

  /// Fuqaroning ro'yxatdan o'tish profilidagi viloyat/tuman KODlarini
  /// oladi — "Manzil" maydonini oldindan (ixtiyoriy qulaylik sifatida)
  /// to'ldirish uchun. Profil hali yo'q/o'qilmasa `null` qaytaradi va
  /// hech qachon `throw` qilmaydi — bu shunchaki qulaylik, murojaat
  /// yuborishni bloklamasligi kerak.
  Future<CitizenProfile?> loadDefaultLocation() async {
    final result = await _registrationRepository.getProfile();
    return result.fold((_) => null, (profile) => profile);
  }

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
