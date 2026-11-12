import '../../../core/polycheck_core.dart';

/// Pure create-session wizard model: slot prefill, per-slot bulk payloads, and
/// duplicate-date detection.
///
/// Mirrors `frontend/src/lib/session-slots.ts` usage in
/// `frontend/src/app/faculty/sessions/create/page.tsx`.

const int minQrValidityMinutes = 1;
const int maxQrValidityMinutes = 15;
const int minGracePeriodMinutes = 0;
const int maxGracePeriodMinutes = 60;
const double minGeofenceRadiusMeters = 10;
const double maxGeofenceRadiusMeters = 500;

const double defaultCampusLatitude = 14.8697;
const double defaultCampusLongitude = 120.9991;

/// Class meetings for a section. A slot without its own room falls back to the
/// section room so the prefill stays truthful.
List<SessionSlot> scheduleSlotsForSection(Section? section) {
  if (section == null) return const <SessionSlot>[];
  return [
    for (final day in section.schedule)
      SessionSlot(
        day: day.day.wire,
        startTime: day.startTime,
        endTime: day.endTime,
        room: (day.room ?? '').trim().isNotEmpty
            ? day.room!.trim()
            : (section.room.trim().isNotEmpty ? section.room.trim() : null),
      ),
  ];
}

class SlotPick {
  const SlotPick({
    required this.date,
    required this.startTime,
    required this.endTime,
    this.room,
  });

  final String date;
  final String startTime;
  final String endTime;
  final String? room;
}

/// Picking a class meeting moves the date to that meeting's next occurrence
/// (today when it already matches) and refills its time/room.
SlotPick? applySlotPick({
  required List<SessionSlot> schedule,
  required String selection,
  String? fromDate,
  DateTime? now,
}) {
  if (selection == customSlotValue) return null;
  final index = int.tryParse(selection);
  if (index == null || index < 0 || index >= schedule.length) return null;
  final slot = schedule[index];
  return SlotPick(
    date: nextOccurrenceDate(slot.day, fromDate, now),
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room,
  );
}

Session? duplicateSessionOnDate(Iterable<Session> sessions, String date) {
  for (final session in sessions) {
    if (session.date == date) return session;
  }
  return null;
}

/// Every date the selected bulk rows would create inside the inclusive range.
List<String> bulkTargetDates(
  List<BulkSlotRow> rows,
  String startDate,
  String endDate,
) {
  final start = parseCampusDate(startDate);
  final end = parseCampusDate(endDate);
  if (start == null || end == null || end.isBefore(start)) {
    return const <String>[];
  }
  const dayIndex = <String, int>{
    'Sun': 0,
    'Mon': 1,
    'Tue': 2,
    'Wed': 3,
    'Thu': 4,
    'Fri': 5,
    'Sat': 6,
  };
  final dates = <String>{};
  for (final row in rows) {
    if (!row.selected) continue;
    final target = dayIndex[row.day];
    if (target == null) continue;
    final offset = (target - (start.weekday % 7) + 7) % 7;
    var cursor = DateTime(start.year, start.month, start.day + offset, 12);
    while (!cursor.isAfter(end)) {
      dates.add(formatDate(cursor));
      cursor = DateTime(cursor.year, cursor.month, cursor.day + 7, 12);
    }
  }
  final sorted = dates.toList(growable: false)..sort();
  return sorted;
}

/// Existing-session dates that would collide with the bulk request. The backend
/// rejects a request when any target date already has a session for the section.
List<String> bulkConflictingDates({
  required List<BulkSlotRow> rows,
  required String startDate,
  required String endDate,
  required Set<String> existingDates,
}) {
  return [
    for (final date in bulkTargetDates(rows, startDate, endDate))
      if (existingDates.contains(date)) date,
  ];
}

String modeLabel(SessionMode mode) =>
    mode == SessionMode.online ? 'Online' : 'In person';

String modeHint(SessionMode mode) => mode == SessionMode.online
    ? 'Zero-GPS: two checkpoints (start/end) with an optional meeting PIN.'
    : 'Geofenced: students must be inside the classroom radius.';

CreateSessionInput buildSingleSessionInput({
  required Section section,
  required String subjectName,
  required String date,
  required String startTime,
  required String endTime,
  required String teacherId,
  required SessionMode mode,
  String? room,
  int qrValidityMinutes = 5,
  int gracePeriodMinutes = 15,
  GeofenceConfig? geofence,
  bool isRescheduled = false,
  String? rescheduledFromDate,
  String? originalScheduleTime,
  String? originalRoom,
}) {
  if (qrValidityMinutes < minQrValidityMinutes ||
      qrValidityMinutes > maxQrValidityMinutes) {
    throw ArgumentError.value(
      qrValidityMinutes,
      'qrValidityMinutes',
      'QR validity must be 1-15 minutes',
    );
  }
  if (gracePeriodMinutes < minGracePeriodMinutes ||
      gracePeriodMinutes > maxGracePeriodMinutes) {
    throw ArgumentError.value(
      gracePeriodMinutes,
      'gracePeriodMinutes',
      'QR grace must be 0-60 minutes',
    );
  }
  return CreateSessionInput(
    sectionId: section.id,
    subjectName: subjectName,
    date: date,
    startTime: startTime,
    endTime: endTime,
    room: room,
    mode: mode,
    qrValidityMinutes: mode == SessionMode.inPerson ? qrValidityMinutes : null,
    gracePeriodMinutes: mode == SessionMode.inPerson
        ? gracePeriodMinutes
        : null,
    geofence: mode == SessionMode.inPerson ? geofence : null,
    teacherId: teacherId,
    isRescheduled: isRescheduled ? true : null,
    rescheduledFromDate: isRescheduled ? rescheduledFromDate : null,
    originalScheduleTime: isRescheduled ? originalScheduleTime : null,
    originalRoom: isRescheduled ? originalRoom : null,
  );
}

