import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';

/// Takliflar (ratsionalizatorlik g'oyalari) moduli uchun xotiradagi soxta
/// (mock) "backend" holati.
///
/// `SuggestionsRemoteDataSourceMockImpl` shu ro'yxatni o'qiydi/yozadi —
/// `AppConfig.useMock` `true` bo'lganda haqiqiy backend o'rnini bosadi.
/// `mock_applications.dart`dagi uslubga o'xshash: modul darajasidagi,
/// mutable (`final` bog'lovchi, o'zgaruvchan ro'yxat) — ilova ishlab
/// turgan davrda xotirada saqlanadi, restart'da boshlang'ich holatga
/// qaytadi.
final List<Suggestion> mockSuggestions = [
  const Suggestion(
    id: 'TKL-1',
    title: 'Elektron navbat tizimini joriy etish',
    body:
        'Fuqarolar qabulxonada jismoniy navbat kutmasligi uchun '
        "elektron navbat (talon) tizimini o'rnatishni taklif qilaman.",
    category: 'Raqamlashtirish',
    status: SuggestionStatus.qabulQilindi,
    createdAt: '2026-07-10T09:00:00',
    votes: 24,
  ),
  const Suggestion(
    id: 'TKL-2',
    title: 'Ichki hujjat aylanishini soddalashtirish',
    body:
        "Ayrim ma'lumotnomalar uchun bir necha bo'limdan imzo yig'ish "
        "o'rniga yagona elektron tasdiqlash zanjirini joriy qilish.",
    category: 'Ish jarayoni',
    status: SuggestionStatus.korilmoqda,
    createdAt: '2026-07-15T14:20:00',
    votes: 17,
  ),
  const Suggestion(
    id: 'TKL-3',
    title: "Xodimlar uchun onlayn o'quv kurslari",
    body:
        'Malaka oshirish uchun ish vaqtida qisqa onlayn video-darslar '
        'platformasini joriy etishni taklif qilaman.',
    category: 'Ijtimoiy',
    status: SuggestionStatus.yangi,
    createdAt: '2026-07-22T10:30:00',
    votes: 9,
  ),
  const Suggestion(
    id: 'TKL-4',
    title: 'Devonxona uchun mobil ilova bildirishnomalari',
    body:
        'Yangi murojaat kelganda xodimga push-bildirishnoma yuborilsa, '
        'javob berish tezligi oshadi.',
    category: 'Raqamlashtirish',
    status: SuggestionStatus.qabulQilindi,
    createdAt: '2026-07-08T11:00:00',
    votes: 31,
  ),
  const Suggestion(
    id: 'TKL-5',
    title: 'Bayramona kunlarda moslashuvchan ish jadvali',
    body:
        'Milliy bayramlar arafasida xodimlar uchun moslashuvchan (erkin) '
        'ish jadvalini joriy etishni taklif qilaman.',
    category: 'Ijtimoiy',
    status: SuggestionStatus.rad,
    createdAt: '2026-06-28T16:45:00',
    votes: 6,
  ),
  const Suggestion(
    id: 'TKL-6',
    title: 'Umumiy foydalanish xonalarida suv filtri',
    body:
        'Ish binosining har qavatida ichimlik suvi filtrlarini '
        "o'rnatishni taklif qilaman.",
    category: 'Infratuzilma',
    status: SuggestionStatus.korilmoqda,
    createdAt: '2026-07-20T08:15:00',
    votes: 13,
  ),
];
