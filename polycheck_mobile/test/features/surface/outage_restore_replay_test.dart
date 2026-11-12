import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/surface/data/outage_demo.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/widgets/outage_widgets.dart';

class _RecordingSyncController extends SyncController {
  _RecordingSyncController(this.onDrain);

  final VoidCallback onDrain;

  @override
  Future<SyncDrainReport> drainNow() async {
    onDrain();
    return const SyncDrainReport.skipped();
  }
}

/// The reconnect clock refresh is a network call; the harness keeps it local.
class _SilentClock extends TrustedClockNotifier {
  @override
  TrustedClock build() => const TrustedClock();

  @override
  Future<void> refreshQuietly() async {}
}

/// DD-F12: "Restore & replay" must drain the offline queue itself — waiting
/// for the periodic binder tick (up to 30 s) reads as a stalled replay.
void main() {
  testWidgets('Restore & replay drains the queue in the tap frame', (
    tester,
  ) async {
    var drains = 0;
    OutageDemo.arm();
    addTearDown(OutageDemo.disarm);

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          syncControllerProvider.overrideWith(
            () => _RecordingSyncController(() => drains += 1),
          ),
          trustedClockProvider.overrideWith(_SilentClock.new),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const Scaffold(body: OutageRestoreReplayButton()),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Restore & replay'), findsOneWidget);
    expect(drains, 0);

    await tester.tap(find.text('Restore & replay'));
    // The drain starts before the first await, i.e. inside the tap's frame.
    expect(drains, 1);

    await tester.pump();
    expect(OutageDemo.armed, isFalse);
    expect(drains, 1);
    expect(tester.takeException(), isNull);

    // Let the success toast retire so no timer outlives the test.
    await tester.pump(const Duration(seconds: 6));
    await tester.pump(const Duration(milliseconds: 500));
  });

  testWidgets('Restore & replay is inert while the simulation is disarmed', (
    tester,
  ) async {
    var drains = 0;
    OutageDemo.disarm();
    addTearDown(OutageDemo.disarm);

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          syncControllerProvider.overrideWith(
            () => _RecordingSyncController(() => drains += 1),
          ),
          trustedClockProvider.overrideWith(_SilentClock.new),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const Scaffold(body: OutageRestoreReplayButton()),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('Restore & replay'));
    await tester.pump();
    expect(drains, 0);
  });
}
