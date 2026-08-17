import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/domain/usecases/get_application.dart';
import 'package:worker_app/features/requests/domain/usecases/rate_application.dart';
import 'package:worker_app/features/requests/domain/usecases/respond_application.dart';

part 'request_detail_state.dart';

/// "Murojaat tafsilotlari" sahifasini boshqaruvchi Cubit — bitta
/// murojaatni yuklaydi, xodim javobini yozadi va ball qo'yadi.
///
/// Hech qachon uncaught tashlamaydi: [load] muvaffaqiyatsizligi
/// [RequestDetailError] holatiga aylanadi; [respond]/[rate]
/// muvaffaqiyatsizligi esa joriy [RequestDetailLoaded]ni saqlab qolgan
/// holda xatolik matnini qaytaradi (`Future<String?>` — `null` bo'lsa
/// muvaffaqiyatli) — chaqiruvchi (sahifa) buni to'g'ridan-to'g'ri
/// `AppDialog`/`AppAlert` orqali ko'rsatadi (`AttendanceCubit.checkGeofence`
/// bilan bir xil naqsh: holat pipeline'iga aralashmaydigan bitta
/// martalik natija).
class RequestDetailCubit extends Cubit<RequestDetailState> {
  RequestDetailCubit({
    required GetApplication getApplication,
    required RespondApplication respondApplication,
    required RateApplication rateApplication,
  }) : _getApplication = getApplication,
       _respondApplication = respondApplication,
       _rateApplication = rateApplication,
       super(const RequestDetailLoading());

  final GetApplication _getApplication;
  final RespondApplication _respondApplication;
  final RateApplication _rateApplication;

  /// So'nggi [load] bilan chaqirilgan ID — [retry] parametrsiz qayta
  /// yuklay olishi uchun saqlanadi.
  String? _lastId;

  Future<void> load(String id) async {
    _lastId = id;
    emit(const RequestDetailLoading());
    try {
      final result = await _getApplication(GetApplicationParams(id));
      result.fold(
        (failure) => emit(RequestDetailError(failure.message)),
        (application) => emit(RequestDetailLoaded(application: application)),
      );
    } on Object catch (e) {
      emit(RequestDetailError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan ID bilan qayta yuklaydi ("Qayta urinish").
  Future<void> retry() {
    final id = _lastId;
    return id == null ? Future<void>.value() : load(id);
  }

  /// Murojaatga javob yozadi (matn + ixtiyoriy biriktirmalar).
  ///
  /// Qaytadi: `null` — muvaffaqiyatli; aks holda — ko'rsatiladigan
  /// xatolik matni.
  Future<String?> respond(String text, List<AttachmentRef> attachments) {
    return _mutate(
      (application) => _respondApplication(
        RespondApplicationParams(
          id: application.id,
          response: ApplicationResponse(
            text: text,
            attachments: attachments,
            respondedAt: DateTime.now().toIso8601String(),
          ),
        ),
      ),
    );
  }

  /// Murojaatga ball (baho) qo'yadi.
  ///
  /// Qaytadi: `null` — muvaffaqiyatli; aks holda — ko'rsatiladigan
  /// xatolik matni.
  Future<String?> rate(int points) {
    return _mutate(
      (application) => _rateApplication(
        RateApplicationParams(id: application.id, points: points),
      ),
    );
  }

  /// [respond]/[rate] uchun umumiy skelet: joriy holat yuklangan
  /// bo'lishini talab qiladi, `submitting`ni yoqadi, [action]ni
  /// bajaradi, natijaga qarab yangi [RequestDetailLoaded] chiqaradi (yoki
  /// `submitting`ni o'chirib xatolik matnini qaytaradi). Hech qachon
  /// uncaught tashlamaydi.
  Future<String?> _mutate(
    Future<Either<Failure, Application>> Function(Application current) action,
  ) async {
    final current = state;
    if (current is! RequestDetailLoaded) {
      return 'Murojaat hali yuklanmagan';
    }
    emit(current.copyWith(submitting: true));
    try {
      final result = await action(current.application);
      return result.fold(
        (failure) {
          emit(current.copyWith(submitting: false));
          return failure.message;
        },
        (updated) {
          emit(RequestDetailLoaded(application: updated));
          return null;
        },
      );
    } on Object catch (e) {
      emit(current.copyWith(submitting: false));
      return 'Kutilmagan xatolik: $e';
    }
  }
}
