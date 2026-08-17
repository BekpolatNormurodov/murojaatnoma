/// Yuzni ro'yxatdan o'tkazish (identity enrollment) uchun konstantalar.
///
/// `worker_app/core/constants/app_constants.dart`dagi yuz-bilan-bog'liq
/// konstantalar bilan bir xil qiymatlar — lekin fuqaro ilovasida faqat
/// ENROLLMENT (ro'yxatdan o'tkazish) kerak, tekshirish (verify)/moslik
/// chegarasi emas (`kFaceMatchThreshold` shu sabab bu yerda YO'Q — Faza 3
/// doirasida fuqaro ilovasi kunlik yuz-tekshiruvi qilmaydi, faqat PIN bilan
/// qulflanadi).
library;

/// `FaceEmbedder`ga beriladigan kvadrat kadr o'lchami (piksel).
const int kFaceInputSize = 112;

/// `FaceEmbedder.embed()` qaytaradigan embedding vektorining uzunligi.
const int kFaceEmbeddingSize = 192;
