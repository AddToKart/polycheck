/// Pure maintenance countdown formatting (port of
/// `frontend/src/components/maintenance/maintenance-time.ts`).
///
/// `maintenance_until` is an estimate only: once the deadline passes the mode
/// stays on and the UI asks the user to retry later or contact the IT desk.
enum MaintenanceCountdownTone { none, pending, overdue }

class MaintenanceCountdown {
  const MaintenanceCountdown(this.tone, this.label);

  final MaintenanceCountdownTone tone;
  final String label;
}

MaintenanceCountdown formatMaintenanceRemaining(
  String? estimatedEnd,
  int nowMs,
) {
  final raw = estimatedEnd?.trim();
  if (raw == null || raw.isEmpty) {
    return const MaintenanceCountdown(MaintenanceCountdownTone.none, '');
  }
  final target = DateTime.tryParse(raw);
  if (target == null) {
    return const MaintenanceCountdown(MaintenanceCountdownTone.none, '');
  }

  final remainingMs = target.toUtc().millisecondsSinceEpoch - nowMs;
  if (remainingMs <= 0) {
    return const MaintenanceCountdown(
      MaintenanceCountdownTone.overdue,
      'Resumption is overdue - contact the IT desk',
    );
  }

  final totalMinutes = (remainingMs / 60000).ceil();
  if (totalMinutes < 60) {
    return MaintenanceCountdown(
      MaintenanceCountdownTone.pending,
      'Estimated resumption in $totalMinutes min',
    );
  }
  final hours = totalMinutes ~/ 60;
  final minutes = totalMinutes % 60;
  final suffix = minutes > 0 ? ' $minutes min' : '';
  return MaintenanceCountdown(
    MaintenanceCountdownTone.pending,
    'Estimated resumption in $hours h$suffix',
  );
}
