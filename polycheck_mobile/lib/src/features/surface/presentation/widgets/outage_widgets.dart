import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/network/dio_client.dart';
import '../../../../core/providers/trusted_clock.dart';
import '../../../../core/sync/sync_engine.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/campus_toast.dart';
import '../../data/outage_demo.dart';

/// Installs the demo interceptor once per process when the flag is on.
///
/// The core Dio client does not know about the dev simulator (core is owned
/// by the foundation wave), so the surface attaches its own guard: while
/// armed every request rejects with a connection-shaped failure, which makes
/// the real offline queues and error classifiers run exactly as in a campus
/// outage.
abstract final class SurfaceOutageInterceptor {
  static bool _installed = false;

  static void install(Dio dio) {
    if (!OutageDemo.enabled || _installed) return;
    _installed = true;
    dio.interceptors.insert(
      0,
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (OutageDemo.armed) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
                error: OutageDemo.createFailure(),
              ),
            );
            return;
          }
          handler.next(options);
        },
      ),
    );
  }
}

/// Floating dev-only pill for an armed outage simulation.
///
/// Other shells may mount this widget when `OutageDemo.enabled` is true; it
/// renders nothing in normal builds.
class OutagePill extends StatefulWidget {
  const OutagePill({super.key, this.onRestore});

  final VoidCallback? onRestore;

  @override
  State<OutagePill> createState() => _OutagePillState();
}

class _OutagePillState extends State<OutagePill> {
  late bool _armed = OutageDemo.armed;
  void Function()? _unsubscribe;

  @override
  void initState() {
    super.initState();
    if (!OutageDemo.enabled) return;
    _unsubscribe = OutageDemo.subscribe((armed) {
      if (mounted) setState(() => _armed = armed);
    });
  }

  @override
  void dispose() {
    _unsubscribe?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!OutageDemo.enabled || !_armed) return const SizedBox.shrink();
    final tokens = PupTheme.of(context);
    return Material(
      color: tokens.deepMaroon,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.zero,
        side: BorderSide(color: tokens.gold),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color: tokens.gold,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 7),
            Text(
              'OFFLINE SIMULATION',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: tokens.gold,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(width: 8),
            TextButton(
              onPressed: () {
                OutageDemo.disarm();
                widget.onRestore?.call();
              },
              style: TextButton.styleFrom(
                minimumSize: const Size(48, 30),
                padding: const EdgeInsets.symmetric(horizontal: 6),
                foregroundColor: tokens.gold,
              ),
              child: const Text('RESTORE'),
            ),
          ],
        ),
      ),
    );
  }
}

/// "Restore & replay": disarms the simulated outage, refreshes the trusted
/// clock offset and immediately drains the offline queue.
///
/// Lives outside [OutageDevSection] (which the build flag hides) so the
/// replay behaviour stays widget-testable in a default build.
class OutageRestoreReplayButton extends ConsumerStatefulWidget {
  const OutageRestoreReplayButton({super.key, this.onRestored});

  /// Called after the replay drain completes (receipt bookkeeping).
  final VoidCallback? onRestored;

  @override
  ConsumerState<OutageRestoreReplayButton> createState() =>
      _OutageRestoreReplayButtonState();
}

