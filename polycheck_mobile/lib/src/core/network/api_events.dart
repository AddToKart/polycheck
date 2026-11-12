import 'dart:async';

/// Emitted when an authenticated request receives 401 outside the login
/// endpoints. The token is already cleared by the Dio interceptor; the auth
/// provider handles the owner purge and router transition (A3).
class SessionExpiredEvent {
  const SessionExpiredEvent({
    required this.at,
    this.method,
    this.path,
    this.message,
  });

  final DateTime at;
  final String? method;
  final String? path;
  final String? message;
}

/// Emitted for a `503 { code: 'system_maintenance' }` response before the
/// typed error is thrown, so the root shell reacts even when the caller
/// catches and ignores the failure.
class MaintenanceEvent {
  const MaintenanceEvent({required this.message, this.estimatedEnd, this.at});

  final String message;
  final String? estimatedEnd;
  final DateTime? at;
}

/// Broadcast hub shared by the Dio interceptor and the Riverpod providers.
class ApiEvents {
  final StreamController<SessionExpiredEvent> _sessionExpired =
      StreamController<SessionExpiredEvent>.broadcast();
  final StreamController<MaintenanceEvent> _maintenance =
      StreamController<MaintenanceEvent>.broadcast();

  Stream<SessionExpiredEvent> get sessionExpired => _sessionExpired.stream;
  Stream<MaintenanceEvent> get maintenance => _maintenance.stream;

  void emitSessionExpired(SessionExpiredEvent event) {
    if (!_sessionExpired.isClosed) _sessionExpired.add(event);
  }

  void emitMaintenance(MaintenanceEvent event) {
    if (!_maintenance.isClosed) _maintenance.add(event);
  }

  Future<void> dispose() async {
    await _sessionExpired.close();
    await _maintenance.close();
  }
}