BulkSessionInput buildBulkSessionInput({
  required Section section,
  required String subjectName,
  required String startDate,
  required String endDate,
  required List<BulkSlotRow> rows,
  required String teacherId,
  required SessionMode mode,
  String? room,
  int qrValidityMinutes = 5,
  int gracePeriodMinutes = 15,
  GeofenceConfig? geofence,
}) {
  final slots = buildBulkSlots(rows);
  if (slots.isEmpty) {
    throw ArgumentError('Select at least one class meeting');
  }
  return BulkSessionInput(
    sectionId: section.id,
    subjectName: subjectName,
    startDate: startDate,
    endDate: endDate,
    slots: slots,
    room: room,
    mode: mode,
    qrValidityMinutes: mode == SessionMode.inPerson ? qrValidityMinutes : null,
    gracePeriodMinutes: mode == SessionMode.inPerson
        ? gracePeriodMinutes
        : null,
    geofence: mode == SessionMode.inPerson ? geofence : null,
    teacherId: teacherId,
  );
}

/// Roster-facing row combining an enrolled student with their session record.
class CockpitRosterRow {
  const CockpitRosterRow({
    required this.studentId,
    required this.studentName,
    required this.studentNumber,
    this.record,
  });

  final String studentId;
  final String studentName;
  final String? studentNumber;
  final AttendanceRecord? record;

  AttendanceStatus get status => record?.status ?? AttendanceStatus.pending;

  bool get hasRecord => record != null;
}

List<CockpitRosterRow> buildCockpitRoster({
  required List<User> students,
  required List<AttendanceRecord> records,
}) {
  final byStudent = <String, AttendanceRecord>{
    for (final record in records) record.studentId: record,
  };
  final rows = <CockpitRosterRow>[
    for (final student in students)
      CockpitRosterRow(
        studentId: student.id,
        studentName: student.fullName,
        studentNumber: student.studentId,
        record: byStudent[student.id],
      ),
  ];
  rows.sort(
    (left, right) => left.studentName.toLowerCase().compareTo(
      right.studentName.toLowerCase(),
    ),
  );
  return rows;
}

/// Roster counts for the cockpit summary strip.
///
/// `disputed` and `excused` are their own buckets: they are unresolved states
/// on the roster (the dispute rail / excused flow own them), not `pending`
/// rows, so folding them into `pending` made the end-session summary disagree
/// with the roster (DD-F17).
({
  int present,
  int late,
  int absent,
  int pending,
  int incomplete,
  int disputed,
  int excused,
})
summarizeRoster(Iterable<CockpitRosterRow> rows) {
  var present = 0;
  var late = 0;
  var absent = 0;
  var pending = 0;
  var incomplete = 0;
  var disputed = 0;
  var excused = 0;
  for (final row in rows) {
    switch (row.status) {
      case AttendanceStatus.present:
        present += 1;
      case AttendanceStatus.late:
        late += 1;
      case AttendanceStatus.absent:
        absent += 1;
      case AttendanceStatus.incomplete:
        incomplete += 1;
      case AttendanceStatus.disputed:
        disputed += 1;
      case AttendanceStatus.excused:
        excused += 1;
      case AttendanceStatus.pending:
        pending += 1;
    }
  }
  return (
    present: present,
    late: late,
    absent: absent,
    pending: pending,
    incomplete: incomplete,
    disputed: disputed,
    excused: excused,
  );
}

enum CockpitStatusFilter { all, present, late, absent, pending, disputed }

const Map<CockpitStatusFilter, String> cockpitStatusFilterLabels = {
  CockpitStatusFilter.all: 'All',
  CockpitStatusFilter.present: 'Present',
  CockpitStatusFilter.late: 'Late',
  CockpitStatusFilter.absent: 'Absent',
  CockpitStatusFilter.pending: 'Pending',
  CockpitStatusFilter.disputed: 'Disputed',
};

List<CockpitRosterRow> filterRoster(
  Iterable<CockpitRosterRow> rows,
  CockpitStatusFilter filter,
) {
  if (filter == CockpitStatusFilter.all) return rows.toList(growable: false);
  final status = switch (filter) {
    CockpitStatusFilter.present => AttendanceStatus.present,
    CockpitStatusFilter.late => AttendanceStatus.late,
    CockpitStatusFilter.absent => AttendanceStatus.absent,
    CockpitStatusFilter.pending => AttendanceStatus.pending,
    CockpitStatusFilter.disputed => AttendanceStatus.disputed,
    CockpitStatusFilter.all => null,
  };
  return [
    for (final row in rows)
      if (row.status == status) row,
  ];
}
