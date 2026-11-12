import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/maintenance_provider.dart';
import '../providers/session_provider.dart';
import '../providers/student_officer_provider.dart';
import 'router_decision.dart';

/// ChangeNotifier bridge between Riverpod session/maintenance state and
/// GoRouter's `refreshListenable`.
///
/// All guard logic lives in [decideRoute]; this class only assembles inputs,
/// remembers the last authenticated role (for session-expired login routing),
/// and coalesces notifications.
class RouterNotifier extends ChangeNotifier {
  RouterNotifier(this._ref) {
    _ref.listen<SessionState>(sessionProvider, _onSessionChanged);
    _ref.listen<MaintenanceState>(maintenanceProvider, (previous, next) {
      _scheduleRefresh();
    });
    _ref.listen<AsyncValue<StudentOfficerFlags>>(studentOfficerProvider, (
      previous,
      next,
    ) {
      _scheduleRefresh();
    });
    _captureRole(_ref.read(sessionProvider));
  }

  final Ref _ref;
  AppRole? _lastRole;
  bool _disposed = false;
  bool _refreshScheduled = false;

  AppRole? get lastRole => _lastRole;

  /// GoRouter redirect entry point.
  String? redirect(GoRouterState state) {
    return routeDecisionFor(state.uri.toString()).redirect;
  }

  /// Exposed for tests and debug tooling.
  RouteDecision routeDecisionFor(String location) {
    final session = _ref.read(sessionProvider);
    final officers =
        _ref.read(studentOfficerProvider).value ?? StudentOfficerFlags.none;
    return decideRoute(
      location: location,
      status: session.status,
      user: session.user,
      maintenanceActive: _ref.read(maintenanceProvider).enabled,
      hasExpiredSession: session.expiredAt != null,
      lastRole: _lastRole,
      officerPresident: officers.isPresident,
      officerQac: officers.isQac,
    );
  }

  void _onSessionChanged(SessionState? previous, SessionState next) {
    _captureRole(next);
    _scheduleRefresh();
  }

  void _captureRole(SessionState state) {
    final user = state.user;
    if (user == null) return;
    _lastRole = resolveAppRole(
      user,
      officerPresident: false,
      officerQac: false,
    );
  }

  void _scheduleRefresh() {
    if (_disposed || _refreshScheduled) return;
    _refreshScheduled = true;
    scheduleMicrotask(() {
      _refreshScheduled = false;
      if (!_disposed) notifyListeners();
    });
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  final notifier = RouterNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});
