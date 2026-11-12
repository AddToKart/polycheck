import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import 'student_models.dart';

/// Builds today's class cards from the enrolled schedule plus any sessions and
/// attendance records the API returned for today.
List<TodayClass> buildTodayClasses({
  required List<Section> sections,
  required List<Session> sessions,
  required Map<String, Subject> subjects,
  required List<AttendanceRecord> records,
  required String todayDate,
}) {
  final todayDay = dayOfWeek(todayDate);
  if (todayDay == null) return const <TodayClass>[];

  final result = <TodayClass>[];
  for (final section in sections) {
    for (final slot in section.schedule) {
      if (slot.day.wire != todayDay) continue;

      Session? session;
      for (final candidate in sessions) {
        if (candidate.sectionId == section.id && candidate.date == todayDate) {
          session = candidate;
          break;
        }
      }

      AttendanceRecord? record;
      for (final candidate in records) {
        if (candidate.sectionId != section.id) continue;
        if (session != null) {
          if (candidate.sessionId == session.id) {
            record = candidate;
            break;
          }
          continue;
        }
        final parsed = DateTime.tryParse(candidate.timestamp);
        if (parsed != null && formatCampusDate(parsed.toLocal()) == todayDate) {
          record = candidate;
          break;
        }
      }

      final TodayClassStatus status;
      if (session == null) {
        status = TodayClassStatus.scheduled;
      } else if (session.isActive && (session.endedAt?.isNotEmpty != true)) {
        status = TodayClassStatus.active;
      } else if (session.endedAt?.isNotEmpty == true) {
        status = TodayClassStatus.completed;
      } else {
        status = TodayClassStatus.scheduled;
      }

      result.add(
        TodayClass(
          section: section,
          slot: slot,
          subject: subjects[section.subjectId],
          session: session,
          record: record,
          status: status,
        ),
      );
    }
  }

  result.sort((a, b) => a.slot.startTime.compareTo(b.slot.startTime));
  return result;
}

/// Counts by status across the student's confirmed records.
Map<AttendanceStatus, int> attendanceTotals(List<AttendanceRecord> records) {
  final totals = <AttendanceStatus, int>{
    for (final status in AttendanceStatus.values) status: 0,
  };
  for (final record in records) {
    totals[record.status] = (totals[record.status] ?? 0) + 1;
  }
  return totals;
}

/// Overall present/total rate; the dashboard prefers the server's standing
/// rate when one is available.
int attendanceRatePercent(List<AttendanceRecord> records) {
  if (records.isEmpty) return 0;
  final present = records
      .where((record) => record.status == AttendanceStatus.present)
      .length;
  return ((present / records.length) * 100).round();
}

String firstNameOf(String fullName) {
  final trimmed = fullName.trim();
  if (trimmed.isEmpty) return 'Student';
  return trimmed.split(RegExp(r'\s+')).first;
}

String dashboardGreeting(DateTime now) {
  final hour = now.hour;
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
