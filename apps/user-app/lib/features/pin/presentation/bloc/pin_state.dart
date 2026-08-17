part of 'pin_cubit.dart';

/// `PinCubit`ning barcha holatlari — bitta sealed ierarxiya HAM PIN
/// o'rnatish (SET, birinchi marta + tasdiqlash), HAM PIN tekshirish
/// (VERIFY, qulfni ochish) rejimlarini qamrab oladi, `FaceState`
/// (`worker_app`) bir nechta rejimni bitta ierarxiyada birlashtirgan
/// naqshga o'xshab.
///
/// `PinSetPage` faqat SET-holatlarni (`PinAwaitingConfirmation`,
/// `PinMismatch`, `PinSetSuccess`) kutadi; `PinUnlockPage` faqat
/// VERIFY-holatlarni (`PinVerifying`, `PinVerifySuccess`,
/// `PinVerifyError`) kutadi — ikkalasi ham `PinInitial`/`PinSaving`/
/// `PinStorageError`ni baham ko'radi.
sealed class PinState extends Equatable {
  const PinState();

  @override
  List<Object?> get props => [];
}

/// Boshlang'ich holat — birinchi (yoki yagona, VERIFY rejimida) 4 xonani
/// kiritishga tayyor.
class PinInitial extends PinState {
  const PinInitial();
}

/// SET rejimi: birinchi kiritish qabul qilindi, tasdiqlash kiritilishini
/// kutmoqda.
class PinAwaitingConfirmation extends PinState {
  const PinAwaitingConfirmation();
}

/// SET rejimi: tasdiqlash birinchi kiritilgan PIN bilan mos kelmadi —
/// sahifa xatoni ko'rsatib, boshidan (1-qadam) boshlaydi.
class PinMismatch extends PinState {
  const PinMismatch();
}

/// PIN xeshi xavfsiz xotiraga yozilmoqda (SET) — qisqa oraliq holat.
class PinSaving extends PinState {
  const PinSaving();
}

/// SET rejimi: PIN muvaffaqiyatli saqlandi.
class PinSetSuccess extends PinState {
  const PinSetSuccess();
}

/// VERIFY rejimi: kiritilgan PIN saqlangan xesh bilan solishtirilmoqda.
class PinVerifying extends PinState {
  const PinVerifying();
}

/// VERIFY rejimi: PIN mos keldi — qulf ochildi.
class PinVerifySuccess extends PinState {
  const PinVerifySuccess();
}

/// VERIFY rejimi: PIN mos kelmadi — sahifa xatoni ko'rsatib, qayta
/// kiritishga ruxsat beradi.
class PinVerifyError extends PinState {
  const PinVerifyError();
}

/// Ikkala rejim: kutilmagan xavfsiz-xotira xatosi (masalan platforma
/// kanali xatosi). [message] foydalanuvchiga ko'rsatiladi.
class PinStorageError extends PinState {
  const PinStorageError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

/// VERIFY rejimi: ketma-ket noto'g'ri urinishlar soni
/// [PinCubit.maxAttempts]ga yetdi — yumshoq (vaqtinchalik, faqat shu
/// `PinCubit` instansiyasi doirasida xotirada saqlanadigan, qurilmaga
/// yozilmaydigan) bloklash.
class PinLockedOut extends PinState {
  const PinLockedOut();
}
