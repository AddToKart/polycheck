import 'dart:async';
import 'dart:math' as math;

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/polycheck_core.dart';

/// Reads the CURRENT bearer token.
///
/// Invoked on every socket engine open — the initial connect *and* each
/// reconnect — so a mid-session token rotation never re-authenticates with a
/// stale bearer (DD-F18).
typedef RealtimeTokenReader = Future<String?> Function();

/// The slice of `socket_io_client` the cockpit subscribes through.
///
/// A thin seam keeps the self-healing reconnect unit-testable without a live
/// gateway (same shape as `SessionReplacementChannel`).
abstract interface class CockpitRealtimeSocket {
  void on(String event, void Function(dynamic payload) handler);
  void onConnect(void Function() handler);
  void onDisconnect(void Function(String reason) handler);
  void onConnectError(void Function(Object? error) handler);

  /// Manager-level `reconnect_failed`: the socket's own bounded burst
  /// ([cockpitSocketReconnectAttempts] × [cockpitSocketReconnectDelay]) is
  /// exhausted and the socket will never retry by itself.
  void onReconnectFailed(void Function() handler);

  void emit(String event, [dynamic data]);
  void connect();
  void dispose();
}

typedef CockpitRealtimeSocketFactory =
    CockpitRealtimeSocket Function(Map<String, dynamic> options);

/// How many 1 s attempts one socket burst gets before the manager gives up.
const int cockpitSocketReconnectAttempts = 8;
const int cockpitSocketReconnectDelay = 1000;

/// Backoff between self-healing burst restarts.
///
/// Bounded (capped at the last entry) so a long outage does not hammer the
/// gateway, but never exhausted: the cockpit keeps trying for as long as it is
/// on screen, which is what makes a network blip recover on its own (DD-F8).
const List<Duration> cockpitReconnectBackoff = <Duration>[
  Duration(seconds: 1),
  Duration(seconds: 2),
  Duration(seconds: 4),
  Duration(seconds: 8),
  Duration(seconds: 15),
];

/// Socket.IO subscription for one session cockpit.
///
/// Mirrors `android/services/realtime.ts:20-60`: authenticate with the bearer
/// token, join `session:join`, refresh on `attendance:updated`/`session:state`,
/// and surface `attendance:anomaly` + `session:finale`.
class CockpitRealtime {
  CockpitRealtime({
    required this.sessionId,
    required this.readToken,
    required this.onUpdate,
    this.onAnomaly,
    this.onFinale,
    this.onConnectionChanged,
    this.socketFactory = openCockpitRealtimeSocket,
    this.backoff = cockpitReconnectBackoff,
  });

  final String sessionId;
  final RealtimeTokenReader readToken;
  final void Function() onUpdate;
  final void Function(AttendanceAnomalyEvent event)? onAnomaly;
  final void Function(SessionFinaleSummary summary)? onFinale;
  final void Function(bool connected)? onConnectionChanged;
  final CockpitRealtimeSocketFactory socketFactory;
  final List<Duration> backoff;

  CockpitRealtimeSocket? _socket;
  Timer? _retryTimer;
  int _burstRestarts = 0;
  bool _disposed = false;
  bool _connecting = false;

  /// Opens the socket. Idempotent: a second call while a socket exists (or
  /// while one is being created) is a no-op, so a rebuild can never
  /// double-connect.
  Future<void> connect() async {
    if (_disposed || _socket != null || _connecting) return;
    _connecting = true;
    try {
      final token = await readToken();
      if (_disposed) return;
      if (token == null || token.isEmpty) {
        // No bearer means no session to authenticate against; the screen is
        // being torn down on sign-out, so a retry loop would only hammer the
        // gateway.
        onConnectionChanged?.call(false);
        return;
      }
      _open();
    } finally {
      _connecting = false;
    }
  }

