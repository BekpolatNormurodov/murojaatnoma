import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/domain/repositories/chat_repository.dart';
import 'package:worker_app/features/chat/domain/usecases/get_conversations.dart';
import 'package:worker_app/features/chat/presentation/bloc/chat_list_cubit.dart';

/// Xotirada ishlaydigan soxta repository — `_FakeApplicationsRepository`
/// (`requests_cubit_test.dart`) va `_FakeAttendanceRepository`
/// (`check_in_test.dart`) uslubiga mos: fake REPOSITORY + haqiqiy
/// USECASE (`GetConversations`) — bu qatlamlar orasidagi shartnomani ham
/// (repository interfeysi) sinaydi.
class _FakeChatRepository implements ChatRepository {
  Either<Failure, List<Conversation>> conversationsResult = const Right([]);

  @override
  Future<Either<Failure, List<Conversation>>> conversations({
    ConversationType? type,
    String? query,
  }) async => conversationsResult;

  @override
  Future<Either<Failure, List<Message>>> messages(String conversationId) {
    throw UnimplementedError('ChatListCubit does not call messages');
  }

  @override
  Future<Either<Failure, Message>> sendMessage({
    required String conversationId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) {
    throw UnimplementedError('ChatListCubit does not call sendMessage');
  }
}

const _conversation = Conversation(
  id: 'CHT-9001',
  type: ConversationType.shaxsiy,
  title: 'Sinov suhbati',
  participants: 2,
  lastMessagePreview: 'Salom',
  lastMessageAt: '2026-07-24T08:00:00',
  unreadCount: 2,
);

void main() {
  group(ChatListCubit, () {
    late _FakeChatRepository repository;

    ChatListCubit buildCubit() =>
        ChatListCubit(getConversations: GetConversations(repository));

    setUp(() {
      repository = _FakeChatRepository();
    });

    test('initial state is loading (never a blank/white screen)', () {
      expect(buildCubit().state, const ChatListLoading());
    });

    blocTest<ChatListCubit, ChatListState>(
      'load() returns conversations -> emits ChatListLoaded',
      setUp: () =>
          repository.conversationsResult = const Right([_conversation]),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [
        const ChatListLoading(),
        const ChatListLoaded([_conversation]),
      ],
    );

    blocTest<ChatListCubit, ChatListState>(
      'load() returns an empty list -> emits ChatListEmpty',
      setUp: () => repository.conversationsResult = const Right([]),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [const ChatListLoading(), const ChatListEmpty()],
    );

    blocTest<ChatListCubit, ChatListState>(
      'load() returns Left(Failure) -> emits ChatListError with the '
      "failure's message (never uncaught)",
      setUp: () => repository.conversationsResult = const Left(
        ServerFailure('tarmoq xatosi'),
      ),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [
        const ChatListLoading(),
        const ChatListError('tarmoq xatosi'),
      ],
    );

    blocTest<ChatListCubit, ChatListState>(
      'load() forwards type/query to the repository and reload() replays '
      'the last-used filters',
      setUp: () =>
          repository.conversationsResult = const Right([_conversation]),
      build: buildCubit,
      act: (c) async {
        await c.load(type: ConversationType.shaxsiy, query: 'sardor');
        await c.reload();
      },
      expect: () => [
        const ChatListLoading(),
        const ChatListLoaded([_conversation]),
        const ChatListLoading(),
        const ChatListLoaded([_conversation]),
      ],
      verify: (c) {
        expect(c.type, ConversationType.shaxsiy);
        expect(c.query, 'sardor');
      },
    );
  });
}
