import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/attendance.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';
import 'package:polycheck_mobile/src/core/models/subject.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/utils/pup_courses.dart';
import 'package:polycheck_mobile/src/core/utils/session_slots.dart';
import 'package:polycheck_mobile/src/features/faculty/data/session_wizard.dart';

Section _section({
  String id = 'sec-1',
  String section = '4-1',
  String? course = 'BSIT',
  String room = 'CCIS Lab 3',
  List<ScheduleDay> schedule = const <ScheduleDay>[],
}) {
  return Section(
    id: id,
    subjectId: 'subj-1',
    section: section,
    course: course,
    room: room,
    schedule: schedule,
    semester: '1st Semester AY 2026-2027',
    teacherId: 'teacher-1',
    teacherName: 'Prof. Cruz',
    studentCount: 3,
  );
}

User _student(String id, String name) =>
    User(id: id, fullName: name, role: UserRole.student, studentId: '2024-$id');

void main() {
  group('schedule prefill', () {
    test('maps schedule entries and falls back to the section room', () {
      final section = _section(
        schedule: const [
          ScheduleDay(day: DayOfWeek.mon, startTime: '08:00', endTime: '10:00'),
          ScheduleDay(
            day: DayOfWeek.wed,
            startTime: '09:00',
            endTime: '12:00',
            room: 'Room 201',
          ),
        ],
      );
      final slots = scheduleSlotsForSection(section);
      expect(slots, hasLength(2));
      expect(slots[0].room, 'CCIS Lab 3');
      expect(slots[1].room, 'Room 201');
    });

    test('picking a slot moves the date to its next occurrence', () {
      final section = _section(
        schedule: const [
          ScheduleDay(day: DayOfWeek.fri, startTime: '13:00', endTime: '15:30'),
        ],
      );
      // 2026-11-10 is a Tuesday; the next Friday is 2026-11-13.
      final pick = applySlotPick(
        schedule: scheduleSlotsForSection(section),
        selection: '0',
        fromDate: '2026-11-10',
      );
      expect(pick, isNotNull);
      expect(pick!.date, '2026-11-13');
      expect(pick.startTime, '13:00');
      expect(pick.endTime, '15:30');
      expect(pick.room, 'CCIS Lab 3');
    });

    test('custom selection changes nothing', () {
      expect(
        applySlotPick(
          schedule: scheduleSlotsForSection(_section()),
          selection: customSlotValue,
          fromDate: '2026-11-10',
        ),
        isNull,
      );
      expect(
        applySlotPick(
          schedule: const <SessionSlot>[],
          selection: '9',
          fromDate: '2026-11-10',
        ),
        isNull,
      );
    });

    test('detects a duplicate session on the chosen date', () {
      final sessions = [
        const Session(
          id: 'sess-1',
          sectionId: 'sec-1',
          date: '2026-11-13',
          startTime: '13:00',
          endTime: '15:30',
          teacherId: 'teacher-1',
        ),
      ];
      expect(duplicateSessionOnDate(sessions, '2026-11-13')?.id, 'sess-1');
      expect(duplicateSessionOnDate(sessions, '2026-11-14'), isNull);
    });
  });

  group('session payloads', () {
    test('in-person input keeps geofence and QR timing', () {
      final input = buildSingleSessionInput(
        section: _section(),
        subjectName: 'Software Engineering',
        date: '2026-11-13',
        startTime: '13:00',
        endTime: '15:30',
        teacherId: 'teacher-1',
        mode: SessionMode.inPerson,
        room: 'CCIS Lab 3',
        qrValidityMinutes: 7,
        gracePeriodMinutes: 20,
        geofence: const GeofenceConfig(
          latitude: 14.8697,
          longitude: 120.9991,
          radiusMeters: 45,
        ),
      );
      expect(input.mode, SessionMode.inPerson);
      expect(input.qrValidityMinutes, 7);
      expect(input.gracePeriodMinutes, 20);
      expect(input.geofence?.radiusMeters, 45);
      expect(input.isRescheduled, isNull);
    });

    test('online input drops geofence and in-person timing', () {
      final input = buildSingleSessionInput(
        section: _section(),
        subjectName: 'Software Engineering',
        date: '2026-11-13',
        startTime: '13:00',
        endTime: '15:30',
        teacherId: 'teacher-1',
        mode: SessionMode.online,
        geofence: const GeofenceConfig(
          latitude: 14.8697,
          longitude: 120.9991,
          radiusMeters: 45,
        ),
      );
      expect(input.mode, SessionMode.online);
      expect(input.geofence, isNull);
      expect(input.qrValidityMinutes, isNull);
      expect(input.gracePeriodMinutes, isNull);
    });

    test('reschedule flag carries the original window', () {
      final input = buildSingleSessionInput(
        section: _section(),
        subjectName: 'Software Engineering',
        date: '2026-11-20',
        startTime: '13:00',
        endTime: '15:30',
        teacherId: 'teacher-1',
        mode: SessionMode.inPerson,
        isRescheduled: true,
        rescheduledFromDate: '2026-11-13',
        originalScheduleTime: '13:00-15:30',
        originalRoom: 'CCIS Lab 3',
      );
      expect(input.isRescheduled, isTrue);
      expect(input.rescheduledFromDate, '2026-11-13');
      expect(input.originalScheduleTime, '13:00-15:30');
      expect(input.originalRoom, 'CCIS Lab 3');
    });

    test('rejects out-of-policy QR timing', () {
      expect(
        () => buildSingleSessionInput(
          section: _section(),
          subjectName: 'SE',
          date: '2026-11-13',
          startTime: '13:00',
          endTime: '15:30',
          teacherId: 'teacher-1',
          mode: SessionMode.inPerson,
          qrValidityMinutes: 16,
          gracePeriodMinutes: 10,
        ),
        throwsArgumentError,
      );
      expect(
        () => buildSingleSessionInput(
          section: _section(),
          subjectName: 'SE',
          date: '2026-11-13',
          startTime: '13:00',
          endTime: '15:30',
          teacherId: 'teacher-1',
          mode: SessionMode.inPerson,
          qrValidityMinutes: 5,
          gracePeriodMinutes: 61,
        ),
        throwsArgumentError,
      );
    });
  });

  group('bulk sweep', () {
    final rows = <BulkSlotRow>[
      const BulkSlotRow(day: 'Mon', startTime: '08:00', endTime: '10:00'),
      const BulkSlotRow(day: 'Wed', startTime: '09:00', endTime: '12:00'),
    ];

    test('target dates preserve each meeting weekday inside the range', () {
      final dates = bulkTargetDates(rows, '2026-11-09', '2026-11-22');
      expect(dates, ['2026-11-09', '2026-11-11', '2026-11-16', '2026-11-18']);
    });

    test('conflicts are detected against existing sessions', () {
      final conflicts = bulkConflictingDates(
        rows: rows,
        startDate: '2026-11-09',
        endDate: '2026-11-22',
        existingDates: {'2026-11-11', '2026-11-16', '2026-10-01'},
      );
      expect(conflicts, ['2026-11-11', '2026-11-16']);
    });

    test('bulk payload sends per-slot times and only selected rows', () {
      final input = buildBulkSessionInput(
        section: _section(),
        subjectName: 'Software Engineering',
        startDate: '2026-11-09',
        endDate: '2026-11-22',
        rows: [rows[0], rows[1].copyWith(selected: false)],
        teacherId: 'teacher-1',
        mode: SessionMode.online,
      );
      expect(input.slots, hasLength(1));
      expect(input.slots!.first.day, 'Mon');
      expect(input.slots!.first.startTime, '08:00');
      expect(input.mode, SessionMode.online);
      expect(input.geofence, isNull);
    });

    test('invalid rows are reported before submitting', () {
      final invalid = firstInvalidSlotRow([
        const BulkSlotRow(day: 'Mon', startTime: '10:00', endTime: '09:00'),
      ]);
      expect(invalid?.day, 'Mon');
      expect(
        firstInvalidSlotRow([
          const BulkSlotRow(day: 'Mon', startTime: '08:00', endTime: '10:00'),
        ]),
        isNull,
      );
    });
  });

  group('cockpit roster', () {
    final students = [
      _student('001', 'Dela Cruz, Juan'),
      _student('002', 'Aquino, Mia'),
      _student('003', 'Bautista, Ben'),
    ];

    test('joins records, sorts by name, and surfaces missing records', () {
      final rows = buildCockpitRoster(
        students: students,
        records: [
          const AttendanceRecord(
            id: 'rec-1',
            sessionId: 'sess-1',
            sectionId: 'sec-1',
            studentId: '002',
            studentName: 'Aquino, Mia',
            status: AttendanceStatus.late,
            manuallySet: true,
          ),
        ],
      );
      expect(rows.map((row) => row.studentName).toList(), [
        'Aquino, Mia',
        'Bautista, Ben',
        'Dela Cruz, Juan',
      ]);
      expect(rows.first.status, AttendanceStatus.late);
      expect(rows.first.hasRecord, isTrue);
      expect(rows[1].status, AttendanceStatus.pending);
      expect(rows[1].hasRecord, isFalse);
    });

    test('summarizes and filters the roster statuses', () {
      final rows = buildCockpitRoster(
        students: students,
        records: [
          const AttendanceRecord(
            id: 'rec-1',
            sessionId: 'sess-1',
            sectionId: 'sec-1',
            studentId: '001',
            status: AttendanceStatus.present,
          ),
          const AttendanceRecord(
            id: 'rec-2',
            sessionId: 'sess-1',
            sectionId: 'sec-1',
            studentId: '002',
            status: AttendanceStatus.incomplete,
          ),
          const AttendanceRecord(
            id: 'rec-3',
            sessionId: 'sess-1',
            sectionId: 'sec-1',
            studentId: '003',
            status: AttendanceStatus.absent,
          ),
        ],
      );
      final summary = summarizeRoster(rows);
      expect(summary.present, 1);
      expect(summary.incomplete, 1);
      expect(summary.absent, 1);
      expect(summary.pending, 0);
      expect(
        filterRoster(
          rows,
          CockpitStatusFilter.absent,
        ).map((row) => row.studentId).toList(),
        ['003'],
      );
      expect(filterRoster(rows, CockpitStatusFilter.all), hasLength(3));
    });

    test('disputed and excused rows are their own buckets, not pending '
        '(DD-F17)', () {
      final rows = buildCockpitRoster(
        students: students,
        records: [
          const AttendanceRecord(
            id: 'rec-1',
            sessionId: 'sess-1',
            sectionId: 'sec-1',
            studentId: '001',
            status: AttendanceStatus.disputed,
            disputeReason: DisputeReason.missingScanEvidence,
          ),
          const AttendanceRecord(
            id: 'rec-2',
            sessionId: 'sess-1',
            sectionId: 'sec-1',
            studentId: '002',
            status: AttendanceStatus.excused,
          ),
          const AttendanceRecord(
            id: 'rec-3',
            sessionId: 'sess-1',
            sectionId: 'sec-1',
            studentId: '003',
            status: AttendanceStatus.pending,
          ),
        ],
      );

      final summary = summarizeRoster(rows);

      expect(summary.disputed, 1);
      expect(summary.excused, 1);
      expect(
        summary.pending,
        1,
        reason: 'pending counts only rows actually awaiting a scan',
      );
      expect(
        summary.present + summary.late + summary.absent + summary.incomplete,
        0,
      );
    });
  });

  group('catalog gate', () {
    test('course catalog still resolves the default BSIT option', () {
      expect(pupCourseName('BSIT'), 'BS Information Technology');
      expect(pupCourseByCode('bsit')?.code, 'BSIT');
    });
  });
}
