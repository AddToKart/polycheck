import '../../../core/models/dashboard.dart';

/// Mirrors `frontend/src/lib/server-status.ts`: 15 minutes of 5 s ticks with
/// gap-aware sparkline series.

const int serverHistoryMaxSamples = 180;
const int serverHistoryWindowMs = 15 * 60 * 1000;
const int serverRateMaxGapMs = 30 * 1000;

class ServerRateDeltas {
  const ServerRateDeltas({
    required this.requestRatePerSecond,
    required this.errorRatePerSecond,
    required this.errorPercent,
    required this.cpuPercent,
  });

  final double requestRatePerSecond;
  final double errorRatePerSecond;
  final double errorPercent;
  final double cpuPercent;
}

class ServerHistorySample {
  const ServerHistorySample({
    required this.snapshot,
    required this.receivedAt,
    required this.rates,
  });

  final ServerStatusSnapshot snapshot;
  final int receivedAt;
  final ServerRateDeltas? rates;
}

double _clampPercent(double value) {
  if (!value.isFinite) return 0;
  return value.clamp(0, 100).toDouble();
}

ServerRateDeltas? deriveServerRates(
  ServerStatusSnapshot? previous,
  ServerStatusSnapshot next,
  int elapsedMs,
) {
  if (previous == null) return null;
  if (elapsedMs <= 0 || elapsedMs > serverRateMaxGapMs) return null;
  final requests = next.httpRequestsTotal - previous.httpRequestsTotal;
  final errors = next.httpErrorsTotal - previous.httpErrorsTotal;
  final cpuSeconds = next.cpuSecondsTotal - previous.cpuSecondsTotal;
  if (requests < 0 || errors < 0 || cpuSeconds < 0) return null;
  final seconds = elapsedMs / 1000;
  return ServerRateDeltas(
    requestRatePerSecond: requests / seconds,
    errorRatePerSecond: errors / seconds,
    errorPercent: requests > 0 ? (errors / requests) * 100 : 0,
    cpuPercent: _clampPercent((cpuSeconds / seconds) * 100),
  );
}

List<ServerHistorySample> appendServerSample(
  List<ServerHistorySample> history,
  ServerStatusSnapshot snapshot, {
  int? receivedAt,
  int maxSamples = serverHistoryMaxSamples,
  int windowMs = serverHistoryWindowMs,
}) {
  final now = receivedAt ?? DateTime.now().millisecondsSinceEpoch;
  final previous = history.isEmpty ? null : history.last;
  final rates = deriveServerRates(
    previous?.snapshot,
    snapshot,
    previous == null ? 0 : now - previous.receivedAt,
  );
  final next = <ServerHistorySample>[
    ...history,
    ServerHistorySample(snapshot: snapshot, receivedAt: now, rates: rates),
  ];
  final windowed = next
      .where((sample) => now - sample.receivedAt <= windowMs)
      .toList(growable: false);
  if (windowed.length <= maxSamples) return windowed;
  return windowed.sublist(windowed.length - maxSamples);
}

bool isHistoryGap(
  ServerHistorySample? previous,
  ServerHistorySample current, {
  int maxGapMs = serverRateMaxGapMs,
}) {
  if (previous == null) return false;
  return current.receivedAt - previous.receivedAt > maxGapMs;
}

List<double?> seriesWithGaps(
  List<ServerHistorySample> history,
  double? Function(ServerHistorySample sample) project, {
  int maxGapMs = serverRateMaxGapMs,
}) {
  final values = <double?>[];
  for (var index = 0; index < history.length; index++) {
    final sample = history[index];
    if (isHistoryGap(
      index == 0 ? null : history[index - 1],
      sample,
      maxGapMs: maxGapMs,
    )) {
      values.add(null);
    }
    values.add(project(sample));
  }
  return values;
}

class SparklinePoint {
  const SparklinePoint(this.x, this.y);

  final double x;
  final double y;
}

List<List<SparklinePoint>> sparklineSegments(
  List<double?> values, {
  double width = 100,
  double height = 32,
  double padding = 2,
}) {
  final finite = values
      .whereType<double>()
      .where((value) => value.isFinite)
      .toList(growable: false);
  if (finite.isEmpty) return const <List<SparklinePoint>>[];
  var min = finite.reduce((a, b) => a < b ? a : b);
  var max = finite.reduce((a, b) => a > b ? a : b);
  if (min == max) {
    min -= 1;
    max += 1;
  }
  final usableHeight = (height - padding * 2).clamp(1, height).toDouble();
  final segments = <List<SparklinePoint>>[];
  var current = <SparklinePoint>[];
  for (var index = 0; index < values.length; index++) {
    final value = values[index];
    if (value == null || !value.isFinite) {
      if (current.isNotEmpty) segments.add(current);
      current = <SparklinePoint>[];
      continue;
    }
    final x = values.length <= 1
        ? width / 2
        : (index / (values.length - 1)) * width;
    final y = height - padding - ((value - min) / (max - min)) * usableHeight;
    current.add(SparklinePoint(x, y));
  }
  if (current.isNotEmpty) segments.add(current);
  return segments;
}

String formatRate(double? value) {
  if (value == null || !value.isFinite) return '—';
  return '${value.toStringAsFixed(1)}/s';
}

String formatLatency(double? value) {
  if (value == null || !value.isFinite) return '—';
  if (value < 1) return '<1 ms';
  return '${value.round()} ms';
}

String formatPercent(double? value, {int fractionDigits = 1}) {
  if (value == null || !value.isFinite) return '—';
  return '${value.toStringAsFixed(fractionDigits)}%';
}

String formatByteSize(int? bytes) {
  if (bytes == null || bytes < 0) return '—';
  if (bytes < 1024) return '$bytes B';
  const units = <String>['KB', 'MB', 'GB', 'TB'];
  var value = bytes / 1024;
  var unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  final decimals = value >= 100
      ? 0
      : value >= 10
      ? 1
      : 2;
  return '${value.toStringAsFixed(decimals)} ${units[unit]}';
}

String formatUptime(int seconds) {
  if (seconds < 0) return '—';
  final totalMinutes = seconds ~/ 60;
  if (totalMinutes < 1) return '<1m';
  final days = totalMinutes ~/ (60 * 24);
  final hours = (totalMinutes % (60 * 24)) ~/ 60;
  final minutes = totalMinutes % 60;
  if (days > 0) return '${days}d ${hours}h';
  if (hours > 0) return '${hours}h ${minutes}m';
  return '${minutes}m';
}

String _two(int value) => value.toString().padLeft(2, '0');

String formatSnapshotTimestamp(String iso) {
  final date = DateTime.tryParse(iso);
  if (date == null) return '—';
  final local = date.toLocal();
  return '${_two(local.hour)}:${_two(local.minute)}:${_two(local.second)}';
}

String formatDateTimeLabel(String iso) {
  final date = DateTime.tryParse(iso);
  if (date == null) return iso;
  final local = date.toLocal();
  return '${local.year}-${_two(local.month)}-${_two(local.day)} '
      '${_two(local.hour)}:${_two(local.minute)}';
}
