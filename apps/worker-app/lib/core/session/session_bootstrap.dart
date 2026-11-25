import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/attendance/data/attendance_settings_source.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:worker_app/features/face/data/services/face_photo_store.dart';
import 'package:worker_app/injection.dart';

/// Qurilmadagi yuz shabloni SHU xodimnikimi. Boshqa xodimniki (yoki shablon
/// yo'q) bo'lsa shablon va avatar rasmi o'chiriladi — keyingi xodim oldingi
/// yuzni ko'rmasin; o'sha xodim qayta kirsa qayta ro'yxatdan o'tmaydi.
Future<bool> syncFaceOwner(String workerId) async {
  if (!getIt.isRegistered<FaceLocalDataSource>()) return false;
  try {
    final local = getIt<FaceLocalDataSource>();
    final template = await local.read();
    if (template != null && template.workerId == workerId) return true;
    if (template != null) await local.clear();
    if (getIt.isRegistered<FacePhotoStore>()) {
      await getIt<FacePhotoStore>().clear();
    }
  } on Object {
    // Shablonni o'qib bo'lmadi (keychain vaqtincha band) — o'chirmaymiz,
    // shunchaki "ro'yxatdan o'tmagan" hisoblanadi.
  }
  return false;
}

/// Admin sozlamasini serverdan o'qib `AuthCubit`ga uzatadi. Hech qachon
/// throw qilmaydi.
Future<void> refreshFaceRequired() async {
  if (!getIt.isRegistered<AttendanceSettingsSource>() ||
      !getIt.isRegistered<AuthCubit>()) {
    return;
  }
  try {
    final value = await getIt<AttendanceSettingsSource>().faceRequired();
    if (value != null) {
      getIt<AuthCubit>().setFaceRequired(isRequired: value);
    }
  } on Object {
    // Sozlamani o'qib bo'lmadi — oxirgi ma'lum qiymat qoladi.
  }
}

/// Oxirgi ma'lum `faceRequired` (hali o'qilmagan bo'lsa `null`).
bool? cachedFaceRequired() => getIt.isRegistered<SharedPreferences>()
    ? getIt<SharedPreferences>().getBool(ApiAttendanceSettingsSource.cacheKey)
    : null;

/// Login muvaffaqiyatli bo'lgach, `authenticated` emit qilinishidan OLDIN:
/// yuz shabloni egasi va "yuz majburiymi" sozlamasi aniqlanadi — router
/// keraksiz `/face/enroll` ekranini bir lahzaga ham ochmaydi.
Future<SessionPreparation> prepareSession(AuthSession session) async {
  final enrolled = await syncFaceOwner(session.workerId);
  bool? required;
  if (getIt.isRegistered<AttendanceSettingsSource>()) {
    required = await getIt<AttendanceSettingsSource>().faceRequired().timeout(
      const Duration(seconds: 4),
      onTimeout: () => null,
    );
  }
  return SessionPreparation(
    faceEnrolled: enrolled,
    faceRequired: required ?? cachedFaceRequired(),
  );
}
