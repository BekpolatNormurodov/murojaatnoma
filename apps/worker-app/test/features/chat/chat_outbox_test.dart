import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/realtime/uploads_service.dart';
import 'package:worker_app/features/chat/data/chat_outbox.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/domain/usecases/send_message.dart';

class _MockSend extends Mock implements SendMessage {}

class _MockUploads extends Mock implements UploadsService {}

class _FakeParams extends Fake implements SendMessageParams {}

Message _sent(String id) => Message(
  id: id,
  conversationId: 'dm-emp-1',
  senderId: 'e1',
  senderName: 'Siz',
  isMine: true,
  type: MessageType.text,
  text: 'salom',
  createdAt: '2026-10-01T10:00:00Z',
  status: MessageStatus.yuborildi,
);

OutboxItem _item(String id) => OutboxItem(
  localId: id,
  conversationId: 'dm-emp-1',
  type: MessageType.text,
  createdAt: '2026-10-01T10:00:00Z',
  text: 'salom',
);

void main() {
  setUpAll(() => registerFallbackValue(_FakeParams()));
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('a failed send is persisted, survives, and is delivered by flush', () async {
    final send = _MockSend();
    var online = false;
    when(() => send(any())).thenAnswer(
      (_) async => online
          ? Right(_sent('srv-1'))
          : const Left(ServerFailure("Internetga ulanib bo'lmadi")),
    );
    final outbox = ChatOutbox(send, _MockUploads());

    final first = await outbox.deliver(_item('L1'));
    expect(first.sent, isNull);
    expect(await outbox.pendingFor('dm-emp-1'), hasLength(1));

    // A NEW outbox instance (= app restart) still sees it.
    final afterRestart = ChatOutbox(send, _MockUploads());
    expect((await afterRestart.pendingFor('dm-emp-1')).single.text, 'salom');

    online = true;
    final results = <OutboxResult>[];
    afterRestart.results.listen(results.add);
    await afterRestart.flush();
    await Future<void>.delayed(Duration.zero);
    expect(results.single.sent?.id, 'srv-1');
    expect(await afterRestart.pendingFor('dm-emp-1'), isEmpty);
  });

  test('concurrent delivery of the same item is sent once', () async {
    final send = _MockSend();
    when(() => send(any())).thenAnswer((_) async {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return Right(_sent('srv-2'));
    });
    final outbox = ChatOutbox(send, _MockUploads());
    await Future.wait([outbox.deliver(_item('L2')), outbox.deliver(_item('L2'))]);
    verify(() => send(any())).called(1);
  });
}
