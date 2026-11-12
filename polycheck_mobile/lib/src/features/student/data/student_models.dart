import 'package:polycheck_mobile/src/core/polycheck_core.dart';

/// Presentation status for a class meeting on the student dashboard.
enum TodayClassStatus {
  scheduled('Scheduled'),
  active('Active'),
  completed('Completed');

  const TodayClassStatus(this.label);

  final String label;
}

/// One class meeting scheduled today, enriched with the session and the
/// student's attendance record when either exists.
class TodayClass {
  const TodayClass({
    required this.section,
    required this.slot,
    required this.status,
    this.subject,
    this.session,
    this.record,
  });

  final Section section;
  final ScheduleDay slot;
  final TodayClassStatus status;
  final Subject? subject;
  final Session? session;
  final AttendanceRecord? record;

  String get subjectName {
    final name = subject?.name.trim() ?? '';
    return name.isNotEmpty ? name : section.section;
  }

  String get sectionLabel =>
      formatSectionHeading(section: section.section, course: section.course);

  String get timeLabel {
    final start = formatTime(slot.startTime);
    final end = formatTime(slot.endTime);
    if (start.isEmpty) return end;
    if (end.isEmpty) return start;
    return '$start – $end';
  }

  String get roomLabel {
    final slotRoom = slot.room?.trim() ?? '';
    if (slotRoom.isNotEmpty) return slotRoom;
    final sectionRoom = section.room.trim();
    return sectionRoom.isNotEmpty ? sectionRoom : 'Room TBA';
  }
}

/// Everything the read-only section (subject) page needs.
class StudentSectionDetail {
  const StudentSectionDetail({
    required this.section,
    required this.sessions,
    required this.roles,
    this.subject,
    this.hasActivePermission = false,
  });

  final Section section;
  final Subject? subject;
  final List<Session> sessions;
  final List<SectionRole> roles;
  final bool hasActivePermission;

  bool get isPresident =>
      roles.any((role) => role.role == SectionRoleType.president);

  bool get isQac => roles.any((role) => role.role == SectionRoleType.qac);

  bool get isOfficer => isPresident || isQac;

  String get subjectName {
    final name = subject?.name.trim() ?? '';
    return name.isNotEmpty ? name : section.section;
  }

  String get sectionLabel =>
      formatSectionHeading(section: section.section, course: section.course);
}

/// Identity for the officer session-detail provider family.
class StudentSessionKey {
  const StudentSessionKey({required this.sectionId, required this.sessionId});

  final String sectionId;
  final String sessionId;

  @override
  bool operator ==(Object other) =>
      other is StudentSessionKey &&
      other.sectionId == sectionId &&
      other.sessionId == sessionId;

  @override
  int get hashCode => Object.hash(sectionId, sessionId);
}

/// Everything the student session page needs.
class StudentSessionDetail {
  const StudentSessionDetail({
    required this.session,
    required this.section,
    required this.proofs,
    this.subject,
    this.isQac = false,
  });

  final Session session;
  final Section section;
  final Subject? subject;
  final List<ProofOfClass> proofs;
  final bool isQac;

  String get subjectName {
    final name = subject?.name.trim() ?? '';
    return name.isNotEmpty ? name : section.section;
  }

  String get sectionLabel =>
      formatSectionHeading(section: section.section, course: section.course);

  String get statusLabel {
    if (session.endedAt != null && session.endedAt!.isNotEmpty) {
      return 'Completed';
    }
    if (session.isActive) return 'Active now';
    return 'Scheduled';
  }

  /// Signed class token already delivered to every enrolled client while the
  /// session is armed (never a locally fabricated token).
  String? get activeClassToken {
    if (!session.isActive || (session.endedAt?.isNotEmpty ?? false)) {
      return null;
    }
    for (final candidate in <String?>[
      session.qrToken,
      session.startQrToken,
      session.endQrToken,
    ]) {
      final value = candidate?.trim() ?? '';
      if (value.isNotEmpty) return value;
    }
    return null;
  }
}
