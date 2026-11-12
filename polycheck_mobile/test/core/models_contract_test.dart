import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/models.dart';
import 'package:polycheck_mobile/src/core/models/support/unknown_api_value.dart';

void main() {
  group('unknown wire values throw typed errors (no silent defaults)', () {
    test('UserRole', () {
      expect(
        () => User.fromJson({
          'id': 'u1',
          'fullName': 'Unknown Role',
          'role': 'department_head',
          'isActive': true,
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

    test('AttendanceStatus', () {
      expect(
        () => AttendanceRecord.fromJson({
          'id': 'r1',
          'sessionId': 's1',
          'sectionId': 'c1',
          'studentId': 'st1',
          'timestamp': '2026-11-10T00:00:00Z',
          'status': 'excused_by_parent',
          'coordinates': {'latitude': null, 'longitude': null},
          'isSynced': true,
        }),
        throwsA(isA<UnknownApiValue>()),
      );
    });

    test('ScheduleDay / DayOfWeek', () {
      expect(
        () => ScheduleDay.fromJson({
          'day': 'Funday',
          'startTime': '08:00',
          'endTime': '09:00',
        }),
        throwsA(isA<UnknownApiValue>()),
      );
    });

    test('SessionFinaleSummary counts map keys', () {
      expect(
        () => SessionFinaleSummary.fromJson({
          'sessionId': 's1',
          'endedAt': '2026-11-10T00:00:00Z',
          'capacity': 40,
          'counts': {'present': 3, 'teleported': 1},
        }),
        throwsA(isA<UnknownApiValue>()),
      );
    });

    test('AiStreamEvent unknown type', () {
      expect(
        () => AiStreamEvent.fromJson({'type': 'annotation'}),
        throwsA(isA<UnknownApiValue>()),
      );
    });

    test('DeviceIntegrityErrorCode', () {
      expect(
        () => DeviceIntegrityErrorPayload.fromJson({'code': 'rate_limited'}),
        throwsA(isA<UnknownApiValue>()),
      );
    });
  });

  group('wire-shape fidelity', () {
    test('User keeps every governance + designation field', () {
      final user = User.fromJson({
        'id': 'u-1',
        'studentId': '2023-00001-MN-0',
        'fullName': 'Maria Clara',
        'email': 'maria@pup.edu.ph',
        'role': 'student',
        'program': 'BSIT',
        'yearLevel': 3,
        'department': 'CCIS',
        'photoUrl': null,
        'isActive': true,
        'privacyConsentVersion': '2026-01',
        'privacyConsentedAt': '2026-01-05T00:00:00Z',
        'mustChangePassword': true,
        'boundDeviceId': 'mobile-a1b2c3d4e5',
        'deviceBoundAt': '2026-02-01T00:00:00Z',
        'deviceCooldownUntil': null,
        'cooldownDeviceId': 'mobile-ffff0000',
        'canResetStudentPasswords': null,
        'canEmergencyUnbindDevices': null,
        'delegatedPermissions': {
          'canResetStudentPasswords': true,
          'canEmergencyUnbindDevices': false,
        },
        'isItCoordinator': false,
        'isDepartmentHead': false,
        'isUserRegistrar': false,
        'contactEmail': 'maria.alt@pup.edu.ph',
        'contactPhone': '+639000000000',
        'enrolledSectionIds': ['sec-1', 'sec-2'],
        'createdAt': '2026-01-01T00:00:00Z',
        'updatedAt': '2026-01-02T00:00:00Z',
      });
      expect(user.role, UserRole.student);
      expect(user.studentId, '2023-00001-MN-0');
      expect(user.mustChangePassword, isTrue);
      expect(user.boundDeviceId, 'mobile-a1b2c3d4e5');
      expect(user.cooldownDeviceId, 'mobile-ffff0000');
      expect(user.delegatedPermissions?.canResetStudentPasswords, isTrue);
      expect(user.delegatedPermissions?.canEmergencyUnbindDevices, isFalse);
      expect(user.enrolledSectionIds, ['sec-1', 'sec-2']);
      expect(user.isItCoordinator, isFalse);

      final roundTrip = User.fromJson(user.toJson());
      expect(roundTrip, user);
    });

    test('legacy account payloads default list/flag fields', () {
      final user = User.fromJson({
        'id': 'u-2',
        'fullName': 'Plain Teacher',
        'role': 'teacher',
        'department': 'CCIS',
        'isActive': true,
        'createdAt': '2026-01-01T00:00:00Z',
        'updatedAt': '2026-01-01T00:00:00Z',
      });
      expect(user.enrolledSectionIds, isEmpty);
      expect(user.isItCoordinator, isFalse);
      expect(user.isDepartmentHead, isFalse);
      expect(user.isUserRegistrar, isFalse);
      expect(user.mustChangePassword, isFalse);
    });

    test('Section carries the course and nested schedule', () {
      final section = Section.fromJson({
        'id': 'sec-1',
        'subjectId': 'sub-1',
        'section': '4-1',
        'course': 'BSIT',
        'room': 'CCIS Lab 3',
        'schedule': [
          {
            'day': 'Mon',
            'startTime': '08:00',
            'endTime': '10:30',
            'room': 'CCIS Lab 3',
          },
        ],
        'semester': '1st Sem 2026-2027',
        'teacherId': 'tch-1',
        'teacherName': 'Dr. Ada Lovelace',
        'enrollmentCode': 'PUP1234',
        'studentCount': 40,
        'createdAt': '2026-06-01T00:00:00Z',
        'updatedAt': '2026-06-01T00:00:00Z',
      });
      expect(section.course, 'BSIT');
      expect(section.schedule.single.day, DayOfWeek.mon);
      expect(Section.fromJson(section.toJson()), section);
    });

    test('hybrid session + record shapes survive a JSON round trip', () {
      final session = Session.fromJson({
        'id': 'ses-1',
        'sectionId': 'sec-1',
        'subjectName': 'Capstone 1',
        'date': '2026-11-10',
        'startTime': '08:00',
        'endTime': '10:00',
        'mode': 'online',
        'qrValidityMinutes': 15,
        'gracePeriodMinutes': 15,
        'isActive': true,
        'pinRequired': true,
        'startQrToken': 'token',
        'autoEndAt': '2026-11-10T02:30:00Z',
        'teacherId': 'tch-1',
        'createdAt': '2026-11-01T00:00:00Z',
      });
      expect(session.mode, SessionMode.online);
      expect(session.geofence, isNull);
      expect(session.pinRequired, isTrue);
      expect(Session.fromJson(session.toJson()), session);

      final record = AttendanceRecord.fromJson({
        'id': 'rec-1',
        'sessionId': 'ses-1',
        'sectionId': 'sec-1',
        'studentId': 'u-1',
        'studentName': 'Maria Clara',
        'timestamp': '2026-11-10T00:05:00Z',
        'status': 'incomplete',
        'coordinates': {'latitude': null, 'longitude': null},
        'mode': 'online',
        'checkInTime': '2026-11-10T00:01:00Z',
        'checkInStatus': 'present',
        'checkOutTime': null,
        'checkOutStatus': null,
        'disputeReason': 'concurrent_session_conflict',
        'disputeResolved': false,
        'manuallySet': false,
        'isSynced': true,
        'excuseStatus': 'requested',
        'excuseReason': 'medical',
      });
      expect(record.status, AttendanceStatus.incomplete);
      expect(record.mode, SessionMode.online);
      expect(record.coordinates.latitude, isNull);
      expect(record.checkInStatus, AttendanceStatus.present);
      expect(record.disputeReason, DisputeReason.concurrentSessionConflict);
      expect(record.excuseReason, ExcuseReason.medical);
      expect(AttendanceRecord.fromJson(record.toJson()), record);
    });

    test('dispute reason sets mirror the backend allowlists exactly', () {
      expect(studentDisputeReasons.map((reason) => reason.wire), [
        'outside_geofence',
        'expired_token',
        'duplicate_submission',
        'invalid_signature',
        'device_mismatch',
        'suspicious_coordinates',
        'other',
      ]);
      // Mirrors `SystemDisputeReason` in `shared/src/types/attendance.ts`
      // exactly, including the server-stamped `missing_scan_evidence` (DD-C3).
      expect(systemDisputeReasons.map((reason) => reason.wire), <String>[
        'delayed_offline_sync',
        'missing_scan_evidence',
        'invalid_timestamp',
        'implausible_client_timestamp',
        'token_mismatch',
        'session_inactive',
        'not_enrolled',
        'qr_expired',
        'rate_limited',
        'mocked_location',
        'rooted_device',
        'hook_detected',
        'emulator_detected',
        'concurrent_session_conflict',
      ]);
      expect(
        systemDisputeReasons.contains(DisputeReason.missingScanEvidence),
        isTrue,
      );
      expect(DisputeReason.other.isStudentReason, isTrue);
      expect(DisputeReason.other.isSystemReason, isFalse);
      expect(DisputeReason.mockedLocation.isSystemReason, isTrue);
      expect(DisputeReason.mockedLocation.isStudentReason, isFalse);
    });

    test('returned credential + import summary shapes parse', () {
      final summary = StudentImportSummary.fromJson({
        'total': 10,
        'valid': 8,
        'skip': 1,
        'invalid': 1,
        'new': 7,
        'update': 1,
      });
      expect(summary.newCount, 7);
      expect(summary.update, 1);

      final result = StudentImportResult.fromJson({
        'mode': 'validate',
        'conflictMode': 'skip_existing',
        'rowChecksum': 'abc',
        'summary': {
          'total': 1,
          'valid': 1,
          'skip': 0,
          'invalid': 0,
          'new': 1,
          'update': 0,
        },
        'issues': [
          {
            'rowNumber': 2,
            'column': 'studentId',
            'code': 'STUDENT_NOT_FOUND',
            'message': 'No matching student',
          },
        ],
        'hasMoreIssues': false,
      });
      expect(result.mode, ImportMode.validate);
      expect(result.conflictMode, ImportConflictMode.skipExisting);
      expect(result.issues.single.code, ImportIssueCode.studentNotFound);
    });

    test('system report enums + submitter parse', () {
      final report = SystemReport.fromJson({
        'id': 'rep-1',
        'category': 'geofence_gps',
        'severity': 'high',
        'title': 'GPS drift',
        'description': 'Reported location is far from the room',
        'status': 'in_review',
        'createdAt': '2026-11-01T00:00:00Z',
        'updatedAt': '2026-11-01T00:00:00Z',
        'user': {'id': 'u-1', 'fullName': 'Maria Clara', 'role': 'student'},
      });
      expect(report.category, ReportCategory.geofenceGps);
      expect(report.severity, ReportSeverity.high);
      expect(report.status, ReportStatus.inReview);
      expect(report.user.role, UserRole.student);
    });

    test('calendar events parse the discriminated fields', () {
      final event = CalendarEvent.fromJson({
        'id': 'ses-1',
        'title': 'Capstone 1',
        'date': '2026-11-10',
        'startTime': '08:00',
        'endTime': '10:00',
        'sectionId': 'sec-1',
        'subjectName': 'Capstone 1',
        'sectionName': '4-1',
        'type': 'session',
        'status': 'active',
        'studentStatus': 'present',
        'attendanceCounts': {
          'present': 30,
          'late': 5,
          'absent': 5,
          'disputed': 0,
        },
      });
      expect(event.type, CalendarEventType.session);
      expect(event.status, CalendarEventStatus.active);
      expect(event.studentStatus, CalendarEventStudentStatus.present);
      expect(event.attendanceCounts?.present, 30);
    });

    test('activated checkpoint input serializes the override flag', () {
      const input = GenerateCheckpointQrInput(
        sessionId: 'ses-1',
        checkpoint: CheckpointType.start,
        validitySeconds: 120,
        pin: '1234',
        teacherLocation: TeacherActivationLocation(
          latitude: 14.8697,
          longitude: 120.9991,
          overrideFlag: true,
        ),
      );
      final json = input.toJson();
      expect(json['checkpoint'], 'start');
      expect(
        (json['teacherLocation'] as Map<String, dynamic>)['override'],
        isTrue,
      );
    });

    test('AI stream events parse delta/done/error variants', () {
      final delta = AiStreamEvent.fromJson({
        'type': 'delta',
        'threadId': 'th-1',
        'messageId': 'msg-1',
        'text': 'Hello',
      });
      expect(delta, isA<AiStreamDelta>());

      final done = AiStreamEvent.fromJson({
        'type': 'done',
        'threadId': 'th-1',
        'message': {
          'id': 'msg-1',
          'threadId': 'th-1',
          'role': 'assistant',
          'content': 'Done',
          'createdAt': '2026-11-01T00:00:00Z',
        },
      });
      expect(done, isA<AiStreamDone>());
      expect((done as AiStreamDone).message.role, AiChatRole.assistant);

      final error = AiStreamEvent.fromJson({
        'type': 'error',
        'threadId': 'th-1',
        'message': 'provider unavailable',
      });
      expect(error, isA<AiStreamError>());
    });
  });
}
