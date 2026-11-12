import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../api/api_models.dart';
import '../api/session_api.dart';
import '../database/app_database.dart';
import '../models/maintenance.dart';
import '../models/user.dart';
import '../network/api_config.dart';
import '../network/api_error.dart';
import '../network/api_events.dart';
import '../network/dio_client.dart';
import '../network/secure_token_store.dart';
import '../sync/attendance_pin_vault.dart';

enum SessionStatus { unknown, restoring, authenticating, signedIn, signedOut }

@immutable
class SessionState {
  const SessionState({
    this.status = SessionStatus.unknown,
    this.user,
    this.expiredAt,
    this.maintenance,
  });

  final SessionStatus status;
  final User? user;

  /// Last authoritative 401; A3 clears it after showing the login reason.
  final SessionExpiredEvent? expiredAt;

  /// Active maintenance announcement (also reachable via the probe provider).
  final MaintenanceEvent? maintenance;

  bool get isSignedIn => status == SessionStatus.signedIn && user != null;

  bool get isRestoring =>
      status == SessionStatus.unknown || status == SessionStatus.restoring;

  UserRole? get role => user?.role;

  bool get mustChangePassword => user?.mustChangePassword ?? false;

  bool get isSuperAdmin => user?.role == UserRole.superAdmin;

  bool get isTeacher => user?.role == UserRole.teacher;

  bool get isStudent => user?.role == UserRole.student;

  bool get isItCoordinator => user?.isItCoordinator ?? false;

  bool get isDepartmentHead => user?.isDepartmentHead ?? false;

  bool get isUserRegistrar => user?.isUserRegistrar ?? false;

  DelegatedTeacherPermissions? get delegatedPermissions =>
      user?.delegatedPermissions;

  SessionState copyWith({
    SessionStatus? status,
    User? user,
    bool clearUser = false,
    SessionExpiredEvent? expiredEvent,
    bool clearExpired = false,
    MaintenanceEvent? maintenance,
    bool clearMaintenance = false,
  }) {
    return SessionState(
      status: status ?? this.status,
      user: clearUser ? null : (user ?? this.user),
      expiredAt: clearExpired ? null : (expiredEvent ?? expiredAt),
      maintenance: clearMaintenance ? null : (maintenance ?? this.maintenance),
    );
  }
}

/// Working authentication core: secure bearer token + Drift-cached profile,
/// device-id login, logout cooldown arming, `/auth/me` refresh, owner purge on
/// session revocation, and maintenance-event exposure to the A3 router.
class SessionController extends Notifier<SessionState> {
  bool _restoring = false;
  bool _handlingExpiry = false;

  /// Device-clock stamp of the most recent own login (RN
  /// `noteLoginStarted`/`clearLoginInFlight` parity). The
  /// `auth:session-replaced` broadcast fires for this device's own login too
  /// and the socket event can beat the HTTP response, so the replacement
  /// monitor (B-1) skips while a login is in flight. Cleared in a `finally`
  /// on every exit path so the stamp never outlives the response; a stuck
  /// stamp stops muting after [ownLoginInFlightWindow].
  DateTime? _loginStartedAt;

  /// RN `isOwnLoginInFlight()` parity (30-second in-flight window).
  bool get isOwnLoginInFlight {
    final started = _loginStartedAt;
    if (started == null) return false;
    final elapsed = DateTime.now().difference(started.toUtc());
    return elapsed < const Duration(seconds: 30);
  }

  SessionApi get _api => ref.read(sessionApiProvider);
  AppDatabase get _database => ref.read(appDatabaseProvider);
  TokenStore get _tokens => ref.read(tokenStoreProvider);
  DeviceIdentity get _deviceIdentity => ref.read(deviceIdentityProvider);

  @override
  SessionState build() {
    ref.listen(sessionExpiredEventsProvider, (previous, next) {
      if (next case AsyncData<SessionExpiredEvent>(:final value)) {
        unawaited(handleSessionExpired(value));
      }
    });
    ref.listen(maintenanceEventsProvider, (previous, next) {
      if (next case AsyncData<MaintenanceEvent>(:final value)) {
        state = state.copyWith(maintenance: value);
      }
    });
    Future<void>.microtask(restore);
    return const SessionState(status: SessionStatus.restoring);
  }

  /// Cold-start session restore. Mirrors `api.restoreSession()`:
  /// cached profile survives transport failures; an authoritative 401/403
  /// revokes it; `password_change_required` keeps the profile flagged so the
  /// forced-rotation gate can take over.
  Future<void> restore() async {
    if (_restoring) return;
    _restoring = true;
    try {
      final token = await _tokens.read();
      if (token == null || token.isEmpty) {
        state = const SessionState(status: SessionStatus.signedOut);
        return;
      }
      final cached = await _database.readActiveProfile();
      if (cached == null) {
        await _restoreWithoutCachedProfile();
        return;
      }
      state = state.copyWith(status: SessionStatus.signedIn, user: cached.user);
      try {
        final profile = await _api.me(
          timeout: ApiConfig.coldStartVerificationTimeout,
        );
        await _storeProfile(profile);
      } on ApiRequestError catch (error) {
        if (error.isNetworkFailure) {
          // Offline-first: trust the cached profile while the network is down.
          return;
        }
        if (error.isPasswordChangeRequired) {
          final flagged = cached.user.copyWith(mustChangePassword: true);
          await _storeProfile(flagged);
          return;
        }
        if (error.isUnauthorized) {
          await handleSessionExpired(
            SessionExpiredEvent(
              at: DateTime.now().toUtc(),
              method: 'GET',
              path: '/auth/me',
              message: error.message,
            ),
          );
          return;
        }
        await _clearLocal(cached.userId);
      }
    } finally {
      _restoring = false;
    }
  }

