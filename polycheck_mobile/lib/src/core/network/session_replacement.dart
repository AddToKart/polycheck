import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;

import '../api/api_providers.dart';
import '../providers/session_provider.dart';
import '../widgets/campus_toast.dart';
import 'api_config.dart';
import 'api_error.dart';
import 'api_events.dart';
import 'dio_client.dart';

/// Realtime monitor for security-revocation terminations (gap report B-1).
///
/// The backend gateway broadcasts `auth:session-replaced` to the entire user
/// room (`backend/src/realtime/attendance.gateway.ts:168-173`) whenever a
/// security revocation fires (password reset, status/role change, forced
/// rotation). Without this listener Flutter learns about a revocation only on
/// the next 401; with it the device terminates as fast as the RN apps.
///
/// RN sources of truth:
/// * `android/services/realtime.ts:139-155` — same namespace URL, `auth:
///   token`, websocket-only transport, and the EXACT event name
///   `auth:session-replaced`;
/// * `android/lib/session-replacement.ts` — the in-flight-login skip plus the
///   `/auth/me` probe decision;
/// * `android/app/_layout.tsx:150-166` — on confirmed termination: error
///   toast "Your session was replaced or revoked. Please sign in again." and
///   the existing sign-out path (here: [SessionController.handleSessionExpired]).
///
/// The broadcast also fires for the device's own fresh login, and a socket
/// event can beat the login's HTTP response on the wire — the probe is
/// authoritative, so termination happens only when it confirms. Network
/// failures are never proof of revocation in either direction.

/// Exact wire event (`android/services/realtime.ts:152`).
const String authSessionReplacedEvent = 'auth:session-replaced';

/// A stale in-flight stamp can no longer mute the monitor
/// (`OWN_LOGIN_IN_FLIGHT_WINDOW_MS` parity in `session-replacement.ts`).
const Duration ownLoginInFlightWindow = Duration(seconds: 30);

/// RN copy (`android/app/_layout.tsx:160-162`).
const String sessionReplacedUserMessage =
    'Your session was replaced or revoked. Please sign in again.';

/// Decision core — `shouldTerminateForReplacedSession` parity.
///
/// [probeSession] returns exactly one of:
/// * `true`  — an authoritative `/auth/me` rejection (401) → terminate;
/// * `false` — the session is still valid → keep;
/// * `null`  — network/server failure (unreachable, 5xx, maintenance) —
///   never proof of revocation → keep.
Future<bool> shouldTerminateForReplacedSession({
  required bool Function() isOwnLoginInFlight,
  required Future<bool?> Function() probeSession,
}) async {
  if (isOwnLoginInFlight()) return false;
  try {
    final revoked = await probeSession();
    return revoked == true;
  } on Object {
    return false;
  }
}

/// `/auth/me` probe: success is always "not revoked"; only an authoritative
/// 401 proves revocation — network failures and server errors answer null
/// (unknown). 403 `password_change_required` keeps the session alive (the
/// forced-rotation gate owns it), like the RN `restoreSession` contract.
class SessionProbe {
  const SessionProbe();

  Future<bool?> invoke(Future<Object?> Function() me) async {
    try {
      await me();
      return false;
    } on ApiRequestError catch (error) {
      if (error.isUnauthorized) return true;
      if (error.isPasswordChangeRequired) return false;
      return null;
    } on Object {
      return null;
    }
  }
}

/// Thin realtime adapter so tests never start a real socket.
abstract interface class SessionReplacementChannel {
  void listen(void Function() onSessionReplaced);

  void close();
}

typedef SessionReplacementChannelFactory =
    SessionReplacementChannel Function({
      required String socketUrl,

      /// A **reader**, not a captured string: consulted on every engine open
      /// (initial connect and each reconnect) so a bearer rotated mid-session
      /// is never re-sent stale (DD-F18).
      required Future<String?> Function() readToken,
      required void Function() onSessionReplaced,
    });

/// App-root service: owns one authenticated `attendance`-namespace socket
/// while a session is alive and terminates through the existing
/// session-expired path when a broadcast is confirmed. The
/// `SyncLifecycleBinder` (mounted by the app bootstrap) starts/stops it on
/// session changes — `main.dart` stays untouched.
class SessionReplacementMonitor {
  SessionReplacementMonitor({
    required this.readToken,
    required this.probeSession,
    required this.isOwnLoginInFlight,
    required this.onTerminate,
    this.channelFactory = openSessionReplacementSocket,
  });

  final Future<String?> Function() readToken;
  final Future<bool?> Function() probeSession;
  final bool Function() isOwnLoginInFlight;
  final Future<void> Function() onTerminate;
  final SessionReplacementChannelFactory channelFactory;

  SessionReplacementChannel? _channel;
  bool _starting = false;
  bool _handling = false;

