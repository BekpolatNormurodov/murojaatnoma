import 'package:worker_app/features/requests/domain/entities/application.dart';

/// Track D: fuqarolar murojaatlari (arizalar) uchun xotiradagi soxta
/// (mock) "backend" holati.
///
/// `ApplicationsRemoteDataSourceMockImpl` shu ro'yxatni o'qiydi/yozadi —
/// `AppConfig.useMock` `true` bo'lganda haqiqiy backend o'rnini bosadi.
/// `mock_attendance.dart`dagi uslubga o'xshash: modul darajasidagi,
/// mutable (`final` bog'lovchi, o'zgaruvchan ro'yxat) — ilova ishlab
/// turgan davrda xotirada saqlanadi, restart'da boshlang'ich holatga
/// qaytadi.
final List<Application> mockApplications = [
  const Application(
    id: 'ARZ-1001',
    title: "Ko'cha yoritgichi ishlamayapti",
    description:
        "Mustaqillik ko'chasi, 12-uy oldida chiroq bir haftadan beri "
        "yonmayapti, kechqurun juda qorong'i.",
    category: 'Kommunal xizmat',
    status: ApplicationStatus.yangi,
    priority: ApplicationPriority.yuqori,
    createdAt: '2026-07-22T09:15:00',
    deadline: '2026-07-27',
    assignedToMe: true,
    points: 0,
    citizenName: 'Aziz Karimov',
    citizenPhone: '+998 90 123 45 67',
  ),
  const Application(
    id: 'ARZ-1002',
    title: "Yo'lda katta chuqur paydo bo'lgan",
    description:
        "Bunyodkor shoh ko'chasi va Navoiy ko'chasi kesishmasida "
        "asfalt yorilib, chuqur hosil bo'lgan, avtomobillar zarar "
        "ko'rmoqda.",
    category: "Yo'l xo'jaligi",
    status: ApplicationStatus.jarayonda,
    priority: ApplicationPriority.yuqori,
    createdAt: '2026-07-18T14:30:00',
    deadline: '2026-07-25',
    assignedToMe: true,
    points: 0,
    attachments: [
      AttachmentRef(
        type: AttachmentType.image,
        path: 'https://mock.cdn/applications/ARZ-1002/chuqurlik_foto.jpg',
        name: 'chuqurlik_foto.jpg',
        sizeBytes: 245760,
      ),
    ],
    citizenName: 'Dilnoza Yusupova',
    citizenPhone: '+998 93 456 78 90',
  ),
  const Application(
    id: 'ARZ-1003',
    title: "Ma'lumotnoma olish so'rovi",
    description:
        "Oilaviy holat to'g'risida ma'lumotnoma kerak, bank kreditiga "
        'hujjat sifatida topshirish uchun.',
    category: "Ma'lumotnoma",
    status: ApplicationStatus.yangi,
    priority: ApplicationPriority.past,
    createdAt: '2026-07-23T11:00:00',
    assignedToMe: false,
    points: 0,
    citizenName: 'Shuhrat Tojiyev',
    citizenPhone: '+998 91 234 56 78',
  ),
  const Application(
    id: 'ARZ-1004',
    title: "Suv ta'minoti uzilishi",
    description:
        'Chilonzor tumani, 9-kvartal hududida uch kundan beri '
        'ichimlik suvi kelmayapti.',
    category: 'Kommunal xizmat',
    status: ApplicationStatus.jarayonda,
    priority: ApplicationPriority.yuqori,
    createdAt: '2026-07-21T08:00:00',
    deadline: '2026-07-24',
    assignedToMe: true,
    points: 0,
    attachments: [
      AttachmentRef(
        type: AttachmentType.voice,
        path: 'https://mock.cdn/applications/ARZ-1004/izoh_ovozli.m4a',
        name: 'izoh_ovozli.m4a',
        sizeBytes: 131072,
        durationMs: 42000,
      ),
    ],
    citizenName: "G'ulom Ne'matov",
    citizenPhone: '+998 97 345 67 89',
  ),
  const Application(
    id: 'ARZ-1005',
    title: 'Bino texnik pasporti nusxasi',
    description: 'Uy-joyni sotish uchun texnik pasport nusxasi zarur.',
    category: "Ma'lumotnoma",
    status: ApplicationStatus.javobBerildi,
    priority: ApplicationPriority.orta,
    createdAt: '2026-07-15T10:20:00',
    deadline: '2026-07-20',
    assignedToMe: true,
    points: 10,
    response: ApplicationResponse(
      text: 'Texnik pasport nusxasi tayyor, uni MFYda olishingiz mumkin.',
      attachments: [
        AttachmentRef(
          type: AttachmentType.file,
          path:
              'https://mock.cdn/applications/ARZ-1005/'
              'texnik_pasport_nusxa.pdf',
          name: 'texnik_pasport_nusxa.pdf',
          sizeBytes: 512000,
        ),
      ],
      respondedAt: '2026-07-19T16:45:00',
    ),
    citizenName: 'Malika Rashidova',
    citizenPhone: '+998 88 765 43 21',
  ),
  const Application(
    id: 'ARZ-1006',
    title: "Hovlida axlat yig'ilib qolgan",
    description:
        "Yakkasaroy tumani, Bog'ishamol ko'chasida axlat idishlari "
        "5 kundan beri bo'shatilmayapti.",
    category: 'Sanitariya',
    status: ApplicationStatus.yangi,
    priority: ApplicationPriority.orta,
    createdAt: '2026-07-23T07:40:00',
    deadline: '2026-07-26',
    assignedToMe: false,
    points: 0,
    citizenName: 'Otabek Sodiqov',
    citizenPhone: '+998 94 567 89 01',
  ),
  const Application(
    id: 'ARZ-1007',
    title: "Nogironlar uchun pandus yo'q",
    description:
        'Poliklinika kiraverishida nogironlar aravachasi uchun pandus '
        "o'rnatilmagan, murojaat uch marta yozilgan.",
    category: 'Ijtimoiy infratuzilma',
    status: ApplicationStatus.yopildi,
    priority: ApplicationPriority.yuqori,
    createdAt: '2026-07-05T09:00:00',
    deadline: '2026-07-15',
    assignedToMe: true,
    points: 20,
    attachments: [
      AttachmentRef(
        type: AttachmentType.image,
        path: 'https://mock.cdn/applications/ARZ-1007/joy_fotosi.jpg',
        name: 'joy_fotosi.jpg',
        sizeBytes: 302080,
      ),
      AttachmentRef(
        type: AttachmentType.video,
        path: 'https://mock.cdn/applications/ARZ-1007/video_dalil.mp4',
        name: 'video_dalil.mp4',
        sizeBytes: 4194304,
        durationMs: 18000,
      ),
    ],
    response: ApplicationResponse(
      text: "Pandus o'rnatildi, ishlar yakunlandi, tekshiruv o'tkazildi.",
      attachments: [
        AttachmentRef(
          type: AttachmentType.image,
          path:
              'https://mock.cdn/applications/ARZ-1007/'
              'yakunlangan_natija.jpg',
          name: 'yakunlangan_natija.jpg',
          sizeBytes: 289792,
        ),
      ],
      respondedAt: '2026-07-14T12:00:00',
    ),
    citizenName: 'Zarina Abdullayeva',
    citizenPhone: '+998 90 987 65 43',
  ),
  const Application(
    id: 'ARZ-1008',
    title: 'Tungi klub shovqini haqida shikoyat',
    description:
        'Yashash hududiga yaqin joylashgan klub tungi soat 2 gacha '
        "baland ovozda musiqa qo'yadi, uxlab bo'lmayapti.",
    category: 'Jamoat tartibi',
    status: ApplicationStatus.rad,
    priority: ApplicationPriority.past,
    createdAt: '2026-07-10T22:15:00',
    assignedToMe: true,
    points: 0,
    response: ApplicationResponse(
      text:
          "Tekshiruv o'tkazildi, klub ruxsat etilgan chegarada "
          'ishlayotgani aniqlandi, qonunbuzarlik topilmadi.',
      attachments: [],
      respondedAt: '2026-07-12T09:30:00',
    ),
    citizenName: 'Jasur Mirzayev',
    citizenPhone: '+998 99 111 22 33',
  ),
];
