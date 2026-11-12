import 'dart:convert';
import 'dart:math' as math;

import 'package:cryptography/cryptography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/polycheck_core.dart';

/// Teacher Ed25519 signing key: provisioning, secure storage, and the exact
/// signed-token wire format the NestJS backend verifies.
///
/// Sources of truth (read-only references):
/// * `shared/src/utils/token.ts` — `signQRToken`: the signature is over the
///   UTF-8 bytes of the **base64url-encoded payload JSON string** (not the raw
///   JSON), and the wire token is `<encodedPayload>.<base64url signature>`.
/// * `backend/src/attendance/scan-validator.service.ts:143-210` —
///   `verifyQRToken(evidence.qrToken, teacherPublicKey)` uses the DB public key
///   and enforces the mode/checkpoint/timing rules.
/// * `android/services/signing-key.ts` — SecureStore keys
///   `polycheck.teacher-signing-secret.<account>` /
///   `polycheck.teacher-signing-public.<account>` (account sanitized to
///   `[A-Za-z0-9._-]`).
/// * `android/services/api-client.ts:520-553,626-628` — provision once after
///   faculty login and before an offline-capable QR, failing closed with a
///   typed 4xx when the upload cannot reach the server.
///
/// The RN apps store the tweetnacl 64-byte secret key (`seed || public`).
/// Flutter stores the same base64url secret value, so a key created here can
/// be read back verbatim; when only the seed is present (32 bytes) it is used
/// directly — both derive the same Ed25519 key pair.

/// Persistence seam so tests never touch platform channels.
abstract interface class SigningKeyStore {
  Future<String?> read(String key);

  Future<void> write(String key, String value);

  Future<void> delete(String key);
}

class SecureSigningKeyStore implements SigningKeyStore {
  const SecureSigningKeyStore([this._storage = const FlutterSecureStorage()]);

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

class InMemorySigningKeyStore implements SigningKeyStore {
  final Map<String, String> values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }
}

class TeacherSigningKey {
  const TeacherSigningKey({required this.publicKey, required this.secretKey});

  /// Base64url Ed25519 public key uploaded through `POST /auth/provision-key`.
  final String publicKey;

  /// Base64url secret material (32-byte seed or legacy 64-byte nacl key).
  final String secretKey;
}

class TeacherSigningKeyService {
  TeacherSigningKeyService({
    SigningKeyStore? store,
    Ed25519? algorithm,
    math.Random? random,
  }) : _store = store ?? const SecureSigningKeyStore(),
       _algorithm = algorithm ?? Ed25519(),
       _random = random ?? math.Random.secure();

  final SigningKeyStore _store;
  final Ed25519 _algorithm;
  final math.Random _random;

  static const String _legacySecretKey = 'polycheck-teacher-signing-secret';
  static const String _legacyPublicKey = 'polycheck-teacher-signing-public';

  /// `android/services/signing-key.ts:6-15` parity.
  static String sanitizeAccount(String teacherId) =>
      teacherId.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');

  static ({String secret, String public}) storageKeys(String teacherId) {
    final account = sanitizeAccount(teacherId);
    if (account.isEmpty) {
      throw ArgumentError(
        'A teacher account is required for signing-key storage',
      );
    }
    return (
      secret: 'polycheck.teacher-signing-secret.$account',
      public: 'polycheck.teacher-signing-public.$account',
    );
  }

