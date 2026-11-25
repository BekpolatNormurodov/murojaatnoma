import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/entities/request_message.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_request.dart';
import 'package:user_app/features/requests/domain/usecases/get_request_messages.dart';
import 'package:user_app/features/requests/domain/usecases/send_request_message.dart';
import 'package:user_app/injection.dart';

part 'request_detail_state.dart';

/// "Murojaat tafsilotlari" sahifasini boshqaruvchi Cubit — bitta ariza/
/// shikoyatni (+ uning xabarlar thread'ini) ID bo'yicha yuklaydi va fuqaro
/// nomidan yangi xabar yuborishga imkon beradi.
///
/// Fuqaro o'z murojaatiga rasmiy JAVOB yozmaydi/ball qo'ymaydi (bu — xodim
/// tomonidagi amal, worker-app'dagi `RequestDetailCubit`da), lekin xabarlar
/// thread'iga savol/izoh yozishi mumkin — shu tufayli faqat [sendMessage]
/// mutatsiya metodi bor.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [RequestDetailError] holatiga aylanadi.
class RequestDetailCubit extends Cubit<RequestDetailState> {
  RequestDetailCubit({
    required GetCitizenRequest getCitizenRequest,
    required GetRequestMessages getRequestMessages,
    required SendRequestMessage sendRequestMessage,
    CitizenRequestsRepository? repository,
    AppLogger? logger,
  }) : _repository = repository ?? getIt<CitizenRequestsRepository>(),
       _getCitizenRequest = getCitizenRequest,
       _getRequestMessages = getRequestMessages,
       _sendRequestMessage = sendRequestMessage,
       _logger = logger ?? const AppLogger(),
       super(const RequestDetailLoading());

  final CitizenRequestsRepository _repository;
  final GetCitizenRequest _getCitizenRequest;
  final GetRequestMessages _getRequestMessages;
  final SendRequestMessage _sendRequestMessage;
  final AppLogger _logger;

  /// Optimistik (hali serverga tasdiqlanmagan) xabar ID'lari shu prefiks
  /// bilan boshlanadi — [sendMessage] ularni haqiqiy ID bilan
  /// almashtirganda yoki xatolik bo'lsa ro'yxatdan olib tashlaganda
  /// aniqlash uchun.
  static const _optimisticIdPrefix = '_optimistic_';

  /// So'nggi [load] bilan chaqirilgan ID — [retry]/[sendMessage]
  /// parametrsiz qayta yuklay olishi uchun saqlanadi.
  String? _lastId;

  /// [rate]/[reopen] bajarilayotganmi — ikki marta bosish ikki so'rov
  /// yubormasin.
  bool _mutating = false;

  /// Xabar yuborilganda/baholanganda/qayta ochilganda oshadi — shundan
  /// OLDIN boshlangan [reloadMessages] javobi yangi holatni bosib ketmaydi.
  int _revision = 0;

  /// Fuqaroga ko'rsatiladigan umumiy matn — xom istisno matni (`$e`) UI'ga
  /// hech qachon chiqmaydi (u faqat logga yoziladi).
  static const _unexpectedError =
      "Ma'lumotni yuklab bo'lmadi. Qayta urinib ko'ring";
  static const _sendFailed = "Xabar yuborilmadi. Qayta urinib ko'ring";
  static const _busyMessage = "So'rov bajarilmoqda, biroz kuting";

  Future<void> load(String id) async {
    _lastId = id;
    emit(const RequestDetailLoading());
    try {
      final result = await _getCitizenRequest(GetCitizenRequestParams(id));
      if (isClosed) return;
      await result.fold(
        (failure) async {
          _logger.logError(
            failure,
            StackTrace.current,
            reason: 'RequestDetailCubit.load',
          );
          emit(RequestDetailError(failure.message));
        },
        (request) async {
          final messages = await _fetchMessages(id);
          if (isClosed) return;
          emit(
            RequestDetailLoaded(
              request: request,
              messages: messages ?? const [],
              messagesFailed: messages == null,
            ),
          );
        },
      );
    } on Object catch (e, stackTrace) {
      _logger.logError(e, stackTrace, reason: 'RequestDetailCubit.load');
      if (isClosed) return;
      emit(const RequestDetailError(_unexpectedError));
    }
  }