class _OutageRestoreReplayButtonState
    extends ConsumerState<OutageRestoreReplayButton> {
  bool _armed = OutageDemo.armed;
  bool _restoring = false;
  void Function()? _unsubscribe;

  @override
  void initState() {
    super.initState();
    _unsubscribe = OutageDemo.subscribe((armed) {
      if (mounted) setState(() => _armed = armed);
    });
  }

  @override
  void dispose() {
    _unsubscribe?.call();
    super.dispose();
  }

  Future<void> _restore() async {
    if (_restoring) return;
    setState(() => _restoring = true);
    OutageDemo.disarm();
    // Kick the queue drain in the tap's own frame: the periodic lifecycle
    // binder tick is up to 30 s away, which reads as a stalled replay.
    final drain = ref.read(syncControllerProvider.notifier).drainNow();
    // A fresh trusted-clock offset is the first thing a real reconnect does.
    await ref.read(trustedClockProvider.notifier).refreshQuietly();
    final report = await drain;
    if (!mounted) return;
    widget.onRestored?.call();
    CampusToast.showIn(
      context,
      '${OutageDemo.replayNotice} ${syncDrainMessage(report)}',
      tone: CampusToastTone.success,
      duration: const Duration(seconds: 5),
    );
    setState(() => _restoring = false);
  }

  @override
  Widget build(BuildContext context) {
    return CampusButton(
      label: 'Restore & replay',
      icon: Icons.sync,
      variant: CampusButtonVariant.gold,
      onPressed: _armed && !_restoring ? () => unawaited(_restore()) : null,
    );
  }
}

/// Profile dev section: arm / disarm / restore & replay + receipt chip.
class OutageDevSection extends ConsumerStatefulWidget {
  const OutageDevSection({super.key});

  @override
  ConsumerState<OutageDevSection> createState() => _OutageDevSectionState();
}

class _OutageDevSectionState extends ConsumerState<OutageDevSection> {
  bool _armed = OutageDemo.armed;
  int _receiptSequence = 0;
  String? _operationId;
  String? _receipt;
  void Function()? _unsubscribe;

  @override
  void initState() {
    super.initState();
    if (OutageDemo.enabled) {
      SurfaceOutageInterceptor.install(ref.read(dioProvider));
    }
    _unsubscribe = OutageDemo.subscribe((armed) {
      if (mounted) setState(() => _armed = armed);
    });
  }

  @override
  void dispose() {
    _unsubscribe?.call();
    super.dispose();
  }

  void _arm() {
    OutageDemo.arm();
    setState(() {
      _armed = true;
      _operationId = const Uuid().v4();
    });
    CampusToast.showIn(
      context,
      'Outage simulation armed. ${OutageDemo.armedCopy}',
      tone: CampusToastTone.warning,
      duration: const Duration(seconds: 4),
    );
  }

  void _handleRestored() {
    if (!mounted) return;
    setState(() {
      _receiptSequence += 1;
      _receipt = OutageDemo.receipt(_receiptSequence, _operationId);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!OutageDemo.enabled) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: PupTheme.of(context).surface,
          border: Border.all(color: PupTheme.of(context).borderSubtle),
        ),
        child: Text(
          'The outage simulator is disabled in this build. Enable it with '
          '--dart-define=ENABLE_OUTAGE_SIMULATOR=true for demos.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: PupTheme.of(context).muted,
            height: 1.4,
          ),
        ),
      );
    }

    final tokens = PupTheme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tokens.surface,
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Internet outage simulator',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Demo-only tools behind ENABLE_OUTAGE_SIMULATOR. Arming makes '
            'every request fail like a campus network outage so the real '
            'offline paths can be demonstrated.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.4),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: _armed
                      ? (tokens.isDark ? tokens.gold : tokens.maroon)
                      : tokens.muted,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                _armed ? 'SIMULATION ARMED' : 'NETWORK PASS-THROUGH',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          CampusButton(
            label: 'Arm outage',
            icon: Icons.bolt_outlined,
            variant: CampusButtonVariant.outline,
            onPressed: _armed ? null : _arm,
          ),
          const SizedBox(height: 8),
          OutageRestoreReplayButton(onRestored: _handleRestored),
          const SizedBox(height: 8),
          CampusButton(
            label: 'Disarm only',
            icon: Icons.power_settings_new,
            variant: CampusButtonVariant.outline,
            onPressed: _armed
                ? () {
                    OutageDemo.disarm();
                    setState(() => _armed = false);
                  }
                : null,
          ),
          if (_receipt != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: tokens.campus,
                  border: Border.all(color: tokens.gold),
                ),
                child: Text(
                  _receipt!,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.isDark ? tokens.gold : tokens.maroon,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
