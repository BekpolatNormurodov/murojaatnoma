import 'package:worker_app/features/meetings/domain/entities/meeting.dart';

/// Majlislar (yig'ilishlar) moduli uchun xotiradagi soxta (mock) "backend"
/// holati.
///
/// `MeetingsRemoteDataSourceMockImpl` shu ro'yxatni o'qiydi/yozadi —
/// `AppConfig.useMock` `true` bo'lganda haqiqiy backend o'rnini bosadi.
/// `mock_applications.dart`dagi uslubga o'xshash: modul darajasidagi,
/// mutable (`final` bog'lovchi, o'zgaruvchan ro'yxat) — ilova ishlab
/// turgan davrda xotirada saqlanadi, restart'da boshlang'ich holatga
/// qaytadi.
final List<Meeting> mockMeetings = [
  const Meeting(
    id: 'MTG-1',
    title: "Haftalik yig'ilish",
    description: 'Haftalik ish rejasi va bajarilgan vazifalar muhokamasi.',
    startAt: '2026-07-28T09:00:00',
    durationMin: 60,
    host: 'Sardor Aliyev',
    participants: [
      'Sardor Aliyev',
      'Malika Yusupova',
      'Anvar Qodirov',
      'Dilshod Rahimov',
      'Kamola Nurova',
    ],
    status: MeetingStatus.rejalashtirilgan,
    joinUrl: 'https://meet.hokimiyat.uz/MTG-1',
  ),
  const Meeting(
    id: 'MTG-2',
    title: 'Byudjet muhokamasi',
    description: "Joriy chorak byudjet ijrosi bo'yicha hisobot.",
    startAt: '2026-07-24T11:00:00',
    durationMin: 45,
    host: 'Malika Yusupova',
    participants: ['Malika Yusupova', 'Sardor Aliyev', 'Otabek Sodiqov'],
    status: MeetingStatus.jonli,
    joinUrl: 'https://meet.hokimiyat.uz/MTG-2',
  ),
  const Meeting(
    id: 'MTG-3',
    title: "Oylik hisobot yig'ilishi",
    description:
        "O'tgan oy davomida bajarilgan ishlar bo'yicha yakuniy hisobot.",
    startAt: '2026-07-20T10:00:00',
    durationMin: 90,
    host: 'Anvar Qodirov',
    participants: ['Anvar Qodirov', 'Dilshod Rahimov', 'Zarina Abdullayeva'],
    status: MeetingStatus.tugagan,
  ),
  const Meeting(
    id: 'MTG-4',
    title: 'Loyihalarni muvofiqlashtirish',
    startAt: '2026-07-29T14:30:00',
    durationMin: 30,
    host: 'Dilshod Rahimov',
    participants: ['Dilshod Rahimov', 'Kamola Nurova'],
    status: MeetingStatus.rejalashtirilgan,
    joinUrl: 'https://meet.hokimiyat.uz/MTG-4',
  ),
  const Meeting(
    id: 'MTG-5',
    title: 'Favqulodda kengash',
    description: "Kommunal avariya bo'yicha shoshilinch muhokama.",
    startAt: '2026-07-24T13:15:00',
    durationMin: 20,
    host: 'Otabek Sodiqov',
    participants: ['Otabek Sodiqov', 'Sardor Aliyev', 'Jasur Mirzayev'],
    status: MeetingStatus.jonli,
    joinUrl: 'https://meet.hokimiyat.uz/MTG-5',
  ),
  const Meeting(
    id: 'MTG-6',
    title: 'Choraklik natijalar taqdimoti',
    description: 'Chorak yakunlari va keyingi davr rejalari.',
    startAt: '2026-07-10T09:30:00',
    durationMin: 75,
    host: 'Sardor Aliyev',
    participants: [
      'Sardor Aliyev',
      'Malika Yusupova',
      'Anvar Qodirov',
      'Zarina Abdullayeva',
    ],
    status: MeetingStatus.tugagan,
  ),
];
