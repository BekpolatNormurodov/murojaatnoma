import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/domain/usecases/get_conversations.dart';

part 'chat_list_state.dart';

/// "Chat" tabidagi suhbatlar ro'yxatini boshqaruvchi Cubit.
///
/// Joriy filtrlarni (`type`/`query`) ichida saqlaydi — shu tufayli
/// [reload] (pull-to-refresh yoki suhbatdan qaytgach) parametrsiz
/// chaqirilib, so'nggi ishlatilgan filtrlar bilan qayta so'rov yuboradi.
///
/// `RequestsCubit` bilan bir xil naqsh: hech qachon uncaught tashlamaydi —
/// muvaffaqiyatsizlik har doim [ChatListError] holatiga aylanadi.
class ChatListCubit extends Cubit<ChatListState> {
  ChatListCubit({required GetConversations getConversations})
    : _getConversations = getConversations,
      super(const ChatListLoading());

  final GetConversations _getConversations;

  ConversationType? _type;
  String? _query;

  ConversationType? get type => _type;
  String? get query => _query;

  /// Suhbatlar ro'yxatini (berilgan filtrlar bilan) yuklaydi. Har doim
  /// [ChatListLoading] bilan boshlanadi — tab/qidiruv almashganda ham eski
  /// ro'yxat ustida "muzlab qolgan" holat ko'rinmaydi.
  Future<void> load({ConversationType? type, String? query}) async {
    _type = type;
    _query = query;

    emit(const ChatListLoading());
    try {
      final result = await _getConversations(
        GetConversationsParams(type: type, query: query),
      );
      result.fold((failure) => emit(ChatListError(failure.message)), (items) {
        emit(items.isEmpty ? const ChatListEmpty() : ChatListLoaded(items));
      });
    } on Object catch (e) {
      emit(ChatListError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan filtrlar bilan qayta yuklaydi (pull-to-refresh,
  /// "Qayta urinish" tugmasi, yoki suhbatdan qaytgach — u yerda yuborilgan
  /// xabar ro'yxatdagi oxirgi xabar/vaqtga ta'sir qilgan bo'lishi mumkin).
  Future<void> reload() => load(type: _type, query: _query);
}