  Future<TeacherSigningKey> getOrCreate(String teacherId) async {
    final keys = storageKeys(teacherId);
    final secret = await _store.read(keys.secret);
    final public = await _store.read(keys.public);
    if (secret != null &&
        secret.isNotEmpty &&
        public != null &&
        public.isNotEmpty) {
      return TeacherSigningKey(publicKey: public, secretKey: secret);
    }
    if ((secret != null && secret.isNotEmpty) ||
        (public != null && public.isNotEmpty)) {
      throw StateError(
        'Teacher signing-key storage is incomplete. Reset this device signing '
        'key before continuing.',
      );
    }

    final seed = List<int>.generate(32, (_) => _random.nextInt(256));
    final pair = await _algorithm.newKeyPairFromSeed(seed);
    final extracted = await pair.extract();
    final generated = TeacherSigningKey(
      publicKey: encodeBase64Url(extracted.publicKey.bytes),
      secretKey: encodeBase64Url(seed),
    );
    try {
      await _store.write(keys.secret, generated.secretKey);
      await _store.write(keys.public, generated.publicKey);
      // Global keys from earlier releases cannot be attributed safely.
      await _store.delete(_legacySecretKey);
      await _store.delete(_legacyPublicKey);
    } catch (error) {
      await _store.delete(keys.secret);
      await _store.delete(keys.public);
      throw StateError(
        'Unable to persist the teacher signing key securely: $error',
      );
    }
    return generated;
  }

  /// Reads a stored key without ever generating one (revoke/debug paths).
  Future<TeacherSigningKey?> read(String teacherId) async {
    final keys = storageKeys(teacherId);
    final secret = await _store.read(keys.secret);
    final public = await _store.read(keys.public);
    if (secret == null || public == null) return null;
    return TeacherSigningKey(publicKey: public, secretKey: secret);
  }

  Future<void> reset(String teacherId) async {
    final keys = storageKeys(teacherId);
    await _store.delete(keys.secret);
    await _store.delete(keys.public);
  }

  Future<SimpleKeyPair> _keyPair(TeacherSigningKey key) {
    final decoded = decodeBase64Url(key.secretKey);
    final seed = decoded.length == 32
        ? decoded
        : decoded.length == 64
        ? decoded.sublist(0, 32)
        : null;
    if (seed == null) {
      throw StateError('Teacher signing key is not a valid Ed25519 key');
    }
    return _algorithm.newKeyPairFromSeed(seed);
  }

  /// Signs [payload] exactly like `signQRToken` in `shared/src/utils/token.ts`.
  Future<String> signPayload(
    QRTokenPayload payload,
    TeacherSigningKey key,
  ) async {
    final encodedPayload = encodeTokenPayload(payload);
    final signature = await _algorithm.sign(
      utf8.encode(encodedPayload),
      keyPair: await _keyPair(key),
    );
    return '$encodedPayload.${encodeBase64Url(signature.bytes)}';
  }

  /// Local verification used by tests and diagnostics.
  Future<bool> verifyToken(String token, String publicKey) async {
    final parts = token.split('.');
    if (parts.length != 2) return false;
    try {
      return _algorithm.verify(
        utf8.encode(parts[0]),
        signature: Signature(
          decodeBase64Url(parts[1]),
          publicKey: SimplePublicKey(
            decodeBase64Url(publicKey),
            type: KeyPairType.ed25519,
          ),
        ),
      );
    } catch (_) {
      return false;
    }
  }
}

/// `ensureTeacherSigningKeyProvisioned` parity (`android/services/api-client.ts:520-553`).
///
/// Provisioning is rate limited server-side, so the upload is skipped when the
/// session already carries the same public key or this process already
/// provisioned it.
class TeacherKeyProvisioner {
  TeacherKeyProvisioner(this._api);

  final SessionApi _api;
  static final Set<String> _provisionedTeacherIds = <String>{};

  Future<void> ensure({
    required User user,
    required Session session,
    required TeacherSigningKey key,
    bool force = false,
  }) async {
    if (!force) {
      if (session.teacherPublicKey != null &&
          session.teacherPublicKey == key.publicKey) {
        _provisionedTeacherIds.add(user.id);
        return;
      }
      if (_provisionedTeacherIds.contains(user.id)) return;
    }
    try {
      await _api.provisionKey(key.publicKey);
      _provisionedTeacherIds.add(user.id);
    } catch (error) {
      if (error is! ApiRequestError || !error.isNetworkFailure) rethrow;
      // Typed 4xx on purpose: an unprovisioned signing key would make every
      // queued scan fail server-side verification. This precondition must
      // fail closed (mirrors the RN clients).
      throw const ApiRequestError(
        message:
            'Connect to the internet once to register this device before '
            'generating offline QR codes.',
        status: 400,
      );
    }
  }

