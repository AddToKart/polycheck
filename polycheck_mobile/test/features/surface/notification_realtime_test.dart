import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/surface/data/notification_realtime.dart';

/// Secure-storage reads throw on some Android devices; the inbox creates the
/// realtime client fire-and-forget, so an escaping future used to surface as
/// unhandled zone noise (DD-F15).
class _ThrowingTokenStore implements TokenStore {
  @override
  Future<String?> read() async {
    throw StateError('secure storage unavailable');
  }

  @override
  Future<void> write(String value) async {}

  @override
  Future<void> clear() async {}
}

void main() {
  test('start() failure is caught and reported as disconnected', () async {
    final connections = <bool>[];
    final realtime = NotificationRealtime(
      tokenStore: _ThrowingTokenStore(),
      onNotification: (_) {},
      onConnection: connections.add,
    );
    addTearDown(realtime.dispose);

    // `expectLater(..., completes)` fails if the future escapes with an error,
    // and flutter_test's zone fails the test on any unhandled async error.
    await expectLater(realtime.start(), completes);

    expect(connections, <bool>[false]);
  });
}
