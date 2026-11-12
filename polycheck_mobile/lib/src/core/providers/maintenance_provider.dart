import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../models/maintenance.dart';
import '../network/dio_client.dart';
import '../network/api_events.dart';
import 'session_provider.dart';

/// Router-facing maintenance state.
///
/// Sources, in order of authority:
/// * a canonical `503 { code: system_maintenance }` event published by the Dio
///   interceptor (A2),
/// * the public `GET /maintenance/status` snapshot probed at boot and by the
///   maintenance screen's 30-second recovery poll.
///
/// The estimate is display-only and never switches the mode off by itself.
@immutable
class MaintenanceState {
  const MaintenanceState({
    this.enabled = false,
    this.message = defaultMaintenanceMessage,
    this.estimatedEnd,
    this.probing = false,
    this.error,
  });

  final bool enabled;
  final String message;
  final String? estimatedEnd;
  final bool probing;
  final String? error;

  MaintenanceState copyWith({
    bool? enabled,
    String? message,
    String? estimatedEnd,
    bool clearEstimatedEnd = false,
    bool? probing,
    String? error,
    bool clearError = false,
  }) {
    return MaintenanceState(
      enabled: enabled ?? this.enabled,
      message: message ?? this.message,
      estimatedEnd: clearEstimatedEnd
          ? null
          : (estimatedEnd ?? this.estimatedEnd),
      probing: probing ?? this.probing,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class MaintenanceController extends Notifier<MaintenanceState> {
  Timer? _timer;
  bool _probing = false;

  static const Duration pollInterval = Duration(seconds: 30);

  @override
  MaintenanceState build() {
    ref.listen(maintenanceEventsProvider, (previous, next) {
      if (next case AsyncData<MaintenanceEvent>(:final value)) {
        _applyAnnouncement(
          message: value.message,
          estimatedEnd: value.estimatedEnd,
        );
      }
    });
    ref.onDispose(_cancelTimer);
    Future<void>.microtask(probeQuietly);
    return const MaintenanceState();
  }

  /// Probes the public status endpoint. Returns the authoritative enabled flag.
  Future<bool> probe({bool quiet = false}) async {
    if (_probing) return state.enabled;
    _probing = true;
    if (!quiet) {
      state = state.copyWith(probing: true, clearError: true);
    }
    try {
      final status = await ref.read(settingsApiProvider).getMaintenanceStatus();
      if (status.enabled) {
        final message = (status.message ?? '').trim();
        final resolved = message.isEmpty ? defaultMaintenanceMessage : message;
        state = MaintenanceState(
          enabled: true,
          message: resolved,
          estimatedEnd: status.estimatedEnd,
        );
        ref
            .read(sessionProvider.notifier)
            .setMaintenance(
              MaintenanceBlockBody(
                message: resolved,
                estimatedEnd: status.estimatedEnd,
              ),
            );
      } else {
        state = const MaintenanceState();
        ref.read(sessionProvider.notifier).setMaintenance(null);
      }
      return status.enabled;
    } catch (_) {
      if (!quiet) {
        state = state.copyWith(
          probing: false,
          error:
              'Unable to reach the Polycheck server. Check your connection '
              'and try again.',
        );
      }
      return state.enabled;
    } finally {
      _probing = false;
    }
  }

  Future<void> probeQuietly() async {
    await probe(quiet: true);
  }

  void _applyAnnouncement({String? message, String? estimatedEnd}) {
    final trimmed = (message ?? '').trim();
    state = MaintenanceState(
      enabled: true,
      message: trimmed.isEmpty ? defaultMaintenanceMessage : trimmed,
      estimatedEnd: estimatedEnd,
    );
  }

  /// Starts the 30-second recovery poll (maintenance screen only).
  void startPolling() {
    if (_timer != null) return;
    _timer = Timer.periodic(pollInterval, (_) {
      unawaited(probeQuietly());
    });
  }

  void stopPolling() {
    _cancelTimer();
  }

  void _cancelTimer() {
    _timer?.cancel();
    _timer = null;
  }
}

final maintenanceProvider =
    NotifierProvider<MaintenanceController, MaintenanceState>(
      MaintenanceController.new,
    );