  Future<void> _restoreWithoutCachedProfile() async {
    try {
      final profile = await _api.me(
        timeout: ApiConfig.coldStartVerificationTimeout,
      );
      await _storeProfile(profile);
    } on ApiRequestError catch (error) {
      if (error.isPasswordChangeRequired) {
        // No cached identity to flag; require a fresh sign-in.
        await _clearLocal(null);
        return;
      }
      await _clearLocal(null);
    }
  }

  Future<User> loginStudent({
    required String studentId,
    required String password,
  }) async {
    _noteLoginStarted();
    state = state.copyWith(
      status: SessionStatus.authenticating,
      clearUser: true,
      clearExpired: true,
    );
    try {
      final deviceId = await _deviceIdOrNull();
      final result = await _api.loginStudent(
        studentId: studentId,
        password: password,
        deviceId: deviceId,
      );
      await _acceptLogin(result);
      return result.user;
    } catch (_) {
      state = const SessionState(status: SessionStatus.signedOut);
      rethrow;
    } finally {
      _loginStartedAt = null;
    }
  }

  Future<User> loginFaculty({
    required String email,
    required String password,
  }) async {
    _noteLoginStarted();
    state = state.copyWith(
      status: SessionStatus.authenticating,
      clearUser: true,
      clearExpired: true,
    );
    try {
      final deviceId = await _deviceIdOrNull();
      final result = await _api.loginFaculty(
        email: email,
        password: password,
        deviceId: deviceId,
      );
      await _acceptLogin(result);
      // NOTE: Android provisions the teacher's Ed25519 public key immediately
      // after faculty login. That requires the local signing-key service
      // (Phase 4); this slice does not invent a key just to call
      // `/auth/provision-key`. `SessionApi.provisionKey` is ready for it.
      return result.user;
    } catch (_) {
      state = const SessionState(status: SessionStatus.signedOut);
      rethrow;
    } finally {
      _loginStartedAt = null;
    }
  }

  void _noteLoginStarted() {
    _loginStartedAt = DateTime.now().toUtc();
  }

  /// Posts `{deviceId, armDeviceCooldown}` and always clears local state even
  /// when the server is unreachable (mirrors the RN offline logout).
  Future<void> logout({bool armDeviceCooldown = true}) async {
    final currentUserId = state.user?.id;
    final deviceId = await _deviceIdOrNull();
    try {
      await _api.logout(
        deviceId: deviceId,
        armDeviceCooldown: armDeviceCooldown,
      );
    } catch (_) {
      // Local sign-out never blocks on the network.
    } finally {
      await _clearLocal(currentUserId);
    }
  }

  /// Re-reads the profile; throws the typed failure so callers can surface it.
  Future<User> refreshMe() async {
    final profile = await _api.me();
    await _storeProfile(profile);
    return profile;
  }

  Future<void> handleSessionExpired(SessionExpiredEvent event) async {
    if (_handlingExpiry) return;
    _handlingExpiry = true;
    try {
      final userId = state.user?.id;
      await _tokens.clear();
      // Keep queued attendance evidence (and its process-lifetime PINs) across
      // an authoritative expiry: the same account can re-authenticate and drain.
      if (userId != null) {
        await _database.clearOwner(userId, preserveAttendanceQueue: true);
      }
      state = SessionState(
        status: SessionStatus.signedOut,
        expiredAt: event,
        maintenance: state.maintenance,
      );
    } finally {
      _handlingExpiry = false;
    }
  }

  /// Lets the A3 maintenance overlay clear the banner after a healthy probe.
  void setMaintenance(MaintenanceBlockBody? body) {
    if (body == null) {
      state = state.copyWith(clearMaintenance: true);
      return;
    }
    state = state.copyWith(
      maintenance: MaintenanceEvent(
        message: body.message.isEmpty
            ? defaultMaintenanceMessage
            : body.message,
        estimatedEnd: body.estimatedEnd,
        at: DateTime.now().toUtc(),
      ),
    );
  }

  void clearExpiredReason() {
    state = state.copyWith(clearExpired: true);
  }

  Future<void> _acceptLogin(LoginResult result) async {
    await _tokens.write(result.token);
    await _storeProfile(result.user);
  }

  Future<void> _storeProfile(User user) async {
    await _database.writeProfile(user);
    state = state.copyWith(
      status: SessionStatus.signedIn,
      user: user,
      clearExpired: true,
    );
  }

  Future<void> _clearLocal(String? userId) async {
    await _tokens.clear();
    ref.read(attendancePinVaultProvider).clear();
    if (userId != null) await _database.clearOwner(userId);
    state = const SessionState(status: SessionStatus.signedOut);
  }

  Future<String?> _deviceIdOrNull() async {
    try {
      return await _deviceIdentity.getOrCreate();
    } catch (_) {
      return null;
    }
  }
}

final sessionProvider = NotifierProvider<SessionController, SessionState>(
  SessionController.new,
);
