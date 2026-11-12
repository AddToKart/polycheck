import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/features/faculty/data/cockpit_realtime.dart';

/// Minimal stand-in for `socket_io_client`'s socket: records the wiring the
/// cockpit installed and lets the test drive the manager's events.
class _FakeSocket implements CockpitRealtimeSocket {
  _FakeSocket(this.options);

  final Map<String, dynamic> options;
  final List<Map<String, dynamic>> sentAuth = <Map<String, dynamic>>[];
  final List<String> emitted = <String>[];
  final Map<String, void Function(dynamic payload)> handlers =
      <String, void Function(dynamic payload)>{};

  void Function()? _onConnect;
  void Function(String reason)? _onDisconnect;
  void Function(Object? error)? _onConnectError;
  void Function()? _onReconnectFailed;

  int connectCount = 0;
  bool disposed = false;

  /// `Socket.onopen`: the engine opened, so the `setAuthFn` callback resolved
  /// the CONNECT payload for this (re)connect.
  void simulateOpen() {
    final auth = options['auth'];
    expect(auth, isA<Function>(), reason: 'auth is resolved per engine open');
    (auth as void Function(void Function(Map auth) callback))((data) {
      sentAuth.add(data.cast<String, dynamic>());
    });
  }

  void simulateConnect() => _onConnect?.call();
  void simulateDisconnect(String reason) => _onDisconnect?.call(reason);
  void simulateConnectError(Object? error) => _onConnectError?.call(error);
  void simulateReconnectFailed() => _onReconnectFailed?.call();
  void simulateEvent(String event, dynamic payload) =>
      handlers[event]?.call(payload);

  @override
  void on(String event, void Function(dynamic payload) handler) =>
      handlers[event] = handler;

  @override
  void onConnect(void Function() handler) => _onConnect = handler;

  @override
  void onDisconnect(void Function(String reason) handler) =>
      _onDisconnect = handler;

  @override
  void onConnectError(void Function(Object? error) handler) =>
      _onConnectError = handler;

  @override
  void onReconnectFailed(void Function() handler) =>
      _onReconnectFailed = handler;

  @override
  void emit(String event, [dynamic data]) => emitted.add(event);

  @override
  void connect() => connectCount += 1;

  @override
  void dispose() => disposed = true;
}

void main() {
  test('re-reads the bearer on every connect and self-heals after the manager '
      'gives up (DD-F8 / DD-F18)', () async {
    var token = 'token-old';
    final sockets = <_FakeSocket>[];
    final connection = <bool>[];

    final realtime = CockpitRealtime(
      sessionId: 'sess-1',
      readToken: () async => token,
      onUpdate: () {},
      onConnectionChanged: connection.add,
      socketFactory: (options) {
        final socket = _FakeSocket(options);
        sockets.add(socket);
        return socket;
      },
      backoff: const <Duration>[Duration(milliseconds: 1)],
    );

    await realtime.connect();
    // Idempotent: a rebuild must never open a second socket.
    await realtime.connect();
    expect(sockets, hasLength(1));
    expect(sockets.single.connectCount, 1);

    sockets.single.simulateOpen();
    await pumpEventQueue();
    expect(sockets.single.sentAuth.single['token'], 'token-old');

    sockets.single.simulateConnect();
    expect(connection.last, isTrue);
    expect(sockets.single.emitted, contains('session:join'));

    // The bearer rotates while the socket is down.
    token = 'token-new';
    sockets.single.simulateDisconnect('transport close');
    expect(connection.last, isFalse);

    // The manager's own burst (8 × 1 s) is exhausted — the cockpit used to
    // sit dead from here on.
    sockets.single.simulateReconnectFailed();
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await pumpEventQueue();

    expect(sockets, hasLength(2), reason: 'a fresh burst is started');
    expect(sockets.first.disposed, isTrue, reason: 'no overlapping socket');
    expect(sockets.first.emitted, contains('session:leave'));

    sockets.last.simulateOpen();
    await pumpEventQueue();
    expect(
      sockets.last.sentAuth.single['token'],
      'token-new',
      reason: 'the reconnect authenticates with the rotated bearer',
    );

    realtime.dispose();
    expect(sockets.last.disposed, isTrue);
  });

  test('a signed-out bearer never opens a socket', () async {
    final sockets = <_FakeSocket>[];
    final connection = <bool>[];

    final realtime = CockpitRealtime(
      sessionId: 'sess-1',
      readToken: () async => null,
      onUpdate: () {},
      onConnectionChanged: connection.add,
      socketFactory: (options) {
        final socket = _FakeSocket(options);
        sockets.add(socket);
        return socket;
      },
    );

    await realtime.connect();

    expect(sockets, isEmpty);
    expect(connection, <bool>[false]);
    realtime.dispose();
  });
}
