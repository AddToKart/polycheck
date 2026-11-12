import 'dart:convert';

import 'package:cryptography/cryptography.dart';

import '../models/session.dart';
import '../models/support/unknown_api_value.dart';

/// Mirrors `shared/src/utils/token.ts` decoding + validity-window math.
///
/// Signing/verification uses the `cryptography` package (Ed25519) and lands
/// with the teacher/student QR waves; decoding, normalization, and expiry
/// math are the trusted-clock-critical pieces every client needs first.
const String _base64Alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

String encodeBase64Url(List<int> bytes) {
  var output = '';
  for (var index = 0; index < bytes.length; index += 3) {
    final first = bytes[index];
    final second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    final third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    final chunk = (first << 16) | (second << 8) | third;
    output += _base64Alphabet[(chunk >> 18) & 63];
    output += _base64Alphabet[(chunk >> 12) & 63];
    output += index + 1 < bytes.length
        ? _base64Alphabet[(chunk >> 6) & 63]
        : '=';
    output += index + 2 < bytes.length ? _base64Alphabet[chunk & 63] : '=';
  }
  return output.replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
}

List<int> decodeBase64Url(String value) {
  final normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  final padded = normalized.padRight((normalized.length / 4).ceil() * 4, '=');
  final clean = padded.replaceAll(RegExp('[^A-Za-z0-9+/=]'), '');
  final output = <int>[];
  for (var index = 0; index < clean.length; index += 4) {
    final a = _base64Alphabet.indexOf(clean[index]);
    final b = index + 1 < clean.length
        ? _base64Alphabet.indexOf(clean[index + 1])
        : -1;
    final c = clean[index + 2] == '='
        ? 0
        : _base64Alphabet.indexOf(clean[index + 2]);
    final d = clean[index + 3] == '='
        ? 0
        : _base64Alphabet.indexOf(clean[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) {
      throw const FormatException('Invalid base64url input');
    }
    final chunk = (a << 18) | (b << 12) | (c << 6) | d;
    output.add((chunk >> 16) & 255);
    if (clean[index + 2] != '=') output.add((chunk >> 8) & 255);
    if (clean[index + 3] != '=') output.add(chunk & 255);
  }
  return output;
}

String _bytesToUtf8(List<int> bytes) => utf8.decode(bytes);

List<int> _utf8ToBytes(String value) => utf8.encode(value);

/// Result of an expiry check. `valid` is true inside the QR window and the
/// grace window; `inGrace` distinguishes the two.
class TokenValidity {
  const TokenValidity({required this.valid, required this.inGrace});

  final bool valid;
  final bool inGrace;

  @override
  bool operator ==(Object other) =>
      other is TokenValidity &&
      other.valid == valid &&
      other.inGrace == inGrace;

  @override
  int get hashCode => Object.hash(valid, inGrace);

  @override
  String toString() => 'TokenValidity(valid: $valid, inGrace: $inGrace)';
}

/// Optional hybrid-attendance fields carried by newer tokens.
class QRTokenExtras {
  const QRTokenExtras({
    this.mode,
    this.checkpoint,
    this.pinRequired,
    this.pinHash,
    this.validitySeconds,
  });

  final SessionMode? mode;
  final CheckpointType? checkpoint;
  final bool? pinRequired;
  final String? pinHash;
  final int? validitySeconds;
}

/// Normalizes a decoded JSON payload. Legacy tokens (pre-hybrid) have no
/// `mode`/`pinRequired`; they normalize to `in_person`/`false`, exactly like
/// the shared helper. Returns null when the payload is not version 1.
QRTokenPayload? normalizeQRTokenPayload(Object? raw) {
  if (raw is! Map) return null;
  final json = <String, dynamic>{};
  raw.forEach((key, value) {
    if (key is String) json[key] = value;
  });
  if (json['version'] != 1) return null;
  json['mode'] ??= SessionMode.inPerson.wire;
  json['pinRequired'] ??= false;
  try {
    return QRTokenPayload.fromJson(json);
  } on UnknownApiValue {
    rethrow;
  } on Object {
    return null;
  }
}

String encodeTokenPayload(QRTokenPayload payload) =>
    encodeBase64Url(_utf8ToBytes(jsonEncode(payload.toJson())));

/// Decodes either a bare payload or the payload half of a signed token
/// (`payload.signature`). Returns null for malformed input.
QRTokenPayload? decodeTokenPayload(String encoded) {
  try {
    final payloadPart = encoded.contains('.')
        ? encoded.split('.').first
        : encoded;
    final payload = jsonDecode(_bytesToUtf8(decodeBase64Url(payloadPart)));
    return normalizeQRTokenPayload(payload);
  } on UnknownApiValue {
    rethrow;
  } on Object {
    return null;
  }
}

/// Trusted-clock expiry check. `validitySeconds` (online checkpoints) wins
/// over `validityMinutes` when present, matching the shared helper.
TokenValidity isTokenInValidityWindow(
  QRTokenPayload payload, [
  int? trustedNowMs,
]) {
  final issuedAt = payload.issuedAt;
  final validityMs = payload.validitySeconds != null
      ? payload.validitySeconds! * 1000
      : payload.validityMinutes * 60 * 1000;
  final validityEnd = issuedAt + validityMs;
  final graceEnd = validityEnd + payload.gracePeriodMinutes * 60 * 1000;
  final now = trustedNowMs ?? DateTime.now().millisecondsSinceEpoch;

  if (now <= validityEnd) {
    return const TokenValidity(valid: true, inGrace: false);
  }
  if (now <= graceEnd) return const TokenValidity(valid: true, inGrace: true);
  return const TokenValidity(valid: false, inGrace: false);
}

String createQRTokenData(
  String sessionId,
  String sectionId,
  String teacherId,
  String teacherName,
  int validityMinutes,
  int gracePeriodMinutes, {
  int? issuedAtMs,
  QRTokenExtras? extras,
}) {
  final payload = QRTokenPayload(
    version: 1,
    sessionId: sessionId,
    sectionId: sectionId,
    issuedAt: issuedAtMs ?? DateTime.now().millisecondsSinceEpoch,
    validityMinutes: validityMinutes,
    gracePeriodMinutes: gracePeriodMinutes,
    teacherId: teacherId,
    teacherName: teacherName,
    mode: extras?.mode ?? SessionMode.inPerson,
    checkpoint: extras?.checkpoint,
    pinRequired: extras?.pinRequired ?? false,
    pinHash: extras?.pinHash,
    validitySeconds: extras?.validitySeconds,
  );
  return encodeTokenPayload(payload);
}

/// Local Ed25519 QR-token verification (gap report A-h).
///
/// Wire format: `<base64url(payload JSON)>.<base64url(signature)>` where the
/// signature covers the UTF-8 bytes of the base64url payload string — exactly
/// `TeacherSigningKeyService.verifyToken` (`features/faculty/data/
/// teacher_signing_key.dart:201`), made available to the student scan
/// pipeline without a cross-feature import. A malformed token, a different
/// key, or an untampered-but-wrong signature returns `false` (fail closed).
Future<bool> verifyToken(String token, String publicKey) async {
  final parts = token.split('.');
  if (parts.length != 2) return false;
  try {
    return Ed25519().verify(
      utf8.encode(parts[0]),
      signature: Signature(
        decodeBase64Url(parts[1]),
        publicKey: SimplePublicKey(
          decodeBase64Url(publicKey),
          type: KeyPairType.ed25519,
        ),
      ),
    );
  } on Object {
    return false;
  }
}
