import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../database/app_database.dart';

/// Trusted time = device UTC epoch + persisted server offset.
///
/// Mirrors plan K1: no attendance/token decision reads the raw device wall
/// clock. The offset is measured from `GET /health` (`timestamp`) using the
/// request midpoint, persisted in [CachedMeta] under the ownerless row, and
/// reused after a cold start.
class TrustedClock {
  const TrustedClock({this.offsetMs = 0});

  final int offsetMs;

  int nowMs({DateTime Function()? deviceNow}) {
    final device = (deviceNow ?? DateTime.now).call().toUtc();
    return device.millisecondsSinceEpoch + offsetMs;
  }

  DateTime now({DateTime Function()? deviceNow}) {
    return DateTime.fromMillisecondsSinceEpoch(
      nowMs(deviceNow: deviceNow),
      isUtc: true,
    );
  }

  TrustedClock withOffset(int nextOffsetMs) {
    return TrustedClock(offsetMs: nextOffsetMs);
  }
}

/// Server offset from a health probe; the midpoint removes half the round trip
/// from the measurement on a symmetric connection.
int computeServerClockOffsetMs({
  required DateTime serverTimestamp,
  required DateTime requestStartedAt,
  required DateTime requestCompletedAt,
}) {
  final midpoint =
      requestStartedAt.toUtc().millisecondsSinceEpoch +
      (requestCompletedAt.toUtc().millisecondsSinceEpoch -
              requestStartedAt.toUtc().millisecondsSinceEpoch) ~/
          2;
  return serverTimestamp.toUtc().millisecondsSinceEpoch - midpoint;
}

class TrustedClockNotifier extends Notifier<TrustedClock> {
  Timer? _timer;
  AppLifecycleListener? _lifecycle;
  bool _refreshing = false;

  static const Duration refreshInterval = Duration(minutes: 5);
  static const Duration maxPersistedAge = Duration(days: 7);

  @override
  TrustedClock build() {
    ref.onDispose(() {
      _timer?.cancel();
      _lifecycle?.dispose();
    });
    Future<void>.microtask(() async {
      await loadPersisted();
      // Startup probe: a persisted offset stays authoritative if this fails.
      await refreshQuietly();
    });
    return const TrustedClock();
  }

  /// Reads the last measured offset without touching the network.
  Future<void> loadPersisted() async {
    final database = ref.read(appDatabaseProvider);
    final offset = await database.readClockOffsetMs();
    if (offset == null) return;
    final measuredAt = await database.readClockOffsetAt();
    if (measuredAt != null &&
        DateTime.now().toUtc().difference(measuredAt) > maxPersistedAge) {
      return;
    }
    state = state.withOffset(offset);
  }

  /// Manual refresh. Throws the typed API failure so a "refresh clock" action
  /// can explain it; the periodic path uses [refreshQuietly].
  Future<int?> refresh() async {
    if (_refreshing) return null;
    _refreshing = true;
    final startedAt = DateTime.now().toUtc();
    try {
      final serverTimestamp = await ref
          .read(sessionApiProvider)
          .healthTimestamp();
      final completedAt = DateTime.now().toUtc();
      final offset = computeServerClockOffsetMs(
        serverTimestamp: serverTimestamp,
        requestStartedAt: startedAt,
        requestCompletedAt: completedAt,
      );
      state = state.withOffset(offset);
      await ref
          .read(appDatabaseProvider)
          .writeClockOffset(offset, updatedAt: completedAt);
      return offset;
    } finally {
      _refreshing = false;
    }
  }

  Future<void> refreshQuietly() async {
    try {
      await refresh();
    } catch (_) {
      // The persisted offset remains authoritative for offline class actions.
    }
  }

  /// Starts the 5-minute foreground refresh loop (call once from app bootstrap).
  void startPeriodicRefresh() {
    _startTimer();
    _lifecycle ??= AppLifecycleListener(
      onResume: () {
        refreshQuietly();
        _startTimer();
      },
      onPause: _stopTimer,
      onHide: _stopTimer,
      onShow: () {
        refreshQuietly();
        _startTimer();
      },
    );
    refreshQuietly();
  }

  void stopPeriodicRefresh() {
    _stopTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(refreshInterval, (_) => refreshQuietly());
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }
}

final trustedClockProvider =
    NotifierProvider<TrustedClockNotifier, TrustedClock>(
      TrustedClockNotifier.new,
    );