  static void forget(String teacherId) {
    _provisionedTeacherIds.remove(teacherId);
  }
}

/// Signing-key + provisioner providers (screen code reads these, tests override).
final teacherSigningKeyServiceProvider = Provider<TeacherSigningKeyService>(
  (ref) => TeacherSigningKeyService(),
);

final teacherKeyProvisionerProvider = Provider<TeacherKeyProvisioner>(
  (ref) => TeacherKeyProvisioner(ref.watch(sessionApiProvider)),
);

/// In-person token payload (`frontend/src/lib/api-client.ts:871-884`).
QRTokenPayload buildInPersonTokenPayload({
  required Session session,
  required User teacher,
  required int issuedAtMs,
  required int validityMinutes,
  required int gracePeriodMinutes,
}) {
  if (validityMinutes < 1 || validityMinutes > 15) {
    throw ArgumentError.value(
      validityMinutes,
      'validityMinutes',
      'QR validity must be 1-15 minutes',
    );
  }
  if (gracePeriodMinutes < 0 || gracePeriodMinutes > 60) {
    throw ArgumentError.value(
      gracePeriodMinutes,
      'gracePeriodMinutes',
      'QR grace must be 0-60 minutes',
    );
  }
  return QRTokenPayload(
    version: 1,
    sessionId: session.id,
    sectionId: session.sectionId,
    issuedAt: issuedAtMs,
    validityMinutes: validityMinutes,
    gracePeriodMinutes: gracePeriodMinutes,
    teacherId: teacher.id,
    teacherName: teacher.fullName,
    mode: SessionMode.inPerson,
    pinRequired: false,
  );
}

/// Online checkpoint token payload
/// (`frontend/src/lib/api-client.ts:993-1009`).
QRTokenPayload buildCheckpointTokenPayload({
  required Session session,
  required User teacher,
  required int issuedAtMs,
  required CheckpointType checkpoint,
  required int validitySeconds,
  int graceMinutes = 10,
  String? pinHash,
}) {
  if (validitySeconds < 60 || validitySeconds > 300) {
    throw ArgumentError.value(
      validitySeconds,
      'validitySeconds',
      'Checkpoint QR validity must be 60-300 seconds',
    );
  }
  final effectiveGrace = checkpoint == CheckpointType.start ? graceMinutes : 0;
  if (checkpoint == CheckpointType.start &&
      (effectiveGrace < 0 || effectiveGrace > 60)) {
    throw ArgumentError.value(
      effectiveGrace,
      'graceMinutes',
      'Check-in grace must be 0-60 minutes',
    );
  }
  return QRTokenPayload(
    version: 1,
    sessionId: session.id,
    sectionId: session.sectionId,
    issuedAt: issuedAtMs,
    // Web/Android send ceil(seconds / 60) for online checkpoints.
    validityMinutes: (validitySeconds / 60).ceil(),
    gracePeriodMinutes: effectiveGrace,
    teacherId: teacher.id,
    teacherName: teacher.fullName,
    mode: SessionMode.online,
    checkpoint: checkpoint,
    pinRequired: pinHash != null && pinHash.isNotEmpty,
    pinHash: pinHash,
    validitySeconds: validitySeconds,
  );
}

/// CSPRNG meeting PIN (2-4 digits) via the shared unbiased generator.
String generateMeetingPin(int digits) {
  final random = math.Random.secure();
  return randomMeetingPin(
    digits,
    (length) => List<int>.generate(length, (_) => random.nextInt(256)),
  );
}
