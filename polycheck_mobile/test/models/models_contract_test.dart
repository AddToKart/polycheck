/// Recorded-payload contract tests for the models the device screens funnel
/// through `fromJson`.
///
/// Every snapshot below is shaped exactly like the backend serializer that
/// emits it (file + line references inline). The regression this file pins:
/// `GET /sections/:id/students` rows carry NO `role` key, so `User.role` must
/// default instead of casting null to a required enum
/// (`Type 'Null' is not a subtype of type 'String' in type cast` crashed both
/// the faculty section detail and the session cockpit roster).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/models/models.dart';
import 'package:polycheck_mobile/src/core/models/support/unknown_api_value.dart';

void main() {
  group('roster row — GET /sections/:id/students', () {
    // backend/src/sections/sections.service.ts:203-243 — the row is the
    // enrollment's student select (id, studentId, fullName, email, program,
    // yearLevel, photoUrl) plus an `attendance` counts map
    // { present, late, absent, disputed }. No `role` key is emitted.
    const rosterRow = <String, dynamic>{
      'id': 'u-student-1',
      'studentId': '2023-00001-MN-0',
      'fullName': 'Maria Clara',
      'email': 'maria.clara@pup.edu.ph',
      'program': 'BSIT',
      'yearLevel': 3,
      'photoUrl': null,
      'attendance': {'present': 9, 'late': 1, 'absent': 2, 'disputed': 0},
    };

    test('parses without a role key (regression: null cast crash)', () {
      final user = User.fromJson(rosterRow);
      expect(user.id, 'u-student-1');
      expect(user.fullName, 'Maria Clara');
      expect(user.role, UserRole.student);
      expect(user.studentId, '2023-00001-MN-0');
      expect(user.program, 'BSIT');
      expect(user.yearLevel, 3);
      expect(user.photoUrl, isNull);
    });

    test('parses with every nullable column explicitly null', () {
      final user = User.fromJson(<String, dynamic>{
        ...rosterRow,
        'studentId': null,
        'email': null,
        'program': null,
        'yearLevel': null,
        'photoUrl': null,
      });
      expect(user.role, UserRole.student);
      expect(user.studentId, isNull);
      expect(user.email, isNull);
      expect(user.program, isNull);
      expect(user.yearLevel, isNull);
      expect(user.photoUrl, isNull);
    });

    test('extra attendance key is ignored by User.fromJson', () {
      // The roster row carries `attendance`; the account model does not model
      // it. Parsing must neither choke on nor require the key.
      final user = User.fromJson(rosterRow);
      expect(user.toJson().containsKey('attendance'), isFalse);
    });

    test('SectionStudent parses the same row with its counts', () {
      final row = SectionStudent.fromJson(rosterRow);
      expect(row.student.role, UserRole.student);
      expect(row.student.fullName, 'Maria Clara');
      expect(row.attendance.present, 9);
      expect(row.attendance.late, 1);
      expect(row.attendance.absent, 2);
      expect(row.attendance.disputed, 0);
    });

    test('roster user round-trips through toJson/fromJson', () {
      final user = User.fromJson(rosterRow);
      expect(User.fromJson(user.toJson()), user);
    });
  });

  group('presentSection — GET /sections/:id', () {
    // backend/src/sections/sections.service.ts:464-485.
    const baseSection = <String, dynamic>{
      'id': 'sec-1',
      'subjectId': 'sub-1',
      'section': '4-1',
      'room': 'CCIS Lab 3',
      'schedule': [
        {'day': 'Mon', 'startTime': '08:00', 'endTime': '10:30', 'room': null},
      ],
      'semester': '1st Sem 2026-2027',
      'teacherId': 'tch-1',
      'teacherName': 'Dr. Ada Lovelace',
      'studentCount': 40,
      'createdAt': '2026-06-01T00:00:00Z',
      'updatedAt': '2026-06-01T00:00:00Z',
    };

    test('parses with course/enrollment-code keys present-null', () {
      final section = Section.fromJson(<String, dynamic>{
        ...baseSection,
        'course': null,
        'enrollmentCode': null,
        'enrollmentCodeExpiry': null,
      });
      expect(section.course, isNull);
      expect(section.enrollmentCode, isNull);
      expect(section.enrollmentCodeExpiry, isNull);
      expect(section.schedule.single.room, isNull);
      expect(section.schedule.single.day, DayOfWeek.mon);
      expect(Section.fromJson(section.toJson()), section);
    });

    test('parses the course: BSIT variant with a live enrollment code', () {
      final section = Section.fromJson(<String, dynamic>{
        ...baseSection,
        'course': 'BSIT',
        'enrollmentCode': 'PUP1234',
        'enrollmentCodeExpiry': '2026-06-15T00:00:00Z',
      });
      expect(section.course, 'BSIT');
      expect(section.enrollmentCode, 'PUP1234');
      expect(Section.fromJson(section.toJson()), section);
    });

    test('parses when course/enrollment keys are absent entirely', () {
      // `course: section.course ?? undefined` and the enrollment-code spread
      // drop the keys from the JSON payload when null.
      final section = Section.fromJson(baseSection);
      expect(section.course, isNull);
      expect(section.enrollmentCode, isNull);
      expect(section.enrollmentCodeExpiry, isNull);
      expect(Section.fromJson(section.toJson()), section);
    });
  });

  group('session present() — GET /sessions/:id', () {
    // backend/src/sessions/sessions.service.ts:1122-1154 — the Prisma row
    // minus the token/hash/geofence columns, plus computed `mode` and
    // `pinRequired`; `geofence` only appears when all three coordinates are
    // non-null, and `teacherPublicKey` is dropped when null.
    const baseSession = <String, dynamic>{
      'id': 'ses-1',
      'sectionId': 'sec-1',
      'teacherId': 'tch-1',
      'subjectName': 'Capstone 1',
      'date': '2026-11-10',
      'startTime': '08:00',
      'endTime': '10:00',
      'room': null,
      'qrValidityMinutes': 15,
      'gracePeriodMinutes': 15,
      'autoEndAt': null,
      'isActive': true,
      'endedAt': null,
      'isRescheduled': false,
      'rescheduledFromDate': null,
      'originalScheduleTime': null,
      'originalRoom': null,
      'createdAt': '2026-11-01T00:00:00Z',
    };

    test('in_person variant: single-QR columns present-null, no geofence', () {
      final session = Session.fromJson(<String, dynamic>{
        ...baseSession,
        'mode': 'in_person',
        'pinRequired': false,
        'startQrValiditySeconds': null,
        'startGraceMinutes': null,
        'endQrValiditySeconds': null,
        'endGraceMinutes': 0,
        'startQrToken': null,
        'startTokenExpiresAt': null,
        'startQrGeneratedAt': null,
        'endQrToken': null,
        'endTokenExpiresAt': null,
        'endQrGeneratedAt': null,
        'qrToken': null,
        'qrTokenExpiresAt': null,
        'qrGeneratedAt': null,
      });
      expect(session.mode, SessionMode.inPerson);
      expect(session.room, isNull);
      expect(session.geofence, isNull);
      expect(session.pinRequired, isFalse);
      expect(session.qrToken, isNull);
      expect(session.qrValidityMinutes, 15);
      expect(session.gracePeriodMinutes, 15);
      expect(Session.fromJson(session.toJson()), session);
    });

    test('online variant: checkpoint fields, PIN, no geofence, no coords', () {
      final session = Session.fromJson(<String, dynamic>{
        ...baseSession,
        'id': 'ses-2',
        'date': '2026-11-11',
        'startTime': '13:00',
        'endTime': '15:00',
        'mode': 'online',
        'pinRequired': true,
        'teacherPublicKey': 'MCowBQYDK2VwAyEA',
        'startQrValiditySeconds': 120,
        'startGraceMinutes': 10,
        'endQrValiditySeconds': 120,
        'endGraceMinutes': 0,
        'startQrToken': 'eyJhbGciOiJFZERTQSJ9.start',
        'startTokenExpiresAt': '2026-11-11T05:05:00Z',
        'startQrGeneratedAt': '2026-11-11T05:00:00Z',
        'endQrToken': null,
        'endTokenExpiresAt': null,
        'endQrGeneratedAt': null,
        'autoEndAt': '2026-11-11T07:30:00Z',
      });
      expect(session.mode, SessionMode.online);
      expect(session.room, isNull);
      expect(session.geofence, isNull);
      expect(session.pinRequired, isTrue);
      expect(session.startQrValiditySeconds, 120);
      expect(session.startGraceMinutes, 10);
      expect(session.endGraceMinutes, 0);
      expect(session.startQrToken, isNotNull);
      expect(session.endQrToken, isNull);
      expect(session.teacherPublicKey, 'MCowBQYDK2VwAyEA');
      expect(Session.fromJson(session.toJson()), session);
    });
  });

  group('attendance record — attendance.service present()', () {
    // backend/src/attendance/attendance.service.ts:1158-1160 — the Prisma row
    // spread with latitude/longitude replaced by a nested `coordinates` map.
    test('minimal in-person record parses', () {
      final record = AttendanceRecord.fromJson(<String, dynamic>{
        'id': 'rec-1',
        'sessionId': 'ses-1',
        'sectionId': 'sec-1',
        'studentId': 'u-student-1',
        'studentName': 'Maria Clara',
        'timestamp': '2026-11-10T00:05:00Z',
        'status': 'present',
        'coordinates': {'latitude': 14.8697, 'longitude': 120.9991},
      });
      expect(record.status, AttendanceStatus.present);
      expect(record.coordinates.latitude, 14.8697);
      expect(record.coordinates.longitude, 120.9991);
      expect(record.studentProgram, isNull);
      expect(record.disputeReason, isNull);
      expect(AttendanceRecord.fromJson(record.toJson()), record);
    });

    test('online record with every nullable coordinate/leg field null', () {
      final record = AttendanceRecord.fromJson(<String, dynamic>{
        'id': 'rec-2',
        'sessionId': 'ses-2',
        'sectionId': 'sec-1',
        'studentId': 'u-student-1',
        'studentName': 'Maria Clara',
        'studentProgram': null,
        'timestamp': '2026-11-11T05:02:00Z',
        'status': 'pending',
        'coordinates': {'latitude': null, 'longitude': null},
        'mode': 'online',
        'checkInTime': null,
        'checkInStatus': null,
        'checkOutTime': null,
        'checkOutStatus': null,
        'deviceId': null,
        'tokenSnapshot': null,
        'isSynced': true,
        'syncedAt': '2026-11-11T05:03:00Z',
        'disputeReason': null,
        'disputeResolved': false,
        'disputeDescription': null,
        'manuallySet': false,
        'notes': null,
        'excuseStatus': null,
        'excuseReason': null,
        'excuseDescription': null,
        'excuseEvidencePath': null,
        'excuseReviewedBy': null,
        'excuseReviewedAt': null,
        'excuseReviewNote': null,
        // Ledger + attempt FK columns the backend spreads and the model
        // ignores — parsing must not choke on unknown keys.
        'prevHash': null,
        'recordHash': null,
        'salt': null,
        'acceptedScanAttemptId': null,
        'checkInAttemptId': null,
        'checkOutAttemptId': null,
        'createdAt': '2026-11-11T05:02:00Z',
        'updatedAt': '2026-11-11T05:03:00Z',
      });
      expect(record.status, AttendanceStatus.pending);
      expect(record.mode, SessionMode.online);
      expect(record.coordinates.latitude, isNull);
      expect(record.coordinates.longitude, isNull);
      expect(record.checkInTime, isNull);
      expect(record.checkInStatus, isNull);
      expect(record.checkOutTime, isNull);
      expect(record.checkOutStatus, isNull);
      expect(AttendanceRecord.fromJson(record.toJson()), record);
    });
  });

  group('UnknownApiValue behavior is untouched by the role default', () {
    test('a present unknown role wire value still throws', () {
      expect(
        () => User.fromJson(<String, dynamic>{
          'id': 'u-x',
          'fullName': 'Unknown Role',
          'role': 'department_head',
        }),
        throwsA(
          isA<UnknownApiValue>().having(
            (error) => error.source,
            'source',
            'UserRole',
          ),
        ),
      );
    });

    test('an unknown attendance status still throws', () {
      expect(
        () => AttendanceRecord.fromJson(<String, dynamic>{
          'id': 'rec-x',
          'sessionId': 'ses-1',
          'sectionId': 'sec-1',
          'studentId': 'u-student-1',
          'timestamp': '2026-11-10T00:05:00Z',
          'status': 'teleported',
          'coordinates': {'latitude': null, 'longitude': null},
        }),
        throwsA(isA<UnknownApiValue>()),
      );
    });
  });
}
