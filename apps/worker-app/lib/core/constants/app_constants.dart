// Yuzni tanish orqali davomat (face check-in) va geofence uchun global
// konstantalar. `assets/models/README.md` bilan birga o'qing.

/// Ikki yuz embeddingi orasidagi shu qiymatdan yaqin (kosinus o'xshashlik)
/// bo'lsa, mos deb hisoblanadi. **Faqat haqiqiy model** (`FaceEmbedder`
/// `.tflite`ni muvaffaqiyatli yuklagan, `isFallback == false`) yuklangan
/// paytda ishlatiladi.
const double kFaceMatchThreshold = 0.7;

/// `FaceEmbedder` fallback (model-siz, piksel-asosli idrok embeddingi)
/// rejimida ishlatiladigan, yumshoqroq chegara. Fallback embeddingning
/// ajratuvchanligi (separability) haqiqiy o'rgangan modeldan past —
/// shuning uchun 0.7 chegarasi bilan bir xil odam ham ba'zan rad
/// etilib qolishi mumkin edi. 0.5 — bir xil odam (oddiy yorug'lik/burchak
/// farqi bilan) ishonchli o'tishi, lekin aniq boshqa odam rad etilishi
/// uchun sinovdan o'tkazilgan (`face_embedder_test.dart`) muvozanat.
const double kFaceMatchFallbackThreshold = 0.5;

/// Ish hududi radiusi (metr) — shundan tashqarida check-in rad etiladi.
/// Mirzo Ulug'bek tumani ish hududi sifatida belgilangan, shu bois radius
/// tuman miqyosida (2 km) — xaritada "Ish hududi" doirasi shu tumanni qamrab
/// oladi.
const double kGeofenceRadius = 2000; // metr (Mirzo Ulug'bek tumani)

/// Ish hududi markazi (kenglik) — Mirzo Ulug'bek tumani, Toshkent.
const double kWorkplaceLat = 41.3111; // Mirzo Ulug'bek tumani

/// Ish hududi markazi (uzunlik) — Mirzo Ulug'bek tumani, Toshkent.
const double kWorkplaceLng = 69.3402; // Mirzo Ulug'bek tumani

/// `mobilefacenet.tflite` chiqishidagi embedding vektor uzunligi.
/// Real model qo'yilganda uning haqiqiy chiqishiga moslang (128 yoki 192).
const int kFaceEmbeddingSize = 192; // modelga qarab moslang

/// Model kirishi kutayotgan kvadrat rasm o'lchami (112x112 RGB).
const int kFaceInputSize = 112;

/// Yuz skaneri "barqarorlik" davomiyligi: sifat-gate'dan o'tgan yuz shu
/// muddat davomida ramkada barqaror ushlab turilishi kerak — progress
/// yoyi shu vaqt oralig'ida to'ladi va shundan keyingina kadr olinadi
/// (enroll). Ataylab ~3 soniya: "sekin, ishonchli skaner" his-tuyg'usi
/// uchun (900ms juda tez — bir zumda o'qib qo'yardi). Test'lar `FaceCubit`
/// konstruktorining standart qiymatini (900ms) o'zgartirmasdan, aniq
/// `clock` bilan deterministik ishlaydi — bu konstanta faqat productionda
/// (DI, `injection.dart`) uzatiladi.
const Duration kFaceScanStableDuration = Duration(seconds: 3);
