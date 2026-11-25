import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/ai_api.dart';

/// FLR-06: the assistant thread socket used to snapshot the bearer at
/// construction (`setAuth(<token>)`), so a reconnect after a mid-session token
/// rotation re-authenticated with a stale bearer.
///
/// It now mirrors `cockpit_realtime.dart` / `notification_realtime.dart`:
/// `setAuthFn` re-reads the token on every engine open. `socket_io_client`
/// literally stores the auth function under the `auth` option key
/// (`darty.dart:302` `setAuthFn` → `_opts['auth'] = authFn`), so the option map
/// is the contract under test.
void main() {
  group('assistant thread socket options', () {
    test('resolves the bearer per engine open, not at construction', () async {
      var reads = 0;
      String? token = 'token-old';

      final options = buildAiThreadSocketOptions(() async {
        reads += 1;
        return token;
      });

      expect(reads, 0, reason: 'construction must not read the token');
      final auth = options['auth'];
      expect(auth, isA<Function>(), reason: 'auth is an auth function');

      final sent = <Map<String, dynamic>>[];
      final authFn = auth! as void Function(void Function(Map) callback);
      authFn((data) => sent.add(data.cast<String, dynamic>()));
      await pumpEventQueue();

      expect(reads, 1);
      expect(sent.single['token'], 'token-old');

      // The bearer rotates while the socket is down; the next engine open
      // (a reconnect) reads it again.
      token = 'token-new';
      authFn((data) => sent.add(data.cast<String, dynamic>()));
      await pumpEventQueue();

      expect(reads, 2);
      expect(sent, hasLength(2));
      expect(sent.last['token'], 'token-new');
    });

    test('an empty token never sends a CONNECT payload', () async {
      final sent = <Map<String, dynamic>>[];
      final options = buildAiThreadSocketOptions(() async => '');

      final authFn =
          options['auth']! as void Function(void Function(Map) callback);
      authFn((data) => sent.add(data.cast<String, dynamic>()));
      await pumpEventQueue();

      expect(sent, isEmpty);
    });

    test(
      'a throwing token read is swallowed (engine reports connect error)',
      () async {
        final sent = <Map<String, dynamic>>[];
        final options = buildAiThreadSocketOptions(
          () async => throw StateError('keychain locked'),
        );

        final authFn =
            options['auth']! as void Function(void Function(Map) callback);
        authFn((data) => sent.add(data.cast<String, dynamic>()));
        await pumpEventQueue();

        expect(sent, isEmpty);
      },
    );

    test('keeps a websocket-only transport and a fresh engine per thread', () {
      final options = buildAiThreadSocketOptions(() async => 'token');

      expect(options['transports'], <String>['websocket']);
      expect(options['forceNew'], isTrue);
    });
  });
}