  /// Xabarlarni (thread) alohida yuklaydi — muvaffaqiyatsizlik butun
  /// sahifani xato holatiga aylantirmaydi; `null` qaytadi (bo'sh ro'yxatdan
  /// farqli: chaqiruvchi mavjud xabarlarni saqlab qoladi).
  Future<List<RequestMessage>?> _fetchMessages(String id) async {
    try {
      final result = await _getRequestMessages(GetRequestMessagesParams(id));
      return result.fold<List<RequestMessage>?>((failure) {
        _logger.logError(
          failure,
          StackTrace.current,
          reason: 'RequestDetailCubit._fetchMessages',
        );
        return null;
      }, (messages) => messages);
    } on Object catch (e, stackTrace) {
      _logger.logError(
        e,
        stackTrace,
        reason: 'RequestDetailCubit._fetchMessages',
      );
      return null;
    }
  }

  /// Hal qilingan murojaatni baholaydi (1..5). Xato bo'lsa — xabar matni.
  Future<String?> rate(int rating, {String? comment}) async {
    final id = _lastId;
    if (id == null || state is! RequestDetailLoaded) return null;
    if (_mutating) return _busyMessage;
    _mutating = true;
    try {
      final result = await _repository.rate(id, rating, comment: comment);
      return result.fold<String?>((f) => f.message, (updated) {
        _revision++;
        final latest = state;
        if (!isClosed && latest is RequestDetailLoaded) {
          emit(latest.copyWith(request: updated));
        }
        return null;
      });
    } on Object catch (e, stackTrace) {
      _logger.logError(e, stackTrace, reason: 'RequestDetailCubit.rate');
      return _unexpectedError;
    } finally {
      _mutating = false;
    }
  }

  /// "Muammo hal bo'lmadi" — qayta ochadi; sabab thread'ga yoziladi.
  Future<String?> reopen(String reason) async {
    final id = _lastId;
    if (id == null || state is! RequestDetailLoaded) return null;
    if (_mutating) return _busyMessage;
    _mutating = true;
    try {
      final result = await _repository.reopen(id, reason);
      final updated = result.fold((_) => null, (r) => r);
      if (updated == null) {
        return result.fold<String?>((f) => f.message, (_) => null);
      }
      _revision++;
      final messages = await _fetchMessages(id);
      final latest = state;
      if (!isClosed && latest is RequestDetailLoaded) {
        emit(
          latest.copyWith(
            request: updated,
            messages: messages,
            messagesFailed: messages == null,
          ),
        );
      }
      return null;
    } on Object catch (e, stackTrace) {
      _logger.logError(e, stackTrace, reason: 'RequestDetailCubit.reopen');
      return _unexpectedError;
    } finally {
      _mutating = false;
    }
  }

  /// So'nggi ishlatilgan ID bilan qayta yuklaydi ("Qayta urinish").
  Future<void> retry() {
    final id = _lastId;
    return id == null ? Future<void>.value() : load(id);
  }

  /// Pastga tortib yangilash: murojaat (holat/biriktirmalar) va xabarlar
  /// qayta yuklanadi — sahifa skeletonga qaytmaydi, xatoda mavjud ma'lumot
  /// saqlanadi.
  Future<void> reloadMessages() async {
    final id = _lastId;
    if (id == null || state is! RequestDetailLoaded) return;
    final revision = _revision;
    CitizenRequest? request;
    try {
      final result = await _getCitizenRequest(GetCitizenRequestParams(id));
      request = result.fold((_) => null, (r) => r);
    } on Object catch (e, stackTrace) {
      _logger.logError(e, stackTrace, reason: 'RequestDetailCubit.reload');
    }
    if (isClosed) return;
    final messages = await _fetchMessages(id);
    final latest = state;
    // Yuklash davomida xabar yuborilayotgan bo'lsa — optimistik yozuvni
    // eskirgan ro'yxat bilan ustidan yozmaymiz.
    if (isClosed ||
        latest is! RequestDetailLoaded ||
        latest.sendingMessage ||
        revision != _revision) {
      return;
    }
    if (request != null && request.attachmentsFailed) {
      final old = latest.request;
      if (!old.attachmentsFailed) {
        request = request.copyWith(
          attachments: old.attachments,
          attachmentsFailed: false,
        );
      }
    }
    emit(
      latest.copyWith(
        request: request,
        messages: messages,
        messagesFailed: messages == null,
      ),
    );
  }

