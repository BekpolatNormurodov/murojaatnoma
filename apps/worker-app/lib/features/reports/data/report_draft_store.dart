import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Yuborilmagan kunlik hisobot qoralamasi (internet yo'q, ilova yopilgan).
/// Har bir xodimniki alohida kalitda — boshqa xodim ko'rmaydi.
class ReportDraftStore {
  ReportDraftStore(this._prefs, this._ownerId);

  final SharedPreferences _prefs;
  final String? Function() _ownerId;

  String? get _key {
    final owner = _ownerId();
    return owner == null ? null : 'report_draft_v1_$owner';
  }

  Map<String, dynamic>? read() {
    final key = _key;
    final raw = key == null ? null : _prefs.getString(key);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } on Object {
      return null;
    }
  }

  Future<void> write(Map<String, dynamic> draft) async {
    final key = _key;
    if (key != null) await _prefs.setString(key, jsonEncode(draft));
  }

  Future<void> clear() async {
    final key = _key;
    if (key != null) await _prefs.remove(key);
  }
}
