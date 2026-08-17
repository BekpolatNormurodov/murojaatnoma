import 'package:user_app/features/requests/domain/entities/citizen_request.dart';

/// Fuqaro arizalari/shikoyatlari uchun xotiradagi soxta (mock) "backend"
/// holati.
///
/// `CitizenRequestsRemoteDataSourceMockImpl` shu ro'yxatni o'qiydi/yozadi —
/// `AppConfig.useMock` `true` bo'lganda haqiqiy backend o'rnini bosadi.
/// `mock_payments.dart`/`mock_applications.dart`dagi uslubga o'xshash:
/// modul darajasidagi, mutable (`final` bog'lovchi, o'zgaruvchan ro'yxat) —
/// ilova ishlab turgan davrda xotirada saqlanadi, restart'da boshlang'ich
/// holatga qaytadi. Eng yangisi ro'yxat BOSHIDA.
final List<CitizenRequest> mockCitizenRequests = [
  const CitizenRequest(
    id: 'CR-1008',
    kind: RequestKind.shikoyat,
    category: 'Sanitariya',
    title: "Chiqindi konteynerlari vaqtida bo'shatilmayapti",
    body:
        'Bizning hududda chiqindi konteynerlari bir haftadan beri '
        "bo'shatilmagan, atrof ifloslanmoqda. Iltimos, tezroq chora "
        "ko'ring.",
    status: RequestStatus.yuborilgan,
    createdAt: '2026-07-23T07:50:00',
  ),
  const CitizenRequest(
    id: 'CR-1001',
    kind: RequestKind.ariza,
    category: "Ma'lumotnoma",
    title: "Oilaviy holat haqida ma'lumotnoma olish",
    body:
        'Bank kredit olish uchun oilaviy holatim haqida rasmiy '
        "ma'lumotnoma kerak. Iltimos, tez orada tayyorlab bering.",
    status: RequestStatus.yuborilgan,
    createdAt: '2026-07-22T09:15:00',
  ),
  const CitizenRequest(
    id: 'CR-1002',
    kind: RequestKind.shikoyat,
    category: "Yo'l xo'jaligi",
    title: "Mahalla ko'chasida katta chuqur bor",
    body:
        "Bizning ko'chamizda (Bog'bon ko'chasi, 14-uy oldida) asfaltda "
        "katta chuqur paydo bo'lgan, mashinalar zarar ko'rmoqda. "
        "Tuzatishni so'rayman.",
    status: RequestStatus.korilmoqda,
    createdAt: '2026-07-19T14:30:00',
    attachments: [
      RequestAttachment(
        type: RequestAttachmentType.image,
        path: 'mock://image/pothole.jpg',
        name: 'Chuqurlik_rasm.jpg',
        sizeBytes: 245000,
      ),
    ],
  ),
  const CitizenRequest(
    id: 'CR-1007',
    kind: RequestKind.ariza,
    category: "Ta'lim",
    title: "Bolalar bog'chasiga navbat",
    body:
        "3 yoshli farzandimni tuman bog'chalaridan biriga navbatga "
        "qo'yishni so'rayman.",
    status: RequestStatus.korilmoqda,
    createdAt: '2026-07-18T13:20:00',
  ),
  const CitizenRequest(
    id: 'CR-1004',
    kind: RequestKind.shikoyat,
    category: 'Kommunal xizmat',
    title: "3 kundan beri hovlimizda suv yo'q",
    body:
        'Chilonzor tumani, 5-mavze hududida uch kundan beri sovuq suv '
        "kelmayapti. Muammoni hal qilishni so'rayman.",
    status: RequestStatus.javobBerildi,
    createdAt: '2026-07-15T08:45:00',
    response: CitizenRequestResponse(
      text:
          "Muammo suv tarmog'idagi avariya sababli yuzaga kelgan. "
          "Ta'mirlash ishlari yakunlandi, suv ta'minoti tiklandi.",
      respondedAt: '2026-07-16T12:00:00',
    ),
  ),
  const CitizenRequest(
    id: 'CR-1003',
    kind: RequestKind.ariza,
    category: 'Ijtimoiy yordam',
    title: "Kam ta'minlangan oila uchun ijtimoiy nafaqa",
    body:
        "Oilamiz kam ta'minlangan sifatida ro'yxatga olinishi va nafaqa "
        "tayinlanishini so'rayman. Hujjatlar ilova qilindi.",
    status: RequestStatus.javobBerildi,
    createdAt: '2026-07-10T10:00:00',
    response: CitizenRequestResponse(
      text:
          "Arizangiz ko'rib chiqildi. Hujjatlaringiz tasdiqlandi, nafaqa "
          'avgust oyidan boshlab tayinlanadi.',
      respondedAt: '2026-07-14T16:20:00',
    ),
  ),
  const CitizenRequest(
    id: 'CR-1005',
    kind: RequestKind.ariza,
    category: 'Qurilish',
    title: 'Uy qurilishi uchun ruxsatnoma',
    body:
        "Hovlimizga qo'shimcha xona qurish uchun ruxsatnoma olishni "
        "so'rayman. Loyiha hujjatlari biriktirilgan.",
    status: RequestStatus.yopildi,
    createdAt: '2026-06-28T11:00:00',
    response: CitizenRequestResponse(
      text: 'Ruxsatnoma rasmiylashtirildi va sizga topshirildi.',
      respondedAt: '2026-07-02T09:30:00',
    ),
    attachments: [
      RequestAttachment(
        type: RequestAttachmentType.file,
        path: 'mock://file/loyiha.pdf',
        name: 'Loyiha_hujjati.pdf',
        sizeBytes: 512000,
      ),
    ],
  ),
  const CitizenRequest(
    id: 'CR-1006',
    kind: RequestKind.shikoyat,
    category: 'Jamoat tartibi',
    title: 'Kechqurun hovlida shovqin',
    body:
        "Qo'shni hovlida har kuni kech soat 23:00 dan keyin baland "
        'musiqa yoqilib, tinchlik buzilmoqda.',
    status: RequestStatus.yopildi,
    createdAt: '2026-06-20T20:10:00',
    response: CitizenRequestResponse(
      text:
          "Fuqaro bilan suhbat o'tkazildi, ogohlantirish berildi. "
          'Muammo bartaraf etildi.',
      respondedAt: '2026-06-25T15:00:00',
    ),
  ),
];
