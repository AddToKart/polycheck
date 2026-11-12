import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// Bearer-token persistence contract (injectable for tests).
abstract interface class TokenStore {
  Future<String?> read();

  Future<void> write(String token);

  Future<void> clear();
}

/// Secure-storage bearer store.
///
/// Mirrors the React Native client exactly: `POST /auth/mobile/login/*`
/// returns `{ user, token }`, and the token is persisted under the
/// SecureStore key `polycheck-token` (`android/services/api-client.ts:128`,
/// `:161-181`, `:592`) and sent as `Authorization: Bearer <token>`.
class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  /// Same key the Android app uses.
  static const String storageKey = 'polycheck-token';

  final FlutterSecureStorage _storage;
  String? _cached;
  bool _loaded = false;

  @override
  Future<String?> read() async {
    if (_loaded) return _cached;
    try {
      _cached = await _storage.read(key: storageKey);
    } catch (_) {
      _cached = null;
    }
    _loaded = true;
    return _cached;
  }

  @override
  Future<void> write(String token) async {
    _cached = token;
    _loaded = true;
    try {
      await _storage.write(key: storageKey, value: token);
    } catch (_) {
      // Keep the in-memory value; the next launch will require a fresh login.
    }
  }

  @override
  Future<void> clear() async {
    _cached = null;
    _loaded = true;
    try {
      await _storage.delete(key: storageKey);
    } catch (_) {
      // Local logout still succeeds; the stale key cannot authenticate alone.
    }
  }
}

/// Installation identity (`mobile-<uuid>`) persisted in secure storage.
///
/// Android uses SecureStore key `polycheck.installation-id.v1` and a
/// `mobile-<hex>` value (`android/services/device-id.ts`). The Flutter client
/// keeps the same key and prefix with a UUID body.
class DeviceIdentity {
  DeviceIdentity([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  static const String storageKey = 'polycheck.installation-id.v1';

  final FlutterSecureStorage _storage;
  Future<String>? _pending;

  Future<String> getOrCreate() {
    return _pending ??= _loadOrCreate().catchError((Object error) {
      _pending = null;
      throw StateError(
        "Unable to establish this device's secure installation identity: $error",
      );
    });
  }

  Future<String> _loadOrCreate() async {
    final stored = await _storage.read(key: storageKey);
    if (stored != null && stored.isNotEmpty) return stored;
    final generated = 'mobile-${const Uuid().v4()}';
    await _storage.write(key: storageKey, value: generated);
    return generated;
  }
}
