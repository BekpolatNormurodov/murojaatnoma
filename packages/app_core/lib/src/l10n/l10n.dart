import 'package:app_core/src/l10n/app_localizations.dart';
import 'package:flutter/widgets.dart';

export 'app_localizations.dart';

/// `BuildContext` orqali `AppLocalizations`ga qulay kirish imkonini beradi.
extension AppLocalizationsX on BuildContext {
  /// Joriy kontekst uchun mahalliylashtirilgan matnlar.
  AppLocalizations get l10n => AppLocalizations.of(this);
}
