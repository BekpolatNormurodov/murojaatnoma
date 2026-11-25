import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/home/presentation/bloc/home_cubit.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/usecases/get_utilities.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/entities/request_message.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_request.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_requests.dart';
import 'package:user_app/features/requests/domain/usecases/get_request_messages.dart';
import 'package:user_app/features/requests/domain/usecases/send_request_message.dart';
import 'package:user_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:user_app/features/requests/presentation/bloc/requests_cubit.dart';

class _Repo extends Mock implements CitizenRequestsRepository {}

class _GetUtilities extends Mock implements GetUtilities {}

CitizenRequest _request(RequestKind kind) => CitizenRequest(
  id: kind.name,
  kind: kind,
  category: 'c',
  title: kind.name,
  body: 'b',
  status: RequestStatus.yuborilgan,
  createdAt: '2026-11-01T10:00:00',
);

void main() {
  setUpAll(() => registerFallbackValue(const NoParams()));

  test('a slow older filter cannot overwrite the newer one', () async {
    final repo = _Repo();
    final slow = Completer<Either<Failure, List<CitizenRequest>>>();
    when(
      () => repo.list(kind: RequestKind.ariza),
    ).thenAnswer((_) => slow.future);
    when(
      () => repo.list(kind: RequestKind.shikoyat),
    ).thenAnswer((_) async => Right([_request(RequestKind.shikoyat)]));
    final cubit = RequestsCubit(getCitizenRequests: GetCitizenRequests(repo));
    addTearDown(cubit.close);

    final first = cubit.load(kind: RequestKind.ariza);
    await cubit.load(kind: RequestKind.shikoyat);
    slow.complete(Right([_request(RequestKind.ariza)]));
    await first;

    expect(
      (cubit.state as RequestsLoaded).items.single.kind,
      RequestKind.shikoyat,
    );
  });

  test('a load finishing after close does not throw', () async {
    final repo = _Repo();
    final slow = Completer<Either<Failure, List<CitizenRequest>>>();
    when(
      () => repo.list(kind: RequestKind.ariza),
    ).thenAnswer((_) => slow.future);
    final cubit = RequestsCubit(getCitizenRequests: GetCitizenRequests(repo));

    final load = cubit.load(kind: RequestKind.ariza);
    await cubit.close();
    slow.complete(const Right([]));

    await expectLater(load, completes);
  });

  test("reset drops the previous citizen's in-flight utilities", () async {
    final getUtilities = _GetUtilities();
    final slow = Completer<Either<Failure, List<Utility>>>();
    when(() => getUtilities(any())).thenAnswer((_) => slow.future);
    final cubit = HomeCubit(getUtilities: getUtilities);
    addTearDown(cubit.close);

    final load = cubit.load();
    cubit.reset();
    slow.complete(const Right([]));
    await load;

    expect(cubit.state, const HomeLoading());
  });

  group('RequestDetailCubit refresh races', () {
    final sent = RequestMessage(
      id: 'm2',
      senderRole: RequestMessageSenderRole.citizen,
      text: 'yangi',
      createdAt: '2026-11-01T11:00:00',
    );

    Future<(_Repo, RequestDetailCubit)> loaded() async {
      final repo = _Repo();
      when(
        () => repo.getById('a'),
      ).thenAnswer((_) async => Right(_request(RequestKind.ariza)));
      when(
        () => repo.getMessages('a'),
      ).thenAnswer((_) async => const Right([]));
      when(
        () => repo.sendMessage('a', 'yangi'),
      ).thenAnswer((_) async => Right(sent));
      final cubit = RequestDetailCubit(
        getCitizenRequest: GetCitizenRequest(repo),
        getRequestMessages: GetRequestMessages(repo),
        sendRequestMessage: SendRequestMessage(repo),
        repository: repo,
      );
      addTearDown(cubit.close);
      await cubit.load('a');
      return (repo, cubit);
    }

    test(
      'a refresh started before sending cannot erase the sent message',
      () async {
        final (repo, cubit) = await loaded();
        final stale = Completer<Either<Failure, List<RequestMessage>>>();
        when(() => repo.getMessages('a')).thenAnswer((_) => stale.future);

        final refresh = cubit.reloadMessages();
        await Future<void>.delayed(Duration.zero);
        await cubit.sendMessage('yangi');
        stale.complete(const Right([]));
        await refresh;

        expect((cubit.state as RequestDetailLoaded).messages, [sent]);
      },
    );

    test(
      'a message confirmed after the thread was replaced still shows once',
      () async {
        final (repo, cubit) = await loaded();
        final send = Completer<Either<Failure, RequestMessage>>();
        when(
          () => repo.sendMessage('a', 'yangi'),
        ).thenAnswer((_) => send.future);
        when(
          () => repo.reopen('a', 'sabab'),
        ).thenAnswer((_) async => Right(_request(RequestKind.ariza)));

        final sending = cubit.sendMessage('yangi');
        await cubit.reopen('sabab'); // ro'yxat optimistik yozuvsiz keladi
        send.complete(Right(sent));
        await sending;

        final state = cubit.state as RequestDetailLoaded;
        expect(state.messages, [sent]);
        expect(state.sendingMessage, isFalse);
      },
    );
  });

  test('a failed refresh keeps the thread and flags the error', () async {
    final repo = _Repo();
    final message = RequestMessage(
      id: 'm1',
      senderRole: RequestMessageSenderRole.citizen,
      text: 'salom',
      createdAt: '2026-11-01T10:00:00',
    );
    when(
      () => repo.getById('a'),
    ).thenAnswer((_) async => Right(_request(RequestKind.ariza)));
    when(() => repo.getMessages('a')).thenAnswer((_) async => Right([message]));
    final cubit = RequestDetailCubit(
      getCitizenRequest: GetCitizenRequest(repo),
      getRequestMessages: GetRequestMessages(repo),
      sendRequestMessage: SendRequestMessage(repo),
      repository: repo,
    );
    addTearDown(cubit.close);
    await cubit.load('a');

    when(
      () => repo.getMessages('a'),
    ).thenAnswer((_) async => const Left(ServerFailure('500')));
    await cubit.reloadMessages();

    final state = cubit.state as RequestDetailLoaded;
    expect(state.messages, [message]);
    expect(state.messagesFailed, isTrue);
  });
}