  void _open() {
    final options = io.OptionBuilder()
        .setTransports(<String>['websocket'])
        // Re-read the bearer on EVERY engine open: the initial connect and each
        // automatic reconnect (DD-F18).
        .setAuthFn((void Function(Map auth) callback) {
          unawaited(_authorize(callback));
        })
        .setReconnectionAttempts(cockpitSocketReconnectAttempts)
        .setReconnectionDelay(cockpitSocketReconnectDelay)
        .setTimeout(8000)
        .disableAutoConnect()
        .build();
    final socket = socketFactory(options);
    _socket = socket;

    socket.onConnect(() {
      if (_disposed) return;
      _burstRestarts = 0;
      _retryTimer?.cancel();
      _retryTimer = null;
      onConnectionChanged?.call(true);
      socket.emit('session:join', <String, dynamic>{'sessionId': sessionId});
    });
    socket.onDisconnect((_) {
      if (_disposed) return;
      onConnectionChanged?.call(false);
    });
    socket.onConnectError((_) {
      if (_disposed) return;
      onConnectionChanged?.call(false);
    });
    // Self-healing (DD-F8): the manager stops after its own burst, so start a
    // fresh, backed-off burst instead of leaving the radar dead for the rest of
    // the session.
    socket.onReconnectFailed(() {
      if (_disposed) return;
      onConnectionChanged?.call(false);
      _scheduleBurstRestart();
    });
    socket.on('attendance:updated', (_) => onUpdate());
    socket.on('session:state', (_) => onUpdate());
    socket.on('attendance:anomaly', (payload) {
      final map = payload is Map
          ? payload.cast<String, dynamic>()
          : <String, dynamic>{};
      try {
        onAnomaly?.call(AttendanceAnomalyEvent.fromJson(map));
      } catch (_) {
        // A malformed broadcast never breaks the live roster refresh.
      }
    });
    socket.on('session:finale', (payload) {
      final map = payload is Map
          ? payload.cast<String, dynamic>()
          : <String, dynamic>{};
      try {
        onFinale?.call(SessionFinaleSummary.fromJson(map));
      } catch (_) {
        // Ignore a malformed finale; the next poll still resolves the session.
      }
    });
    socket.connect();
  }

  /// Supplies the namespace CONNECT payload, re-reading the token each time.
  Future<void> _authorize(void Function(Map auth) callback) async {
    if (_disposed) return;
    final token = await readToken();
    if (_disposed) return;
    if (token == null || token.isEmpty) {
      onConnectionChanged?.call(false);
      _scheduleBurstRestart();
      return;
    }
    callback(<String, dynamic>{'token': token});
  }

  /// Schedules the next burst restart, tearing the dead socket down first so
  /// the replacement never overlaps the old one (no double-connect).
  void _scheduleBurstRestart() {
    if (_disposed || _retryTimer != null) return;
    final delay = backoff[math.min(_burstRestarts, backoff.length - 1)];
    _burstRestarts += 1;
    _retryTimer = Timer(delay, () {
      _retryTimer = null;
      if (_disposed) return;
      _teardownSocket();
      unawaited(connect());
    });
  }

  void _teardownSocket() {
    final socket = _socket;
    _socket = null;
    if (socket == null) return;
    try {
      socket.emit('session:leave', <String, dynamic>{'sessionId': sessionId});
    } catch (_) {
      // The gateway is unreachable; the socket is torn down anyway.
    }
    try {
      socket.dispose();
    } catch (_) {
      // Already disposed (the manager closed it after the burst).
    }
  }

  void dispose() {
    _disposed = true;
    _retryTimer?.cancel();
    _retryTimer = null;
    _teardownSocket();
  }
}

CockpitRealtimeSocket openCockpitRealtimeSocket(Map<String, dynamic> options) {
  return _SocketIoAdapter(io.io(ApiConfig.socketUrl, options));
}

class _SocketIoAdapter implements CockpitRealtimeSocket {
  _SocketIoAdapter(this._socket);

  final io.Socket _socket;

  @override
  void on(String event, void Function(dynamic payload) handler) =>
      _socket.on(event, handler);

  @override
  void onConnect(void Function() handler) =>
      _socket.onConnect((_) => handler());

  @override
  void onDisconnect(void Function(String reason) handler) =>
      _socket.onDisconnect((dynamic reason) => handler('$reason'));

  @override
  void onConnectError(void Function(Object? error) handler) =>
      _socket.onConnectError((dynamic error) => handler(error));

  @override
  void onReconnectFailed(void Function() handler) =>
      _socket.onReconnectFailed((_) => handler());

  @override
  void emit(String event, [dynamic data]) => _socket.emit(event, data);

  @override
  void connect() => _socket.connect();

  @override
  void dispose() => _socket.dispose();
}
