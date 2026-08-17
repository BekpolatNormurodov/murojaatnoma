import 'package:app_core/app_core.dart';

/// `/attendance/check-in` 409 qaytardi — xodim BUGUN allaqachon check-in
/// qilgan. [message] backendning `uz` tilidagi `{message}` javob
/// maydonidan to'g'ridan-to'g'ri ko'chiriladi (odatda "Bugun allaqachon
/// keldingiz belgilangan") — UI (`FaceCubit`/sahifa) buni O'ZGARISHSIZ
/// ko'rsatadi.
class AlreadyCheckedInFailure extends Failure {
  const AlreadyCheckedInFailure([
    super.message = 'Bugun allaqachon keldingiz belgilangan',
  ]);
}

/// `/attendance/check-out` 409 qaytardi — xodim BUGUN allaqachon
/// check-out qilgan. [message] — backend `{message}`si (odatda "Bugun
/// allaqachon ketganingiz belgilangan").
class AlreadyCheckedOutFailure extends Failure {
  const AlreadyCheckedOutFailure([
    super.message = 'Bugun allaqachon ketganingiz belgilangan',
  ]);
}

/// `/attendance/check-out` 400 qaytardi — xodim bugun hali check-in
/// qilmagan (check-out qilishdan oldin check-in shart). [message] —
/// backend `{message}`si (odatda "Avval kelganingizni belgilashingiz
/// kerak").
class NotCheckedInFailure extends Failure {
  const NotCheckedInFailure([
    super.message = 'Avval kelganingizni belgilashingiz kerak',
  ]);
}
