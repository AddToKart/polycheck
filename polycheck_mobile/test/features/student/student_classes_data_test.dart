import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/data/student_classes_data.dart';

import 'student_test_harness.dart';

void main() {
  const algorithms = Subject(
    id: 'subj-a',
    name: 'Algorithms and Complexity',
    code: 'CS-301',
  );
  const webSystems = Subject(
    id: 'subj-b',
    name: 'Web Systems',
    code: 'ITP-302',
  );
  const subjects = <String, Subject>{
    'subj-a': algorithms,
    'subj-b': webSystems,
  };

  StudentClassCard cardFor(List<StudentClassCard> cards, String sectionId) =>
      cards.firstWhere((card) => card.sectionId == sectionId);

  group('buildMyClassCards', () {
    test('orders by subject name then section label', () {
      final cards = buildMyClassCards(
        sections: <Section>[
          testSection(id: 'sec-b', subjectId: 'subj-b', section: '2-1'),
          testSection(id: 'sec-a2', subjectId: 'subj-a', section: '1-2'),
          testSection(id: 'sec-a1', subjectId: 'subj-a', section: '1-1'),
        ],
        subjects: subjects,
        attendanceRecords: const <AttendanceRecord>[],
        rolesSnapshot: const <SectionRole>[],
      );

      expect(cards.map((card) => card.sectionId), <String>[
        'sec-a1',
        'sec-a2',
        'sec-b',
      ]);
    });

    test('computes per-section rates and status counts', () {
      final cards = buildMyClassCards(
        sections: <Section>[
          testSection(id: 'sec-1'),
          testSection(id: 'sec-2', subjectId: 'subj-b'),
        ],
        subjects: subjects,
        attendanceRecords: <AttendanceRecord>[
          testRecord(id: 'r1', sectionId: 'sec-1'),
          testRecord(id: 'r2', sectionId: 'sec-1'),
          testRecord(
            id: 'r3',
            sectionId: 'sec-1',
            status: AttendanceStatus.late,
          ),
          testRecord(
            id: 'r4',
            sectionId: 'sec-1',
            status: AttendanceStatus.absent,
          ),
          testRecord(
            id: 'r5',
            sectionId: 'sec-2',
            status: AttendanceStatus.absent,
          ),
        ],
        rolesSnapshot: const <SectionRole>[],
      );

      final first = cardFor(cards, 'sec-1');
      expect(first.ratePercent, 50);
      expect(first.presentCount, 2);
      expect(first.lateCount, 1);
      expect(first.absentCount, 1);
      expect(first.totalRecords, 4);
      expect(first.hasRecords, isTrue);

      final second = cardFor(cards, 'sec-2');
      expect(second.ratePercent, 0);
      expect(second.presentCount, 0);
      expect(second.absentCount, 1);
      expect(second.totalRecords, 1);
    });

    test('is zero-safe when a section has no attendance records', () {
      final cards = buildMyClassCards(
        sections: <Section>[testSection()],
        subjects: subjects,
        attendanceRecords: const <AttendanceRecord>[],
        rolesSnapshot: const <SectionRole>[],
      );

      final card = cardFor(cards, 'sec-1');
      expect(card.ratePercent, 0);
      expect(card.totalRecords, 0);
      expect(card.hasRecords, isFalse);
    });

    test('maps officer designations from the per-section roles snapshot', () {
      final cards = buildMyClassCards(
        sections: <Section>[
          testSection(id: 'sec-1'),
          testSection(id: 'sec-2', subjectId: 'subj-b'),
          testSection(id: 'sec-3', subjectId: 'subj-b', section: '2-2'),
        ],
        subjects: subjects,
        attendanceRecords: const <AttendanceRecord>[],
        rolesSnapshot: const <SectionRole>[
          SectionRole(
            id: 'sr-1',
            sectionId: 'sec-1',
            studentId: 'student-1',
            role: SectionRoleType.president,
          ),
          SectionRole(
            id: 'sr-2',
            sectionId: 'sec-2',
            studentId: 'student-1',
            role: SectionRoleType.qac,
          ),
        ],
      );

      final presidentCard = cardFor(cards, 'sec-1');
      expect(presidentCard.isPresident, isTrue);
      expect(presidentCard.isQac, isFalse);
      expect(presidentCard.isOfficer, isTrue);

      final qacCard = cardFor(cards, 'sec-2');
      expect(qacCard.isPresident, isFalse);
      expect(qacCard.isQac, isTrue);

      final plainCard = cardFor(cards, 'sec-3');
      expect(plainCard.officerRoles, isEmpty);
      expect(plainCard.isOfficer, isFalse);
    });

    test('labels use the course-aware section heading and teacher', () {
      final cards = buildMyClassCards(
        sections: <Section>[
          testSection(id: 'sec-1', subjectId: 'subj-a', course: 'BSIT'),
          testSection(
            id: 'sec-2',
            subjectId: 'subj-b',
            course: null,
            section: '4-2',
          ),
        ],
        subjects: subjects,
        attendanceRecords: const <AttendanceRecord>[],
        rolesSnapshot: const <SectionRole>[],
      );

      final withCourse = cardFor(cards, 'sec-1');
      expect(withCourse.sectionLabel, 'Section 3-1 · BSIT');
      expect(withCourse.teacherName, 'Prof. Juan Dela Cruz');
      expect(withCourse.subjectCode, 'CS-301');
      expect(withCourse.subjectName, 'Algorithms and Complexity');

      final withoutCourse = cardFor(cards, 'sec-2');
      expect(withoutCourse.sectionLabel, 'Section 4-2');
    });

    test('falls back to a generic name when the parent subject is missing', () {
      final cards = buildMyClassCards(
        sections: <Section>[testSection(subjectId: 'subj-missing')],
        subjects: subjects,
        attendanceRecords: const <AttendanceRecord>[],
        rolesSnapshot: const <SectionRole>[],
      );

      final card = cardFor(cards, 'sec-1');
      expect(card.subjectName, 'Class');
      expect(card.subjectCode, '');
      expect(card.isOfficer, isFalse);
    });
  });
}
