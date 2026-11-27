/// Mirrors `HostSessionState` in `shared/src/types/section-role.ts`
/// (`GET /sessions/:id/host`): what a section president can do with a session
/// they created.
class HostRosterEntry {
  const HostRosterEntry({
    required this.studentName,
    required this.status,
    this.scannedAt,
  });

  factory HostRosterEntry.fromJson(Map<String, dynamic> json) =>
      HostRosterEntry(
        studentName: json['studentName'] as String? ?? '',
        status: json['status'] as String? ?? 'pending',
        scannedAt: json['scannedAt'] as String?,
      );

  final String studentName;
  final String status;
  final String? scannedAt;

  bool get checkedIn => status == 'present' || status == 'late';
}

class HostSessionState {
  const HostSessionState({
    required this.sessionId,
    required this.isActive,
    required this.canStart,
    required this.canEnd,
    required this.gracePeriodMinutes,
    this.roster = const <HostRosterEntry>[],
    this.endedAt,
    this.message,
    this.qrToken,
    this.qrTokenExpiresAt,
    this.presenceMessage,
  });

  factory HostSessionState.fromJson(Map<String, dynamic> json) =>
      HostSessionState(
        sessionId: json['sessionId'] as String? ?? '',
        isActive: json['isActive'] as bool? ?? false,
        canStart: json['canStart'] as bool? ?? false,
        canEnd: json['canEnd'] as bool? ?? false,
        gracePeriodMinutes: (json['gracePeriodMinutes'] as num?)?.toInt() ?? 0,
        endedAt: json['endedAt'] as String?,
        message: json['message'] as String?,
        qrToken: json['qrToken'] as String?,
        qrTokenExpiresAt: json['qrTokenExpiresAt'] as String?,
        presenceMessage: json['presenceMessage'] as String?,
        roster: <HostRosterEntry>[
          for (final item in json['roster'] as List<dynamic>? ?? const [])
            HostRosterEntry.fromJson(Map<String, dynamic>.from(item as Map)),
        ],
      );

  final String sessionId;
  final bool isActive;
  final bool canStart;
  final bool canEnd;
  final int gracePeriodMinutes;
  final List<HostRosterEntry> roster;
  final String? endedAt;
  final String? message;

  /// Present only while a session the president started is running.
  final String? qrToken;
  final String? qrTokenExpiresAt;

  /// Only on the reply to starting: whether it marked the president present.
  final String? presenceMessage;

  int get checkedInCount => roster.where((entry) => entry.checkedIn).length;
}
