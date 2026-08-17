import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';

/// Yuz shabloni (embedding) uchun masofaviy ma'lumot manbai.
///
/// Faqat BITTA operatsiya — `enroll` (Vazifa 16) da mahalliy saqlangan
/// shablon backendga ham yuklanadi (`FaceRepositoryImpl` orqali), shunda
/// server tomonida ham (`/attendance/check-in` moslikni serverda
/// hisoblaganda) xuddi shu embedding ishlatiladi. Solishtirishning o'zi
/// (verify) hamon MAHALLIY (`FaceMatcher`) — bu klass faqat YUKLASH uchun.
/// `AuthRemoteDataSource`/`AttendanceRemoteDataSource` bilan bir xil
/// Mock/Api seam naqshi (qarang: `injection.dart`) — bitta operatsiya
/// (yuklash) uchun ham shu shartnoma ishlatiladi, chunki kelajakda
/// qo'shimcha metodlar (masalan shablonni o'chirish) qo'shilishi mumkin.
// ignore: one_member_abstracts
abstract class FaceRemoteDataSource {
  /// Berilgan ishchi uchun hisoblangan yuz embeddingini backendga
  /// yuklaydi (`POST /employees/:id/face-template`).
  Future<void> uploadEmbedding(String employeeId, List<double> embedding);
}

/// Mock implementatsiya (backend tayyor bo'lguncha/`useMock` rejimida) —
/// [AppConfig.useMock] `true` bo'lganda ishlatiladi. Hech narsa saqlamaydi
/// — mock oqimda backend umuman yo'q, shuning uchun bu chaqiruv shunchaki
/// muvaffaqiyatli "no-op".
class FaceRemoteDataSourceMockImpl implements FaceRemoteDataSource {
  @override
  Future<void> uploadEmbedding(
    String employeeId,
    List<double> embedding,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
///
/// Backend kontrakti:
/// `POST /employees/:id/face-template {embedding: number[]}`.
class FaceRemoteDataSourceApiImpl implements FaceRemoteDataSource {
  FaceRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<void> uploadEmbedding(
    String employeeId,
    List<double> embedding,
  ) async {
    try {
      await _client.dio.post<dynamic>(
        '/employees/$employeeId/face-template',
        data: {'embedding': embedding},
      );
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
