import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';

/// Xabarlar (chat) moduli uchun xotiradagi soxta (mock) "backend" holati.
///
/// `ChatRemoteDataSourceMockImpl` shu ro'yxatlarni o'qiydi/yozadi —
/// `AppConfig.useMock` `true` bo'lganda haqiqiy backend o'rnini bosadi.
/// `mock_applications.dart`dagi uslubga o'xshash: modul darajasidagi,
/// mutable (`final` bog'lovchi, o'zgaruvchan ro'yxat) — ilova ishlab
/// turgan davrda xotirada saqlanadi, restart'da boshlang'ich holatga
/// qaytadi. `mockMessages` bitta tekis ro'yxat — har bir `Message`
/// o'zining `conversationId`si orqali suhbatga bog'lanadi.
final List<Conversation> mockConversations = [
  const Conversation(
    id: 'CHT-1',
    type: ConversationType.umumiy,
    title: "Hokimiyat e'lonlari",
    participants: 320,
    lastMessagePreview: 'Rasm',
    lastMessageAt: '2026-07-24T08:05:00',
    unreadCount: 3,
  ),
  const Conversation(
    id: 'CHT-2',
    type: ConversationType.shaxsiy,
    title: 'Sardor Aliyev',
    avatarUrl: 'https://mock.cdn/avatars/sardor.jpg',
    participants: 2,
    lastMessagePreview: 'Ovozli xabar',
    lastMessageAt: '2026-07-23T17:22:00',
    unreadCount: 0,
  ),
  const Conversation(
    id: 'CHT-3',
    type: ConversationType.guruh,
    title: 'Devon xodimlari',
    participants: 12,
    lastMessagePreview: 'Anvar Qodirov: Rahmat, tushundim.',
    lastMessageAt: '2026-07-24T10:15:00',
    unreadCount: 5,
  ),
  const Conversation(
    id: 'CHT-4',
    type: ConversationType.shaxsiy,
    title: 'Dilshod Rahimov',
    avatarUrl: 'https://mock.cdn/avatars/dilshod.jpg',
    participants: 2,
    lastMessagePreview: 'Video xabar',
    lastMessageAt: '2026-07-24T11:00:00',
    unreadCount: 1,
  ),
  const Conversation(
    id: 'CHT-5',
    type: ConversationType.guruh,
    title: 'Loyiha guruhi - Obodonlashtirish',
    participants: 8,
    lastMessagePreview: "Ko'rib chiqing, savol bo'lsa yozing.",
    lastMessageAt: '2026-07-22T15:41:00',
    unreadCount: 0,
  ),
];

