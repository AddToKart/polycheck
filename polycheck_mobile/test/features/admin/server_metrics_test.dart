import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/dashboard.dart';
import 'package:polycheck_mobile/src/features/admin/domain/server_metrics.dart';

ServerStatusSnapshot snapshot({
  int requests = 0,
  int errors = 0,
  int cpuSeconds = 0,
  double? p95,
}) {
  return ServerStatusSnapshot(
    timestamp: '2026-11-10T00:00:00Z',
    httpRequestsTotal: requests,
    httpErrorsTotal: errors,
    cpuSecondsTotal: cpuSeconds,
    latencyP95Ms: p95,
  );
}

void main() {
  test('rates derive from cumulative counters', () {
    final rates = deriveServerRates(
      snapshot(requests: 100, errors: 2, cpuSeconds: 10),
      snapshot(requests: 160, errors: 4, cpuSeconds: 12),
      10000,
    );
    expect(rates, isNotNull);
    expect(rates!.requestRatePerSecond, closeTo(6, 0.001));
    expect(rates.errorRatePerSecond, closeTo(0.2, 0.001));
    expect(rates.errorPercent, closeTo(3.333, 0.01));
    expect(rates.cpuPercent, closeTo(20, 0.001));
  });

  test('missing baseline, long gaps, and counter resets produce no rate', () {
    expect(deriveServerRates(null, snapshot(), 5000), isNull);
    expect(deriveServerRates(snapshot(), snapshot(requests: 10), 0), isNull);
    expect(
      deriveServerRates(snapshot(), snapshot(requests: 10), 31000),
      isNull,
    );
    expect(
      deriveServerRates(snapshot(requests: 10), snapshot(requests: 5), 5000),
      isNull,
    );
  });

  test('CPU is capped at 100 percent', () {
    final rates = deriveServerRates(
      snapshot(cpuSeconds: 0),
      snapshot(cpuSeconds: 50),
      5000,
    );
    expect(rates!.cpuPercent, 100);
  });

  test('append applies the 15-minute window and sample cap', () {
    var history = <ServerHistorySample>[];
    history = appendServerSample(history, snapshot(requests: 1), receivedAt: 0);
    history = appendServerSample(
      history,
      snapshot(requests: 2),
      receivedAt: 10000,
    );
    history = appendServerSample(
      history,
      snapshot(requests: 3),
      receivedAt: 20000,
      windowMs: 15000,
    );
    expect(history.length, 2);
    expect(history.first.snapshot.httpRequestsTotal, 2);
    expect(history.last.receivedAt, 20000);

    var capped = <ServerHistorySample>[];
    for (var index = 0; index < 10; index++) {
      capped = appendServerSample(
        capped,
        snapshot(requests: index),
        receivedAt: index * 5000,
        maxSamples: 4,
        windowMs: 999999,
      );
    }
    expect(capped.length, 4);
    expect(capped.last.snapshot.httpRequestsTotal, 9);
  });

  test('series inserts a null marker across reconnect gaps', () {
    final history = <ServerHistorySample>[
      const ServerHistorySample(
        snapshot: ServerStatusSnapshot(timestamp: ''),
        receivedAt: 0,
        rates: null,
      ),
      const ServerHistorySample(
        snapshot: ServerStatusSnapshot(timestamp: ''),
        receivedAt: 5000,
        rates: null,
      ),
      const ServerHistorySample(
        snapshot: ServerStatusSnapshot(timestamp: ''),
        receivedAt: 40000,
        rates: null,
      ),
    ];
    final series = seriesWithGaps(history, (sample) {
      return sample.receivedAt.toDouble();
    });
    expect(series, <double?>[0, 5000, null, 40000]);
  });

  test('sparkline segments split at null values', () {
    final segments = sparklineSegments(<double?>[1, null, 2, null, 3, 4]);
    expect(segments.length, 3);
    expect(segments[0].length, 1);
    expect(segments[1].length, 1);
    expect(segments[2].length, 2);
    expect(sparklineSegments(<double?>[null]).isEmpty, isTrue);
  });

  test('format helpers match the web copy', () {
    expect(formatRate(2.25), '2.3/s');
    expect(formatRate(null), '—');
    expect(formatLatency(0.4), '<1 ms');
    expect(formatLatency(95.6), '96 ms');
    expect(formatPercent(99.94), '99.9%');
    expect(formatByteSize(512), '512 B');
    expect(formatByteSize(1536), '1.50 KB');
    expect(formatUptime(30), '<1m');
    expect(formatUptime(3660), '1h 1m');
    expect(formatUptime(90000), '1d 1h');
    expect(formatSnapshotTimestamp('not-a-date'), '—');
  });
}
