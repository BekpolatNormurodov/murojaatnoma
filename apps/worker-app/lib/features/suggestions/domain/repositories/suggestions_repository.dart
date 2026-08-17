import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';

/// Takliflar (ratsionalizatorlik g'oyalari) moduli bilan ishlash uchun
/// shartnoma — ro'yxatni (filtrlash bilan) o'qish, yangi taklif yuborish
/// va ovoz berish.
abstract class SuggestionsRepository {
  /// Takliflar ro'yxatini oladi.
  ///
  /// [status] — berilsa, faqat shu holatdagi takliflar bilan filtrlaydi.
  /// [query] — sarlavha/matn/kategoriya bo'yicha erkin qidiruv matni.
  Future<Either<Failure, List<Suggestion>>> list({
    SuggestionStatus? status,
    String? query,
  });

  /// Yangi taklif yuboradi. [draft]ning `id`/`status`/`createdAt`/`votes`
  /// maydonlari server (yoki mock) tomonidan qayta belgilanadi.
  Future<Either<Failure, Suggestion>> submit(Suggestion draft);

  /// Taklifga bitta ovoz qo'shadi.
  Future<Either<Failure, Suggestion>> vote(String id);
}
