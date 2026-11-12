import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user.dart';
import '../network/session_replacement.dart';
import '../providers/session_provider.dart';
import 'sync_engine.dart';

/// 30-second foreground drain cadence (RN `_layout.tsx:190` parity).
///
/// Extracted from the binder so the trigger is testable with `FakeAsync`:
/// [start] is idempotent, [stop] cancels, and each tick fires [onTick] — the
/// engine's in-flight guard makes overlapping triggers harmless.
class SyncForegroundDrainTimer {
  SyncForegroundDrainTimer({
    required this.onTick,
    this.interval = defaultInterval,
  });

  static const Duration defaultInterval = Duration(seconds: 30);

  final void Function() onTick;
  final Duration interval;
  Timer? _timer;

  bool get isRunning => _timer != null;

  void start() {
    if (_timer != null) return;
    _timer = Timer.periodic(interval, (_) => onTick());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }
}

/// Automatic drain + session-replacement triggers.
///
/// Mounted once by [PolycheckApp]; it is intentionally UI-free:
/// * a 30-second foreground drain timer (lifecycle-aware — paused while the
///   app is not visible),
/// * app resumes from the background,
/// * connectivity regains a network after being offline,
/// * a student session becomes active,
/// * the `auth:session-replaced` monitor (B-1) is kept alive while signed in.
///
/// The engine's in-flight guard makes overlapping triggers harmless.
class SyncLifecycleBinder extends ConsumerStatefulWidget {
  const SyncLifecycleBinder({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<SyncLifecycleBinder> createState() =>
      _SyncLifecycleBinderState();
}

class _SyncLifecycleBinderState extends ConsumerState<SyncLifecycleBinder>
    with WidgetsBindingObserver {
  StreamSubscription<List<ConnectivityResult>>? _connectivity;
  late final SyncForegroundDrainTimer _timer = SyncForegroundDrainTimer(
    onTick: _drain,
  );
  bool _online = true;
  bool _monitorSignedIn = false;

  /// Captured in `initState` because `ref` must never be read from `dispose()`
  /// (Riverpod 3 throws once the widget is deactivated).
  SessionReplacementMonitor? _replacementMonitor;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _connectivity = Connectivity().onConnectivityChanged.listen(
      _onConnectivity,
    );
    unawaited(_readInitialConnectivity());
    _timer.start();
    // Cold start with a restored student session and queued evidence.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _drain(ref.read(sessionProvider).user);
        _syncReplacementMonitor(ref.read(sessionProvider));
      }
    });
    // Start the realtime replacement monitor on process start so an
    // enterprise-time revocation lands even while the session state races.
    final monitor = ref.read(sessionReplacementMonitorProvider);
    _replacementMonitor = monitor;
    unawaited(monitor.start()); // ignore: discarded_futures
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_connectivity?.cancel());
    _timer.stop();
    _replacementMonitor?.stop();
    super.dispose();
  }

  Future<void> _readInitialConnectivity() async {
    try {
      final results = await Connectivity().checkConnectivity();
      _online = !results.contains(ConnectivityResult.none);
    } catch (_) {
      // Treat an unreadable radio state as online; the drain fails safely.
      _online = true;
    }
  }

  void _onConnectivity(List<ConnectivityResult> results) {
    final online = !results.contains(ConnectivityResult.none);
    final regained = online && !_online;
    _online = online;
    if (regained) _drain();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _timer.start();
        _drain();
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        _timer.stop();
    }
  }

  void _drain([User? forcedUser]) {
    final user =
        forcedUser ??
        () {
          final current = ref.read(sessionProvider).user;
          return current;
        }();
    if (user == null || user.role != UserRole.student) return;
    unawaited(ref.read(syncControllerProvider.notifier).drainNow());
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<SessionState>(sessionProvider, (previous, next) {
      final becameStudent =
          next.isSignedIn &&
          next.user?.role == UserRole.student &&
          previous?.isSignedIn != true;
      final switchedStudent =
          next.isSignedIn &&
          next.user?.role == UserRole.student &&
          previous?.user?.id != next.user?.id;
      if (becameStudent || switchedStudent) _drain();
      _syncReplacementMonitor(next);
    });
    return widget.child;
  }

  /// B-1 mount seam (the app bootstrap never changes): while a signed-in
  /// session exists the replacement monitor holds one authenticated realtime
  /// channel; on sign-out it is stopped. Re-login restarts it.
  void _syncReplacementMonitor(SessionState state) {
    final monitor = ref.read(sessionReplacementMonitorProvider);
    if (state.isSignedIn) {
      if (!_monitorSignedIn) {
        _monitorSignedIn = true;
        unawaited(monitor.start());
      }
      return;
    }
    _monitorSignedIn = false;
    monitor.stop();
  }
}