  /// [text]ni fuqaro nomidan murojaat thread'iga yuboradi.
  ///
  /// OPTIMISTIK: server javobini kutmasdan, xabar DARHOL (vaqtinchalik ID
  /// bilan) thread oxiriga qo'shiladi — foydalanuvchi "yuborildi" holatini
  /// kutish o'rniga o'z xabarini zudlik bilan ko'radi (`sendingMessage`
  /// esa hali `true`, composer tugmasi loading holatida qoladi).
  /// Muvaffaqiyatli bo'lsa vaqtinchalik xabar serverdan qaytgan haqiqiy
  /// xabar bilan (o'sha o'rinda) almashtiriladi va `null` qaytadi; xatolik
  /// bo'lsa vaqtinchalik xabar ro'yxatdan OLIB TASHLANADI (optimistik
  /// yozuv bekor qilinadi) va foydalanuvchiga ko'rsatsa bo'ladigan xabar
  /// matni qaytadi (sahifa buni `AppAlert.error` bilan ko'rsatadi).
  Future<String?> sendMessage(String text) async {
    final id = _lastId;
    final current = state;
    final trimmed = text.trim();
    if (id == null || current is! RequestDetailLoaded || trimmed.isEmpty) {
      return null;
    }
    // Oldingi xabar hali yuborilmoqda — ikkinchisini parallel yubormaymiz.
    if (current.sendingMessage) return _busyMessage;

    final optimisticId =
        '$_optimisticIdPrefix${DateTime.now().microsecondsSinceEpoch}';
    final optimisticMessage = RequestMessage(
      id: optimisticId,
      senderRole: RequestMessageSenderRole.citizen,
      text: trimmed,
      createdAt: DateTime.now().toIso8601String(),
    );

    _revision++;
    emit(
      current.copyWith(
        sendingMessage: true,
        messages: [...current.messages, optimisticMessage],
      ),
    );

    Either<Failure, RequestMessage> result;
    try {
      result = await _sendRequestMessage(
        SendRequestMessageParams(id: id, text: trimmed),
      );
    } on Object catch (e, stackTrace) {
      _logger.logError(e, stackTrace, reason: 'RequestDetailCubit.sendMessage');
      result = const Left(ServerFailure(_sendFailed));
    }
    // Sahifa yopilgan — natija endi hech kimga ko'rsatilmaydi.
    if (isClosed) return null;

    return result.fold(
      (failure) {
        _logger.logError(
          failure,
          StackTrace.current,
          reason: 'RequestDetailCubit.sendMessage',
        );
        final latest = state;
        if (latest is RequestDetailLoaded) {
          emit(
            latest.copyWith(
              sendingMessage: false,
              messages: latest.messages
                  .where((m) => m.id != optimisticId)
                  .toList(),
            ),
          );
        }
        return failure.message;
      },
      (message) {
        _revision++;
        final latest = state;
        if (latest is RequestDetailLoaded) {
          // Shu orada thread qayta yuklangan bo'lsa (masalan "qayta ochish")
          // optimistik yozuv yo'q — yuborilgan xabar baribir ko'rinsin,
          // lekin ikki marta emas.
          final others = latest.messages.where((m) => m.id != message.id);
          final replaced = [
            for (final m in others)
              if (m.id == optimisticId) message else m,
          ];
          emit(
            latest.copyWith(
              sendingMessage: false,
              messages: replaced.contains(message)
                  ? replaced
                  : [...replaced, message],
            ),
          );
        }
        return null;
      },
    );
  }
}
