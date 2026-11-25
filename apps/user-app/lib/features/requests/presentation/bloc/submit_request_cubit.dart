import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';
import 'package:user_app/features/requests/domain/citizen_requests_revision.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';
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
    CitizenRequestsRepository? repository,
    AppLogger? logger,
  }) : _submitCitizenRequest = submitCitizenRequest,
       _repository = repository,
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
  final CitizenRequestsRepository? _repository;

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
  ///
  /// Yuborish davom etayotganda qayta chaqiruv e'tiborsiz qoldiriladi; sahifa
  /// yopilgan bo'lsa natija emit qilinmaydi.
  Future<void> submit(CitizenRequest draft) async {
    // Murojaat allaqachon yaratilgan holatda qayta yaratmaymiz.
    if (state is SubmitRequestSubmitting ||
        state is SubmitRequestAttachmentsFailed ||
        state is SubmitRequestSuccess) {
      return;
    }
    emit(const SubmitRequestSubmitting());
    final Either<Failure, CitizenRequest> result;
    try {
      result = await _submitCitizenRequest(draft);
    } on Object catch (e, stackTrace) {
      _logger.logError(e, stackTrace, reason: 'SubmitRequestCubit.submit');
      if (!isClosed) {
        emit(
          const SubmitRequestFailure(
            "Murojaat yuborilmadi. Qayta urinib ko'ring",
          ),
        );
      }
      return;
    }
    await result.fold(
      (failure) async {
        _logger.logError(
          failure,
          StackTrace.current,
          reason: 'SubmitRequestCubit.submit',
        );
        if (!isClosed) emit(SubmitRequestFailure(failure.message));
      },
      (created) {
        citizenRequestsRevision.value++;
        return _upload(created, draft.attachments);
      },
    );
  }

  /// Yuklanmay qolgan fayllarni qayta yuboradi.
  Future<void> retryAttachments() async {
    final current = state;
    if (current is! SubmitRequestAttachmentsFailed) return;
    emit(const SubmitRequestSubmitting());
    await _upload(current.created, current.failed);
  }

  /// Yuklanmagan fayllardan voz kechib yakunlaydi.
  void finishWithoutAttachments() {
    final current = state;
    if (current is SubmitRequestAttachmentsFailed) {
      emit(SubmitRequestSuccess(current.created));
    }
  }

  Future<void> _upload(
    CitizenRequest created,
    List<RequestAttachment> attachments,
  ) async {
    final failed = <RequestAttachment>[];
    var message = '';
    for (final attachment in attachments) {
      final repository = _repository ?? getIt<CitizenRequestsRepository>();
      Either<Failure, Unit> result;
      try {
        result = await repository.uploadAttachment(created.id, attachment);
      } on Object catch (e, stackTrace) {
        _logger.logError(e, stackTrace, reason: 'SubmitRequestCubit.upload');
        result = const Left(ServerFailure("Faylni yuklab bo'lmadi"));
      }
      result.fold((failure) {
        failed.add(attachment);
        message = failure.message;
      }, (_) {});
    }
    if (isClosed) return;
    emit(
      failed.isEmpty
          ? SubmitRequestSuccess(created)
          : SubmitRequestAttachmentsFailed(created, failed, message),
    );
  }
}
