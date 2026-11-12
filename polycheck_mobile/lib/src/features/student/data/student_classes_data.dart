import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import 'student_providers.dart';

/// One enrolled class card (dashboard "My classes" + `/student/subjects`).
///
/// Presentation data only: the section is the enrollment identity, the parent
/// subject supplies the display name/code, and the per-section rate mirrors the
/// RN dashboard card (`present / all records`, rounded, `0` when empty).
class StudentClassCard {
  const StudentClassCard({
    required this.sectionId,
    required this.subjectName,
    required this.subjectCode,
    required this.sectionLabel,
    required this.teacherName,
    required this.ratePercent,
    required this.presentCount,
    required this.lateCount,
    required this.absentCount,
    required this.totalRecords,
    required this.officerRoles,
  });

  final String sectionId;
  final String subjectName;
  final String subjectCode;
  final String sectionLabel;
  final String teacherName;
  final int ratePercent;
  final int presentCount;
  final int lateCount;
  final int absentCount;

  /// All of the student's records for this section (rate denominator).
  final int totalRecords;

  /// Officer designations for this section (empty for plain students).
  final Set<SectionRoleType> officerRoles;

  bool get hasRecords => totalRecords > 0;

  bool get isPresident => officerRoles.contains(SectionRoleType.president);

  bool get isQac => officerRoles.contains(SectionRoleType.qac);

  bool get isOfficer => officerRoles.isNotEmpty;
}

/// Builds the ordered class cards for the student's enrolled sections.
///
/// Ordering is deterministic: subject name, then section label, then section id
/// (case-insensitive) so the dashboard preview and the full list never
/// disagree. Officer chips come from the persisted roles snapshot - the caller
/// supplies it, so rendering never triggers per-card network work.
List<StudentClassCard> buildMyClassCards({
  required List<Section> sections,
  required Map<String, Subject> subjects,
  required List<AttendanceRecord> attendanceRecords,
  required List<SectionRole> rolesSnapshot,
}) {
  final rolesBySection = <String, Set<SectionRoleType>>{};
  for (final role in rolesSnapshot) {
    rolesBySection
        .putIfAbsent(role.sectionId, () => <SectionRoleType>{})
        .add(role.role);
  }

  final cards = <StudentClassCard>[];
  for (final section in sections) {
    final subject = subjects[section.subjectId];
    final subjectName = subject?.name.trim() ?? '';

    var present = 0;
    var late = 0;
    var absent = 0;
    var total = 0;
    for (final record in attendanceRecords) {
      if (record.sectionId != section.id) continue;
      total += 1;
      switch (record.status) {
        case AttendanceStatus.present:
          present += 1;
        case AttendanceStatus.late:
          late += 1;
        case AttendanceStatus.absent:
          absent += 1;
        case AttendanceStatus.pending:
        case AttendanceStatus.disputed:
        case AttendanceStatus.excused:
        case AttendanceStatus.incomplete:
          break;
      }
    }

    cards.add(
      StudentClassCard(
        sectionId: section.id,
        subjectName: subjectName.isEmpty ? 'Class' : subjectName,
        subjectCode: subject?.code.trim() ?? '',
        sectionLabel: formatSectionHeading(
          section: section.section,
          course: section.course,
        ),
        teacherName: section.teacherName.trim(),
        ratePercent: total == 0 ? 0 : ((present / total) * 100).round(),
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        totalRecords: total,
        officerRoles: Set<SectionRoleType>.unmodifiable(
          rolesBySection[section.id] ?? const <SectionRoleType>{},
        ),
      ),
    );
  }

  cards.sort((a, b) {
    final bySubject = a.subjectName.toLowerCase().compareTo(
      b.subjectName.toLowerCase(),
    );
    if (bySubject != 0) return bySubject;
    final bySection = a.sectionLabel.toLowerCase().compareTo(
      b.sectionLabel.toLowerCase(),
    );
    if (bySection != 0) return bySection;
    return a.sectionId.compareTo(b.sectionId);
  });
  return cards;
}

/// Officer roles for the signed-in student, read from the persisted snapshot.
///
/// The snapshot is written by the class/session detail providers (and seeded
/// here on a device that has never opened a class page). It is deliberately
/// cache-first: officer chips are advisory labels and every officer action is
/// re-authorized server-side, so the dashboard never adds a per-load roles
/// request once the snapshot exists.
final studentClassRolesProvider = FutureProvider<List<SectionRole>>((
  ref,
) async {
  final identity = ref.watch(
    sessionProvider.select((state) => (state.user?.id, state.user?.role)),
  );
  final (userId, role) = identity;
  if (userId == null || role != UserRole.student) {
    return const <SectionRole>[];
  }
  final database = ref.watch(appDatabaseProvider);
  List<SectionRole> snapshot;
  try {
    snapshot = await database.readRolesSnapshot(userId);
  } catch (_) {
    snapshot = const <SectionRole>[];
  }
  if (snapshot.isNotEmpty) return snapshot;
  try {
    final roles = await ref.read(sectionsApiProvider).getStudentRoles(userId);
    if (roles.isNotEmpty) {
      await database.writeRolesSnapshot(userId, roles);
    }
    return roles;
  } catch (_) {
    return snapshot;
  }
});

/// Enrolled class cards for the student dashboard and the full list route.
final studentClassCardsProvider = Provider<List<StudentClassCard>>((ref) {
  final sections =
      ref.watch(studentSectionsProvider).value ?? const <Section>[];
  final subjects =
      ref.watch(studentSubjectsProvider).value ?? const <String, Subject>{};
  final records =
      ref.watch(myAttendanceProvider).value ?? const <AttendanceRecord>[];
  final roles =
      ref.watch(studentClassRolesProvider).value ?? const <SectionRole>[];
  return buildMyClassCards(
    sections: sections,
    subjects: subjects,
    attendanceRecords: records,
    rolesSnapshot: roles,
  );
});
