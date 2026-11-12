import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/attendance.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';
import 'package:polycheck_mobile/src/core/models/subject.dart';
import 'package:polycheck_mobile/src/features/faculty/data/faculty_csv.dart';

void main() {
  group('csv cells', () {
    test('neutralizes spreadsheet formulas', () {
      expect(csvCell('=1+1'), '"\'=1+1"');
      expect(csvCell('+SUM(A1)'), '"\'+SUM(A1)"');
      expect(csvCell('-1'), '"\'-1"');
      expect(csvCell('@cmd'), '"\'@cmd"');
      expect(csvCell('plain'), '"plain"');
      expect(csvCell(null), '""');
    });

    test('escapes embedded quotes and joins CRLF', () {
      expect(csvCell('a"b'), '"a""b"');
      expect(
        csvText([
          ['a', 'b'],
          ['c', 'd'],
        ]),
        '"a","b"\r\n"c","d"',
      );
    });
  });

  group('attendance CSV', () {
    test('writes the stable header and a section heading row', () {
      const section = Section(
        id: 'sec-1',
        subjectId: 'subj-1',
        section: '4-1',
        course: 'BSIT',
        room: 'CCIS Lab 3',
        teacherId: 'teacher-1',
      );
      final csv = buildAttendanceCsv(
        const [
          AttendanceRecord(
            id: 'rec-1',
            sessionId: 'sess-1',
            sectionId: 'sec-1',
            studentId: '2024-00001-MN-0',
            studentName: 'Dela Cruz, Juan',
            timestamp: '2026-11-13T01:00:00.000Z',
            status: AttendanceStatus.late,
            manuallySet: true,
            disputeReason: DisputeReason.outsideGeofence,
            mode: SessionMode.inPerson,
          ),
        ],
        sectionsById: {'sec-1': section},
        subjectNames: {'sec-1': 'Software Engineering'},
      );
      final lines = csv.split('\r\n');
      expect(lines.first.split(',').first, '"Record ID"');
      expect(lines, hasLength(2));
      expect(csv, contains('"Section 4-1 \u00B7 BSIT"'));
      expect(csv, contains('"Software Engineering"'));
      expect(csv, contains('"Dela Cruz, Juan"'));
      expect(csv, contains('"late"'));
      expect(csv, contains('"yes"'));
      expect(csv, contains('"open"'));
      expect(csv, contains('"outside_geofence"'));
    });
  });
}
