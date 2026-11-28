import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/section_create_screen.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/data/student_models.dart';
import 'package:polycheck_mobile/src/features/student/presentation/officer/student_create_session_screen.dart';

import '../../helpers/auth_harness.dart';
import '../student/student_test_harness.dart';

/// FLF-06: validation drift from the backend.
///
/// * The client time check was `^\d{2}:\d{2}$` on the officer form, so `99:99`
///   passed locally and 400'd against `TIME_OF_DAY`
///   (`([01]\d|2[0-3]):[0-5]\d`).
/// * The date picker offered `firstDate: 2020`, letting a class meeting be
///   created years in the past.
/// Finds the `TextField` inside the [CampusTextField] carrying [label]
/// (`CampusTextField` renders its label as a sibling `Text`, so
/// `widgetWithText(TextField, …)` cannot match).
Finder _fieldWithLabel(String label) => find.descendant(
  of: find.widgetWithText(CampusTextField, label),
  matching: find.byType(TextField),
);

void main() {
  group('time-of-day parity (FLF-06)', () {
    test('accepts the exact backend range', () {
      expect(isValidCampusTime('00:00'), isTrue);
      expect(isValidCampusTime('09:00'), isTrue);
      expect(isValidCampusTime('23:59'), isTrue);
      expect(isValidCampusTime(' 08:30 '), isTrue);
    });

    test('rejects out-of-range and malformed clocks', () {
      // The exact shapes the old `^\d{2}:\d{2}$` officer check let through.
      expect(isValidCampusTime('99:99'), isFalse);
      expect(isValidCampusTime('24:00'), isFalse);
      expect(isValidCampusTime('23:60'), isFalse);
      expect(isValidCampusTime('9:00'), isFalse);
      expect(isValidCampusTime('09:0'), isFalse);
      expect(isValidCampusTime(''), isFalse);
      expect(isValidCampusTime('noon'), isFalse);
    });
  });

  group('section create caps (FLF-06)', () {
    test('mirror the backend CreateSectionDto limits', () {
      expect(sectionCourseMaxLength, 30);
      expect(sectionLabelMaxLength, 100);
      expect(sectionRoomMaxLength, 100);
      expect(sectionMeetingRoomMaxLength, 100);
    });

    Future<void> pumpCreate(
      WidgetTester tester, {
      SectionsApi? sectionsApi,
    }) async {
      tester.view.physicalSize = const Size(1080, 3000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          overrides: <Override>[
            sessionProvider.overrideWith(
              () => FakeSessionController(testFaculty),
            ),
            subjectsApiProvider.overrideWithValue(_FakeSubjectsApi()),
            if (sectionsApi != null)
              sectionsApiProvider.overrideWithValue(sectionsApi),
          ],
          child: MaterialApp(
            theme: BrandTheme.light,
            home: const SectionCreateScreen(subjectId: 'subj-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('an over-long custom course errors before submit', (
      tester,
    ) async {
      await pumpCreate(tester);

      // Choose "Other — specify manually" so the custom field appears.
      await tester.tap(find.text('Select a course…'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(
        find.byKey(const ValueKey('course-option-custom')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('course-option-custom')));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const ValueKey('section-custom-course')),
        'B' * 31,
      );
      await tester.enterText(_fieldWithLabel('Section'), '4-1');
      await tester.enterText(_fieldWithLabel('Default room'), 'CEA 301');
      await tester.pump();

      await tester.tap(find.text('Create section'));
      await tester.pumpAndSettle();

      expect(
        find.text('Course codes are limited to 30 characters.'),
        findsOneWidget,
      );
      // Never reached the API (the fake would throw and surface its message).
      expect(find.textContaining('unexpected'), findsNothing);
    });

    testWidgets('a 30-character course passes local validation', (
      tester,
    ) async {
      final sectionsApi = _RecordingSectionsApi();
      await pumpCreate(tester, sectionsApi: sectionsApi);

      await tester.tap(find.text('Select a course…'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(
        find.byKey(const ValueKey('course-option-custom')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('course-option-custom')));
      await tester.pumpAndSettle();

      final course = 'C' * 30;
      await tester.enterText(
        find.byKey(const ValueKey('section-custom-course')),
        course,
      );
      await tester.enterText(_fieldWithLabel('Section'), '4-1');
      await tester.enterText(_fieldWithLabel('Default room'), 'CEA 301');
      await tester.pump();

      await tester.tap(find.text('Create section'));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(
        find.text('Course codes are limited to 30 characters.'),
        findsNothing,
      );
      expect(sectionsApi.created, hasLength(1));
      expect(sectionsApi.created.single.course, course);
    });
  });

  group('officer create-session form validation (FLF-06)', () {
    Future<void> pumpOfficerForm(WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 3000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

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
        ],
        hasActivePermission: true,
      );

      await pumpStudentScreen(
        tester,
        const StudentCreateSessionScreen(sectionId: 'sec-1'),
        overrides: <Override>[
          studentSectionDetailProvider.overrideWith(
            (ref, sectionId) async => StudentSectionDetailView(
              detail: detail,
              permission: OfficerPermissionCheck.authorized,
            ),
          ),
        ],
      );
      await tester.pumpAndSettle();
    }

    testWidgets('`99:99` is rejected locally', (tester) async {
      await pumpOfficerForm(tester);

      final start = _fieldWithLabel('Start time');
      final end = _fieldWithLabel('End time');
      await tester.enterText(start, '99:99');
      await tester.enterText(end, '10:30');
      await tester.pump();

      await tester.tap(find.text('Create session'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Enter both times as HH:mm'), findsOneWidget);
    });
  });
}

class _FakeSubjectsApi extends SubjectsApi {
  _FakeSubjectsApi() : super(Dio());

  @override
  Future<Subject> getSubject(String id) async => const Subject(
    id: 'subj-1',
    name: 'Integrative Programming',
    code: 'ITP-301',
  );
}

/// Records the create payload so a passing local validation is observable
/// without a network round trip (the screen would otherwise await a real POST).
class _RecordingSectionsApi extends SectionsApi {
  _RecordingSectionsApi() : super(Dio());

  final List<CreateSectionInput> created = <CreateSectionInput>[];

  @override
  Future<Section> createSection(CreateSectionInput input) async {
    created.add(input);
    return Section(
      id: 'sec-new',
      subjectId: input.subjectId,
      section: input.section,
      course: input.course,
      room: input.room,
      semester: input.semester,
      teacherId: 'teacher-1',
    );
  }
}