  bool get isRunning => _channel != null;
  int get generations => _generation;
  int _generation = 0;

  /// Idempotent start: one channel per live session; retries on re-login.
  Future<void> start() async {
    if (_channel != null || _starting) return;
    _starting = true;
    try {
      final token = await readToken();
      if (token == null || token.isEmpty) return;
      final channel = channelFactory(
        socketUrl: ApiConfig.socketUrl,
        readToken: readToken,
        onSessionReplaced: onSessionReplacedRequested,
      );
      if (_channel != null) {
        // A newer session started while authenticating; drop this stale one.
        channel.close();
        return;
      }
      _channel = channel;
      _generation++;
      channel.listen(onSessionReplacedRequested);
    } catch (_) {
      // Realtime is best-effort: the next 401 still terminates.
    } finally {
      _starting = false;
    }
  }

  void stop() {
    _channel?.close();
    _channel = null;
  }

  /// Event handler; also the seam unit tests drive directly.
  Future<void> onSessionReplacedRequested() async {
    if (_handling) return;
    _handling = true;
    try {
      final terminate = await shouldTerminateForReplacedSession(
        isOwnLoginInFlight: isOwnLoginInFlight,
        probeSession: probeSession,
      );
      if (!terminate) return;
      await onTerminate();
    } on Object {
      // Termination is best-effort; a 401 on the next request still clears.
    } finally {
      _handling = false;
    }
  }
}

/// Live websocket channel over the `/attendance` namespace — mirror of
/// `android/services/realtime.ts:139-155` using the existing
/// `socket_io_client` dependency (same options as `CockpitRealtime`).
class SocketIoSessionReplacementChannel implements SessionReplacementChannel {
  SocketIoSessionReplacementChannel._(this.socket);

  factory SocketIoSessionReplacementChannel({
    required String socketUrl,
    required Future<String?> Function() readToken,
    required void Function() onSessionReplaced,
  }) {
    final socket = socket_io.io(
      socketUrl,
      socket_io.OptionBuilder()
          .setTransports(<String>['websocket'])
          // Auth is resolved per engine open, so reconnects pick up a rotated
          // bearer instead of replaying the one captured at construction
          // (DD-F18). A missing token sends no CONNECT packet; the monitor
          // stops the channel on sign-out anyway.
          .setAuthFn((void Function(Map auth) callback) {
            unawaited(() async {
              final token = await readToken();
              if (token == null || token.isEmpty) return;
              callback(<String, dynamic>{'token': token});
            }());
          })
          .setReconnectionAttempts(8)
          .setReconnectionDelay(1000)
          .setTimeout(8000)
          .disableAutoConnect()
          .build(),
    );
    socket.on(authSessionReplacedEvent, (_) => onSessionReplaced());
    socket.connect();
    return SocketIoSessionReplacementChannel._(socket);
  }

  /// Exposed for disposal by [close] (test/debug only).
  final socket_io.Socket socket;

  @override
  void listen(void Function() onSessionReplaced) {
    // Events are attached at construction; kept for API completeness.
  }

  @override
  void close() {
    try {
      socket.dispose();
    } catch (_) {
      // Already disposed.
    }
  }
}

SessionReplacementChannel openSessionReplacementSocket({
  required String socketUrl,
  required Future<String?> Function() readToken,
  required void Function() onSessionReplaced,
}) {
  return SocketIoSessionReplacementChannel(
    socketUrl: socketUrl,
    readToken: readToken,
    onSessionReplaced: onSessionReplaced,
  );
}

/// Riverpod wiring: the monitor reads the bearer token from the same secure
/// store the HTTP client uses, judges with the session controller's
/// login-in-flight stamp, and terminates through the existing session-expired
/// path with the RN toast copy.
final sessionReplacementMonitorProvider = Provider<SessionReplacementMonitor>((
  ref,
) {
  final probe = const SessionProbe();
  final monitor = SessionReplacementMonitor(
    readToken: () => ref.read(tokenStoreProvider).read(),
    isOwnLoginInFlight: () =>
        ref.read(sessionProvider.notifier).isOwnLoginInFlight,
    probeSession: () => probe.invoke(
      () => ref.read(sessionApiProvider).me(timeout: ApiConfig.connectTimeout),
    ),
    onTerminate: () async {
      CampusToast.show(
        sessionReplacedUserMessage,
        tone: CampusToastTone.error,
        duration: const Duration(seconds: 4),
      );
      await ref
          .read(sessionProvider.notifier)
          .handleSessionExpired(
            SessionExpiredEvent(
              at: DateTime.now().toUtc(),
              method: 'REALTIME',
              path: authSessionReplacedEvent,
              message: sessionReplacedUserMessage,
            ),
          );
    },
  );
  ref.onDispose(monitor.stop);
  return monitor;
});
