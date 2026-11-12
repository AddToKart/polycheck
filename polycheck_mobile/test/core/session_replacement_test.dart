import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/network/session_replacement.dart';

/// Counting fake channel so [SessionReplacementMonitor] can be exercised
/// without a websocket.
class _FakeChannel implements SessionReplacementChannel {
  _FakeChannel();

  void Function()? _callback;

  @override
  void listen(void Function() onSessionReplaced) {
    _callback = onSessionReplaced;
  }

  void emit() {
    _callback?.call();
  }

  bool closed = false;

  @override
  void close() {
    closed = true;
  }
}

void main() {
  group('shouldTerminateForReplacedSession (decision parity)', () {
    test('an own in-flight login mutes termination without probing', () async {
      var probes = 0;

      final terminate = await shouldTerminateForReplacedSession(
        isOwnLoginInFlight: () => true,
        probeSession: () async {
          probes++;
          return true;
        },
      );

      expect(terminate, isFalse);
      expect(probes, 0);
    });

    test('an authoritative `/auth/me` rejection terminates', () async {
      final terminate = await shouldTerminateForReplacedSession(
        isOwnLoginInFlight: () => false,
        probeSession: () async => true,
      );

      expect(terminate, isTrue);
    });

    test('a still-valid session does not terminate', () async {
      final terminate = await shouldTerminateForReplacedSession(
        isOwnLoginInFlight: () => false,
        probeSession: () async => false,
      );

      expect(terminate, isFalse);
    });

    test('a network failure is never proof of revocation', () async {
      final terminate = await shouldTerminateForReplacedSession(
        isOwnLoginInFlight: () => false,
        probeSession: () async => null,
      );

      expect(terminate, isFalse);
    });

    test('a probe crash is treated as unknown (never termination)', () async {
      final terminate = await shouldTerminateForReplacedSession(
        isOwnLoginInFlight: () => false,
        probeSession: () async => throw Exception('offline'),
      );

      expect(terminate, isFalse);
    });
  });

  group('SessionProbe (`/auth/me` probe semantics)', () {
    test('a live profile is not a revocation', () async {
      final verdict = await const SessionProbe().invoke(
        () async => <String, dynamic>{'id': 'student-1'},
      );

      expect(verdict, isFalse);
    });

    test('a 401 is the authoritative revocation verdict', () async {
      final verdict = await const SessionProbe().invoke(() async {
        throw const ApiRequestError(message: 'revoked', status: 401);
      });

      expect(verdict, isTrue);
    });

    test(
      '`password_change_required` keeps the session (rotation gate owns it)',
      () async {
        final verdict = await const SessionProbe().invoke(() async {
          throw const ApiRequestError(
            message: 'rotate now',
            status: 403,
            code: 'password_change_required',
          );
        });

        expect(verdict, isFalse);
      },
    );

    test('network and server failures answer unknown', () async {
      final offline = await const SessionProbe().invoke(() async {
        throw const ApiRequestError(message: 'unreachable', status: 0);
      });
      final serverDown = await const SessionProbe().invoke(() async {
        throw const ApiRequestError(message: 'boom', status: 500);
      });
      final unknown = await const SessionProbe().invoke(() async {
        throw Exception('format error');
      });

      expect(offline, isNull);
      expect(serverDown, isNull);
      expect(unknown, isNull);
    });
  });

  group('SessionReplacementMonitor (event wiring)', () {
    test(
      'a broadcast drives the decision and terminates on confirmation',
      () async {
        final channel = _FakeChannel();
        var probes = 0;
        var terminations = 0;

        final monitor = SessionReplacementMonitor(
          readToken: () async => 'token-1',
          probeSession: () async {
            probes++;
            return true;
          },
          isOwnLoginInFlight: () => false,
          onTerminate: () async => terminations++,
          channelFactory:
              ({
                required socketUrl,
                required readToken,
                required onSessionReplaced,
              }) {
                return channel;
              },
        );

        await monitor.start();
        expect(monitor.isRunning, isTrue);

        channel.emit();
        // The decision is async; flush the microtask chain.
        await Future<void>.delayed(Duration.zero);
        await Future<void>.delayed(Duration.zero);

        expect(probes, 1);
        expect(terminations, 1);

        monitor.stop();
        expect(monitor.isRunning, isFalse);
        expect(channel.closed, isTrue);
      },
    );

    test('a muted broadcast (own login in flight) never terminates', () async {
      final channel = _FakeChannel();
      var terminations = 0;

      final monitor = SessionReplacementMonitor(
        readToken: () async => 'token-1',
        probeSession: () async => true,
        isOwnLoginInFlight: () => true,
        onTerminate: () async => terminations++,
        channelFactory:
            ({
              required socketUrl,
              required readToken,
              required onSessionReplaced,
            }) {
              return channel;
            },
      );

      await monitor.start();
      channel.emit();
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      expect(terminations, 0);

      // Next broadcast after the login completed terminates.
      monitor
        ..stop()
        ..stop();

      var terminationsAfter = 0;
      final secondMonitor = SessionReplacementMonitor(
        readToken: () async => 'token-1',
        probeSession: () async => true,
        isOwnLoginInFlight: () => false,
        onTerminate: () async => terminationsAfter++,
        channelFactory:
            ({
              required socketUrl,
              required readToken,
              required onSessionReplaced,
            }) {
              return channel;
            },
      );
      await secondMonitor.start();
      channel.emit();
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      expect(terminationsAfter, 1);
      expect(terminations, 0);
    });

    test('only one duplicate termination runs per event burst', () async {
      final channel = _FakeChannel();
      var probeAnswers = 0;
      var terminations = 0;

      final monitor = SessionReplacementMonitor(
        readToken: () async => 'token-1',
        probeSession: () async {
          probeAnswers++;
          // Simulate a slow probe so two bursts overlap.
          await Future<void>.delayed(const Duration(milliseconds: 20));
          return true;
        },
        isOwnLoginInFlight: () => false,
        onTerminate: () async {
          terminations++;
          await Future<void>.delayed(const Duration(milliseconds: 20));
        },
        channelFactory:
            ({
              required socketUrl,
              required readToken,
              required onSessionReplaced,
            }) {
              return channel;
            },
      );

      await monitor.start();
      channel.emit();
      channel.emit();
      await Future<void>.delayed(const Duration(milliseconds: 80));

      expect(probeAnswers, 1, reason: 'the in-flight guard serializes events');
      expect(terminations, 1);
    });

    test('start without a token never opens a channel', () async {
      var channels = 0;
      final monitor = SessionReplacementMonitor(
        readToken: () async => null,
        probeSession: () async => true,
        isOwnLoginInFlight: () => false,
        onTerminate: () async {},
        channelFactory:
            ({
              required socketUrl,
              required readToken,
              required onSessionReplaced,
            }) {
              channels++;
              return _FakeChannel();
            },
      );

      await monitor.start();
      await monitor.start();

      expect(channels, 0);
      expect(monitor.isRunning, isFalse);
    });

    test('a token-less start followed by a real start connects once', () async {
      final channel = _FakeChannel();
      var channels = 0;
      final monitor = SessionReplacementMonitor(
        readToken: () => Future<String?>.value('later-token'),
        probeSession: () async => true,
        isOwnLoginInFlight: () => false,
        onTerminate: () async {},
        channelFactory:
            ({
              required socketUrl,
              required readToken,
              required onSessionReplaced,
            }) {
              channels++;
              return channel;
            },
      );

      await monitor.start();
      expect(channels, 1);

      // Idempotent re-start (the binder calls start on every sign-in id).
      await monitor.start();
      expect(channels, 1);
    });
  });

  test('constants mirror the RN sources of truth', () {
    expect(authSessionReplacedEvent, 'auth:session-replaced');
    expect(ownLoginInFlightWindow, const Duration(seconds: 30));
    expect(
      sessionReplacedUserMessage,
      'Your session was replaced or revoked. Please sign in again.',
    );
  });
}
