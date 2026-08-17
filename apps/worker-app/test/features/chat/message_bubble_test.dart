import 'package:app_core/app_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/widgets/message_bubble.dart';

/// Yengil "smoke" test — [MessageBubble]ning HAR bir [MessageType]si (mening
/// va boshqaning) minimal `MaterialApp` + `AppLocalizations` delegatlari
/// ichida hech qanday istisnosiz (overflow/null-rang) render bo'lishini
/// tekshiradi. Bu premium qayta-dizayndagi kontent-rang/overflow ishini
/// himoya qiladi (mantiq testlari alohida cubit/repository testlarida).
///
/// Haqiqiy faylga muhtoj turlar (rasm/doiraviy video/ovoz) testda `mock://`
/// yoki bo'sh yo'l bilan beriladi — `NetworkThumbnail` shunda tarmoqqa
/// tegmay silliq placeholder ko'rsatadi, ovoz pleeri esa faqat bosilganda
/// (lazy) ochiladi.
Message _message({required MessageType type, required bool isMine}) {
  return Message(
    id: 'M-${type.name}-$isMine',
    conversationId: 'C-1',
    senderId: isMine ? 'me' : 'other',
    senderName: isMine ? 'Men' : 'Sardor Karimov',
    isMine: isMine,
    type: type,
    createdAt: '2026-07-24T08:15:00',
    status: isMine ? MessageStatus.oqildi : MessageStatus.yetkazildi,
    text: type == MessageType.text
        ? 'Assalomu alaykum, hurmatli fuqaro!'
        : null,
    stickerId: type == MessageType.sticker ? 'smile' : null,
    attachment: switch (type) {
      MessageType.image => const ChatAttachment(
        kind: MessageType.image,
        path: '',
      ),
      MessageType.file => const ChatAttachment(
        kind: MessageType.file,
        path: 'mock://file/1',
        name: 'Hujjat.pdf',
        sizeBytes: 128000,
      ),
      MessageType.voice => const ChatAttachment(
        kind: MessageType.voice,
        path: 'mock://voice/1',
        durationMs: 4000,
      ),
      MessageType.roundVideo => const ChatAttachment(
        kind: MessageType.roundVideo,
        path: '',
        durationMs: 6000,
      ),
      MessageType.text || MessageType.sticker => null,
    },
  );
}

Future<void> _pumpBubble(WidgetTester tester, Widget child) {
  return tester.pumpWidget(
    MaterialApp(
      locale: const Locale('uz'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: SingleChildScrollView(child: child)),
    ),
  );
}

void main() {
  group('MessageBubble renders every type without throwing', () {
    for (final type in MessageType.values) {
      for (final isMine in const [true, false]) {
        testWidgets('${type.name} (mine=$isMine)', (tester) async {
          await _pumpBubble(
            tester,
            MessageBubble(
              message: _message(type: type, isMine: isMine),
              showSenderName: !isMine && type != MessageType.text,
            ),
          );
          // Bitta kadr — tarmoq/animatsiya timer'larini kutmaymiz.
          await tester.pump();
          expect(tester.takeException(), isNull);
        });
      }
    }
  });
}
