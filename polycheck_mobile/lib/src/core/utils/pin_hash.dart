import 'dart:convert';
import 'dart:math' as math;

import 'package:cryptography/cryptography.dart';

import 'token_crypto.dart' show decodeBase64Url, encodeBase64Url;

/// Mirrors `shared/src/utils/pin-hash.ts`.
///
/// Meeting PINs are 2-4 digits, so a plain hash in a signed token would be
/// trivially reversible. PBKDF2-HMAC-SHA256 with a per-token salt makes every
/// candidate cost real work; the plaintext PIN never leaves the teacher's
/// device.
const int meetingPinKdfIterations = 100000;
const int meetingPinMinIterations = 10000;
const int meetingPinMaxIterations = 600000;
final RegExp meetingPinPattern = RegExp(r'^\d{2,4}$');

const String _pinHashVersion = 'p1';
const String _pinHashAlgorithm = 'pbkdf2-sha256';
const int _saltBytes = 16;
const int _digestBytes = 32;

class PinHashRecord {
  const PinHashRecord({
    required this.iterations,
    required this.salt,
    required this.digest,
  });

  final int iterations;
  final List<int> salt;
  final List<int> digest;
}

class PinHashOutcome {
  const PinHashOutcome({required this.record, required this.serialized});

  final PinHashRecord record;
  final String serialized;
}

bool isValidPinFormat(String value) => meetingPinPattern.hasMatch(value);

void assertValidMeetingPin(String pin) {
  if (!isValidPinFormat(pin)) {
    throw ArgumentError.value(pin, 'pin', 'Meeting PIN must be 2-4 digits');
  }
}

String encodePinHashRecord(PinHashRecord record) => [
  _pinHashVersion,
  _pinHashAlgorithm,
  '${record.iterations}',
  encodeBase64Url(record.salt),
  encodeBase64Url(record.digest),
].join(r'$');

PinHashRecord? decodePinHashRecord(String value) {
  try {
    final parts = value.split(r'$');
    if (parts.length != 5) return null;
    if (parts[0] != _pinHashVersion || parts[1] != _pinHashAlgorithm) {
      return null;
    }
    final iterations = int.tryParse(parts[2]);
    if (iterations == null ||
        iterations < meetingPinMinIterations ||
        iterations > meetingPinMaxIterations) {
      return null;
    }
    final salt = decodeBase64Url(parts[3]);
    final digest = decodeBase64Url(parts[4]);
    if (salt.length != _saltBytes || digest.length != _digestBytes) {
      return null;
    }
    return PinHashRecord(iterations: iterations, salt: salt, digest: digest);
  } on Object {
    return null;
  }
}

bool _timingSafeEqual(List<int> left, List<int> right) {
  if (left.length != right.length) return false;
  var difference = 0;
  for (var index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference == 0;
}

Future<List<int>> _derive(String pin, List<int> salt, int iterations) async {
  final pbkdf2 = Pbkdf2(
    macAlgorithm: Hmac.sha256(),
    iterations: iterations,
    bits: _digestBytes * 8,
  );
  final key = await pbkdf2.deriveKey(
    secretKey: SecretKey(utf8.encode(pin.trim())),
    nonce: salt,
  );
  return key.extractBytes();
}

List<int> _defaultRandomBytes(int length) {
  final random = math.Random.secure();
  return List<int>.generate(length, (_) => random.nextInt(256));
}

Future<PinHashOutcome> hashMeetingPin(
  String pin, {
  List<int>? salt,
  List<int> Function(int length)? randomFn,
  int? iterations,
}) async {
  assertValidMeetingPin(pin);
  final effectiveIterations = iterations ?? meetingPinKdfIterations;
  if (effectiveIterations < meetingPinMinIterations ||
      effectiveIterations > meetingPinMaxIterations) {
    throw ArgumentError.value(
      effectiveIterations,
      'iterations',
      'Meeting PIN iteration count is outside the allowed range',
    );
  }
  final effectiveSalt = salt ?? (randomFn ?? _defaultRandomBytes)(_saltBytes);
  if (effectiveSalt.length != _saltBytes) {
    throw ArgumentError.value(
      effectiveSalt.length,
      'salt',
      'Meeting PIN salt must be 16 bytes',
    );
  }
  final digest = await _derive(pin, effectiveSalt, effectiveIterations);
  final record = PinHashRecord(
    iterations: effectiveIterations,
    salt: List<int>.unmodifiable(effectiveSalt),
    digest: List<int>.unmodifiable(digest),
  );
  return PinHashOutcome(
    record: record,
    serialized: encodePinHashRecord(record),
  );
}

Future<bool> verifyMeetingPin(String pin, Object? recordOrSerialized) async {
  if (recordOrSerialized == null || !isValidPinFormat(pin)) return false;
  final PinHashRecord? record;
  if (recordOrSerialized is String) {
    record = decodePinHashRecord(recordOrSerialized);
  } else if (recordOrSerialized is PinHashRecord) {
    record = recordOrSerialized;
  } else {
    return false;
  }
  if (record == null) return false;
  if (record.salt.length != _saltBytes ||
      record.digest.length != _digestBytes) {
    return false;
  }
  if (record.iterations < meetingPinMinIterations ||
      record.iterations > meetingPinMaxIterations) {
    return false;
  }
  final digest = await _derive(pin, record.salt, record.iterations);
  return _timingSafeEqual(digest, record.digest);
}

/// Generates a random numeric PIN (2-4 digits) using the injected CSPRNG.
String randomMeetingPin(
  int digits,
  List<int> Function(int length) randomBytes,
) {
  if (digits < 2 || digits > 4) {
    throw ArgumentError.value(digits, 'digits', 'PIN length must be 2-4');
  }
  final range = math.pow(10, digits).toInt();
  const maxUint32 = 0x100000000;
  final maxUnbiased = (maxUint32 ~/ range) * range;
  while (true) {
    final bytes = randomBytes(4);
    if (bytes.length < 4) {
      throw StateError('Random source returned insufficient bytes');
    }
    final value =
        ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) &
        0xFFFFFFFF;
    if (value < maxUnbiased) {
      return '${value % range}'.padLeft(digits, '0');
    }
  }
}
