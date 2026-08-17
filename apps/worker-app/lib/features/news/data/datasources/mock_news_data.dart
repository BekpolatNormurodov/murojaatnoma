import 'package:worker_app/features/news/domain/entities/news_item.dart';

/// Yangiliklar moduli uchun xotiradagi soxta (mock) "backend" holati.
///
/// `NewsRemoteDataSourceMockImpl` shu ro'yxatni o'qiydi — `AppConfig.
/// useMock` `true` bo'lganda haqiqiy backend o'rnini bosadi. Naqsh
/// `mock_meetings.dart`/`mock_points.dart` bilan bir xil — vazifa doirasi
/// (`lib/features/news/**`) saqlanishi uchun umumiy `lib/core/mock/`
/// papkasi O'RNIGA shu yerda (modul ichida) joylashtirilgan.
///
/// `id`lar backend seedidagi naqshga (`n1`, `n2`, ...) mos — real API bilan
/// almashtirilganda ID formatida farq bo'lmasin.
final List<NewsItem> mockNewsItems = [
  const NewsItem(
    id: 'n1',
    title: 'Tuman hokimligida yangi ish vaqti jadvali tasdiqlandi',
    excerpt:
        '1-sentabrdan boshlab barcha davlat idoralari uchun yangi ish '
        'tartibi joriy etiladi.',
    body:
        'Tuman hokimligi qoshidagi majlisda 2026-yil 1-sentabrdan boshlab '
        'barcha davlat idoralari va byudjet tashkilotlari uchun yangi ish '
        'vaqti jadvali tasdiqlandi. Endilikda ish kuni soat 9:00 da '
        'boshlanib, 18:00 da tugaydi, tushlik tanaffusi 13:00–14:00 '
        "oralig'ida belgilandi.\n\n"
        "Hokim o'rinbosari bildirishicha, yangi tartib fuqarolarga "
        "xizmat ko'rsatish sifatini oshirish va ish yukini "
        "muvozanatlashtirish maqsadida ishlab chiqilgan. Barcha bo'lim "
        "boshliqlaridan ushbu jadvalga qat'iy rioya qilish so'raldi.",
    category: NewsCategory.elon,
    status: NewsStatus.published,
    cover:
        'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=800',
    author: 'Matbuot xizmati',
    publishedAt: '2026-08-15T09:00:00.000Z',
    views: 512,
    featured: true,
  ),
  const NewsItem(
    id: 'n2',
    title: "Markaziy ko'chalarda yo'l ta'mirlash ishlari boshlandi",
    excerpt:
        "Amir Temur va Mustaqillik ko'chalarida asfalt qoplamasini "
        'yangilash ishlari olib borilmoqda.',
    body:
        "Tuman yo'l xo'jaligi tashkiloti tomonidan Amir Temur va "
        "Mustaqillik ko'chalarining umumiy uzunligi 3,2 kilometrlik "
        "qismida asfalt qoplamasini to'liq yangilash ishlari boshlandi.\n\n"
        'Ishlar bosqichma-bosqich, tungi soatlarda (22:00–06:00) olib '
        'boriladi — bu esa kunduzgi transport harakatiga xalaqit '
        'bermaydi. Ishlarning umumiy muddati 45 kun deb belgilangan. '
        'Fuqarolardan vaqtinchalik noqulayliklar uchun tushunish bilan '
        "yondashish so'raladi.",
    category: NewsCategory.tadbir,
    status: NewsStatus.published,
    cover:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800',
    author: "Yo'l xo'jaligi boshqarmasi",
    publishedAt: '2026-08-12T07:30:00.000Z',
    views: 289,
    featured: false,
  ),
  const NewsItem(
    id: 'n3',
    title: 'Hokimlik qarori: ijtimoiy nafaqalar miqdori oshirildi',
    excerpt:
        "Kam ta'minlangan oilalarga beriladigan ijtimoiy nafaqa "
        'miqdori 15 foizga oshirildi.',
    body:
        'Tuman hokimining navbatdagi qarori bilan 2026-yil avgust '
        "oyidan boshlab kam ta'minlangan oilalarga beriladigan oylik "
        'ijtimoiy nafaqa miqdori 15 foizga oshirildi.\n\n'
        "Qarorga ko'ra, nafaqa olish uchun ariza berish tartibi "
        'soddalashtirildi — endi hujjatlarni fuqarolarga xizmat '
        "ko'rsatish markazlari orqali ham topshirish mumkin. Qaror "
        'kuchga kirgan sanadan boshlab amal qiladi.',
    category: NewsCategory.qaror,
    status: NewsStatus.published,
    cover:
        'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800',
    author: "Ijtimoiy himoya bo'limi",
    publishedAt: '2026-08-08T12:00:00.000Z',
    views: 731,
    featured: true,
  ),
  const NewsItem(
    id: 'n4',
    title: "Diqqat: kuchli shamol va yomg'ir haqida ogohlantirish",
    excerpt:
        'Ertaga hududda kuchli shamol (18–23 m/s) va jala kutilmoqda — '
        "ehtiyot choralarini ko'ring.",
    body:
        "O'zgidromet ma'lumotlariga ko'ra, ertangi kuni tuman hududida "
        "shamol tezligi 18–23 metr/soniyagacha kuchayishi, ba'zi "
        "hududlarda jala va do'l yog'ishi mumkin.\n\n"
        "Fuqarolardan quyidagilarga rioya qilish so'raladi: ochiq "
        'maydonlarda, daraxt tagida va reklama taxtalari yaqinida uzoq '
        "vaqt turmaslik, avtomobillarni xavfsiz joyga qo'yish, "
        'bolalarni nazoratsiz qoldirmaslik. Favqulodda vaziyatlar '
        "bo'yicha bo'lim 24 soat ishlaydi: 1050.",
    category: NewsCategory.ogohlantirish,
    status: NewsStatus.published,
    cover:
        'https://images.unsplash.com/photo-1500674425229-f692875b0ab7?w=800',
    author: "Favqulodda vaziyatlar bo'limi",
    publishedAt: '2026-08-17T16:00:00.000Z',
    views: 1204,
    featured: true,
  ),
  const NewsItem(
    id: 'n5',
    title: 'Yangi maktab binosi ishga tushirildi',
    excerpt:
        "1200 o'quvchiga mo'ljallangan zamonaviy maktab binosi "
        'foydalanishga topshirildi.',
    body:
        "Tuman markazida qurilishi olib borilgan, 1200 o'quvchi "
        "o'rniga mo'ljallangan zamonaviy maktab binosi rasmiy ravishda "
        'ishga tushirildi. Bino zamonaviy laboratoriyalar, sport zali, '
        "ovqatlanish bloki va to'liq qulaylashtirilgan (inklyuziv) "
        'muhit bilan jihozlangan.\n\n'
        "Ochilish marosimida tuman hokimi, xalq ta'limi boshqarmasi "
        "vakillari va ota-onalar faoli qatnashdi. Yangi o'quv yili "
        'aynan shu binoda boshlanadi.',
    category: NewsCategory.yangilik,
    status: NewsStatus.published,
    cover:
        'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800',
    author: "Xalq ta'limi boshqarmasi",
    publishedAt: '2026-08-05T10:15:00.000Z',
    views: 458,
    featured: false,
  ),
  const NewsItem(
    id: 'n6',
    title: "Ichimlik suvi ta'minotida vaqtinchalik uzilish",
    excerpt:
        "Quvur ta'mirlash ishlari sababli ertaga 08:00–14:00 "
        "oralig'ida suv ta'minoti to'xtatiladi.",
    body:
        "Hududiy suv ta'minoti korxonasi magistral quvurdagi "
        'avariyani bartaraf etish maqsadida ertangi kuni soat '
        '08:00 dan 14:00 gacha bir qator mahallalarda ichimlik suvi '
        "ta'minotini vaqtincha to'xtatishini ma'lum qildi.\n\n"
        "Ishlar yakunlangach, suv ta'minoti bosqichma-bosqich "
        "tiklanadi. Noqulaylik uchun uzr so'raymiz. Savollar bo'yicha: "
        "1055 (bepul qo'ng'iroq markazi).",
    category: NewsCategory.ogohlantirish,
    status: NewsStatus.published,
    cover:
        'https://images.unsplash.com/photo-1544441893-675973e31985?w=800',
    author: "Suv ta'minoti korxonasi",
    publishedAt: '2026-08-03T18:00:00.000Z',
    views: 176,
    featured: false,
  ),
  // Nashr etilmagan (draft) namuna — ro'yxatda ko'rsatilmasligi kerak,
  // filtrlash mantig'ini (`NewsRemoteDataSource.list()`) sinash uchun.
  const NewsItem(
    id: 'n7',
    title: 'Loyiha: yangi bozor majmuasi qurilishi',
    excerpt: 'Hali tasdiqlanmagan — tahrirda.',
    body: 'Ushbu material hali web-admin tomonidan tayyorlanmoqda.',
    category: NewsCategory.yangilik,
    status: NewsStatus.draft,
    cover: '',
    author: 'Matbuot xizmati',
    publishedAt: '2026-08-16T08:00:00.000Z',
    views: 0,
    featured: false,
  ),
];
