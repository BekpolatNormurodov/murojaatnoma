import 'package:app_core/app_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/constants/app_constants.dart';

/// `GET /settings/attendance` — admin tomonidan boshqariladigan davomat
/// sozlamalari (hozircha faqat `faceRequired`).
///
/// Ilova ildizida (`bootstrap`) login/sessiya tiklangach o'qiladi: yuz
/// skaneri o'chirilgan bo'lsa, yuzi ro'yxatdan o'tmagan xodim
/// `/face/enroll`ga majburlanmaydi (qarang: `resolveAuthRedirect`).
// Interface (API vs demo implementations, swappable in DI/tests).
// ignore: one_member_abstracts
abstract class AttendanceSettingsSource {
  /// `true`/`false` — server javobi; `null` — aniqlab bo'lmadi (oflayn,
  /// eski backend). Hech qachon throw qilmaydi.
  Future<bool?> faceRequired();
}

class ApiAttendanceSettingsSource implements AttendanceSettingsSource {
  ApiAttendanceSettingsSource(this._client);

  final DioClient _client;

  /// Oxirgi ma'lum qiymat shu kalitda saqlanadi (keyingi ishga tushishda
  /// boshlang'ich holat sifatida).
  static const cacheKey = 'attendance_face_required';

  @override
  Future<bool?> faceRequired() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/settings/attendance',
      );
      final value = response.data?['faceRequired'];
      // Maydon yo'q (eski backend) — avvalgidek majburiy.
      final required = value is bool ? value : true;
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool(cacheKey, required);
      } on Object {
        // kesh ixtiyoriy
      }
      return required;
    } on Object {
      return null;
    }
  }
}

/// Demo rejim — har doim [value] (standart: `kMockFaceRequired`).
class MockAttendanceSettingsSource implements AttendanceSettingsSource {
  MockAttendanceSettingsSource({this.value = kMockFaceRequired});

  final bool value;

  @override
  Future<bool?> faceRequired() async => value;
}
