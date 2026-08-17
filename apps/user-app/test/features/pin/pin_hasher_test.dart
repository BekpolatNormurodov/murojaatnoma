import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/features/pin/domain/services/pin_hasher.dart';

void main() {
  group(PinHasher, () {
    const hasher = PinHasher();

    test('hash is deterministic: the same PIN always yields the same hash', () {
      expect(hasher.hash('1234'), equals(hasher.hash('1234')));
    });

    test('hash never equals the plaintext PIN (security requirement)', () {
      expect(hasher.hash('1234'), isNot(equals('1234')));
    });

    test('different PINs yield different hashes', () {
      expect(hasher.hash('1234'), isNot(equals(hasher.hash('4321'))));
    });

    test('hash is a 64-char lowercase-hex SHA-256 digest', () {
      final hash = hasher.hash('0000');
      expect(hash, hasLength(64));
      expect(RegExp(r'^[0-9a-f]{64}$').hasMatch(hash), isTrue);
    });
  });
}