final List<Message> mockMessages = [
  // CHT-1 — umumiy kanal (e'lonlar).
  const Message(
    id: 'MSG-1',
    conversationId: 'CHT-1',
    senderId: 'ADM-1',
    senderName: "Ma'muriyat",
    isMine: false,
    type: MessageType.text,
    text:
        "Hurmatli xodimlar, ertaga soat 09:00 da umumiy yig'ilish "
        "bo'ladi, barchaning ishtiroki majburiy.",
    createdAt: '2026-07-24T08:00:00',
    status: MessageStatus.yetkazildi,
  ),
  const Message(
    id: 'MSG-2',
    conversationId: 'CHT-1',
    senderId: 'ADM-1',
    senderName: "Ma'muriyat",
    isMine: false,
    type: MessageType.image,
    attachment: ChatAttachment(
      kind: MessageType.image,
      path: 'https://mock.cdn/chat/CHT-1/yigilish_reja.jpg',
      name: 'yigilish_reja.jpg',
      sizeBytes: 204800,
    ),
    createdAt: '2026-07-24T08:05:00',
    status: MessageStatus.yetkazildi,
  ),

  // CHT-2 — shaxsiy (rahbar bilan).
  const Message(
    id: 'MSG-3',
    conversationId: 'CHT-2',
    senderId: 'USR-77',
    senderName: 'Sardor Aliyev',
    isMine: false,
    type: MessageType.text,
    text: 'Kunlik hisobotni tayyorladingizmi?',
    createdAt: '2026-07-23T17:10:00',
    status: MessageStatus.oqildi,
  ),
  const Message(
    id: 'MSG-4',
    conversationId: 'CHT-2',
    senderId: 'me',
    senderName: 'Siz',
    isMine: true,
    type: MessageType.text,
    text: "Xo'p bo'ladi, hisobotni bugun kechqurun yuboraman.",
    createdAt: '2026-07-23T17:20:00',
    status: MessageStatus.oqildi,
  ),
  const Message(
    id: 'MSG-5',
    conversationId: 'CHT-2',
    senderId: 'me',
    senderName: 'Siz',
    isMine: true,
    type: MessageType.voice,
    attachment: ChatAttachment(
      kind: MessageType.voice,
      path: 'https://mock.cdn/chat/CHT-2/izoh.m4a',
      name: 'izoh.m4a',
      durationMs: 18000,
      sizeBytes: 96000,
    ),
    createdAt: '2026-07-23T17:22:00',
    status: MessageStatus.yetkazildi,
  ),

  // CHT-3 — guruh (devon xodimlari).
  const Message(
    id: 'MSG-6',
    conversationId: 'CHT-3',
    senderId: 'USR-12',
    senderName: 'Malika Yusupova',
    isMine: false,
    type: MessageType.text,
    text:
        'Assalomu alaykum, bugungi majlis bekor qilindi, '
        "ertaga o'tkaziladi.",
    createdAt: '2026-07-24T09:00:00',
    status: MessageStatus.yetkazildi,
  ),
  const Message(
    id: 'MSG-7',
    conversationId: 'CHT-3',
    senderId: 'USR-30',
    senderName: 'Anvar Qodirov',
    isMine: false,
    type: MessageType.sticker,
    stickerId: 'ok_thumb',
    createdAt: '2026-07-24T09:02:00',
    status: MessageStatus.yetkazildi,
  ),
  const Message(
    id: 'MSG-8',
    conversationId: 'CHT-3',
    senderId: 'me',
    senderName: 'Siz',
    isMine: true,
    type: MessageType.text,
    text: 'Tushunarli, rahmat xabar uchun.',
    createdAt: '2026-07-24T09:05:00',
    status: MessageStatus.oqildi,
  ),
  const Message(
    id: 'MSG-9',
    conversationId: 'CHT-3',
    senderId: 'USR-30',
    senderName: 'Anvar Qodirov',
    isMine: false,
    type: MessageType.text,
    text: 'Rahmat, tushundim.',
    createdAt: '2026-07-24T10:15:00',
    status: MessageStatus.yetkazildi,
  ),

  // CHT-4 — shaxsiy (hamkasb bilan, doiraviy video xabar).
  const Message(
    id: 'MSG-10',
    conversationId: 'CHT-4',
    senderId: 'USR-45',
    senderName: 'Dilshod Rahimov',
    isMine: false,
    type: MessageType.text,
    text: "Salom! Ertangi tekshiruv vaqti o'zgardimi?",
    createdAt: '2026-07-24T10:55:00',
    status: MessageStatus.yetkazildi,
  ),
  const Message(
    id: 'MSG-11',
    conversationId: 'CHT-4',
    senderId: 'USR-45',
    senderName: 'Dilshod Rahimov',
    isMine: false,
    type: MessageType.roundVideo,
    attachment: ChatAttachment(
      kind: MessageType.roundVideo,
      path: 'https://mock.cdn/chat/CHT-4/video_xabar.mp4',
      name: 'video_xabar.mp4',
      durationMs: 12000,
      sizeBytes: 1048576,
    ),
    createdAt: '2026-07-24T11:00:00',
    status: MessageStatus.yetkazildi,
  ),

  // CHT-5 — guruh (loyiha, fayl biriktirma).
  const Message(
    id: 'MSG-12',
    conversationId: 'CHT-5',
    senderId: 'USR-8',
    senderName: 'Kamola Nurova',
    isMine: false,
    type: MessageType.text,
    text: "Obodonlashtirish smetasi tayyor bo'ldimi?",
    createdAt: '2026-07-22T15:00:00',
    status: MessageStatus.oqildi,
  ),
  const Message(
    id: 'MSG-13',
    conversationId: 'CHT-5',
    senderId: 'me',
    senderName: 'Siz',
    isMine: true,
    type: MessageType.text,
    text: 'Ha, biroz kuting, hozir yuboraman.',
    createdAt: '2026-07-22T15:30:00',
    status: MessageStatus.oqildi,
  ),
  const Message(
    id: 'MSG-14',
    conversationId: 'CHT-5',
    senderId: 'me',
    senderName: 'Siz',
    isMine: true,
    type: MessageType.file,
    attachment: ChatAttachment(
      kind: MessageType.file,
      path: 'https://mock.cdn/chat/CHT-5/smeta_hisobot.pdf',
      name: 'smeta_hisobot.pdf',
      sizeBytes: 358400,
    ),
    createdAt: '2026-07-22T15:40:00',
    status: MessageStatus.yuborildi,
  ),
  const Message(
    id: 'MSG-15',
    conversationId: 'CHT-5',
    senderId: 'me',
    senderName: 'Siz',
    isMine: true,
    type: MessageType.text,
    text: "Ko'rib chiqing, savol bo'lsa yozing.",
    createdAt: '2026-07-22T15:41:00',
    status: MessageStatus.yuborilmoqda,
  ),
];
