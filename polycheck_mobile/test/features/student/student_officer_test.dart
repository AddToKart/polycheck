import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/data/officer_session_form.dart';
import 'package:polycheck_mobile/src/features/student/data/student_models.dart';
import 'package:polycheck_mobile/src/features/student/presentation/officer/student_create_session_screen.dart';
import 'package:polycheck_mobile/src/features/student/presentation/officer/student_section_detail_screen.dart';

import 'student_test_harness.dart';

/// Wraps a plain detail fixture with the tri-state permission outcome derived
/// from its `hasActivePermission` flag (Bug 6 provider contract).
StudentSectionDetailView _view(StudentSectionDetail detail) {
  return StudentSectionDetailView(
    detail: detail,
    permission: detail.hasActivePermission
        ? OfficerPermissionCheck.authorized
        : OfficerPermissionCheck.denied,
  );
}

void main() {
  group('officer session slot math', () {
    final section = testSection(
      schedule: const <ScheduleDay>[
        ScheduleDay(
          day: DayOfWeek.mon,
          startTime: '08:00',
          endTime: '09:30',
          room: 'Lab 1',
        ),
        ScheduleDay(
          day: DayOfWeek.wed,
          startTime: '10:00',
          endTime: '11:30',
          room: 'Lab 2',
        ),
      ],
    );

    test('prefills the slot matching today and falls back to the first', () {
      final monday = initialOfficerFormSeed(section, todayDate: '2026-11-09');
      expect(monday.slotValue, '0');
      expect(monday.date, '2026-11-09');
      expect(monday.startTime, '08:00');
      expect(monday.endTime, '09:30');
      expect(monday.room, 'Lab 1');

      final tuesday = initialOfficerFormSeed(section, todayDate: '2026-11-10');
      expect(tuesday.slotValue, '0');
      expect(tuesday.date, '2026-11-16');
    });

    test('picking a meeting moves the date to its next occurrence', () {
      final wednesday = officerFormSeedForSlot(
        section,
        1,
        todayDate: '2026-11-09',
      );
      expect(wednesday.slotValue, '1');
      expect(wednesday.date, '2026-11-11');
      expect(wednesday.startTime, '10:00');
      expect(wednesday.room, 'Lab 2');
    });

    test('a section without a schedule seeds a custom date', () {
      final seed = initialOfficerFormSeed(
        testSection(schedule: const <ScheduleDay>[]),
        todayDate: '2026-11-09',
      );
      expect(seed.slotValue, customSlotValue);
      expect(seed.date, '2026-11-09');
      expect(seed.startTime, '09:00');
      expect(seed.endTime, '10:30');
    });
  });

  group('officer create-session gates', () {
    Future<void> pumpCreate(
      WidgetTester tester,
      StudentSectionDetail detail,
    ) async {
      await pumpStudentScreen(
        tester,
        const StudentCreateSessionScreen(sectionId: 'sec-1'),
        overrides: <Override>[
          studentSectionDetailProvider.overrideWith(
            (ref, sectionId) async => _view(detail),
          ),
        ],
      );
      await tester.pumpAndSettle();
    }

    testWidgets('plain students are denied', (tester) async {
      await pumpCreate(
        tester,
        StudentSectionDetail(
          section: testSection(),
          subject: testSubject,
          sessions: const <Session>[],
          roles: const <SectionRole>[],
        ),
      );
      expect(find.text('Officer access required'), findsOneWidget);
    });

    testWidgets('QAC officers cannot create sessions', (tester) async {
      await pumpCreate(
        tester,
        StudentSectionDetail(
          section: testSection(),
          subject: testSubject,
          sessions: const <Session>[],
          roles: const <SectionRole>[
            SectionRole(
              id: 'sr-1',
              sectionId: 'sec-1',
              studentId: 'student-1',
              role: SectionRoleType.qac,
            ),
          ],
        ),
      );
      expect(find.text('President only'), findsOneWidget);
    });

    testWidgets('presidents need an active session permission', (tester) async {
      await pumpCreate(
        tester,
        StudentSectionDetail(
          section: testSection(),
          subject: testSubject,
          sessions: const <Session>[],
          roles: const <SectionRole>[
            SectionRole(
              id: 'sr-1',
              sectionId: 'sec-1',
              studentId: 'student-1',
              role: SectionRoleType.president,
            ),
          ],
          hasActivePermission: false,
        ),
      );
      expect(find.text('Permission required'), findsOneWidget);
    });
  });

  testWidgets('section detail shows officer badges and the create action', (
    tester,
  ) async {
    const detail = StudentSectionDetail(
      section: Section(
        id: 'sec-1',
        subjectId: 'subj-1',
        section: '3-1',
        course: 'BSIT',
        room: 'Room 201',
        semester: '1st Semester',
        teacherId: 'teacher-1',
        teacherName: 'Prof. Juan Dela Cruz',
      ),
      sessions: <Session>[],
      roles: <SectionRole>[
        SectionRole(
          id: 'sr-1',
          sectionId: 'sec-1',
          studentId: 'student-1',
          role: SectionRoleType.president,
        ),
        SectionRole(
          id: 'sr-2',
          sectionId: 'sec-1',
          studentId: 'student-1',
          role: SectionRoleType.qac,
        ),
      ],
      hasActivePermission: true,
    );

    await pumpStudentScreen(
      tester,
      const StudentSectionDetailScreen(sectionId: 'sec-1'),
      overrides: <Override>[
        studentSectionDetailProvider.overrideWith(
          (ref, sectionId) async => _view(detail),
        ),
        myAttendanceProvider.overrideWith(
          (ref) => Stream.value(<AttendanceRecord>[testRecord()]),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Section president'), findsOneWidget);
    expect(find.text('QAC officer'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('officer-create-session')),
      findsOneWidget,
    );
  });
}
