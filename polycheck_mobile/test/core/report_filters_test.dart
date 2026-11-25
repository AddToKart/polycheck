import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';

void main() {
  group('AttendanceReportFilters.toQuery', () {
    test('sends the course filter only when set', () {
      expect(const AttendanceReportFilters().toQuery(), isEmpty);
      expect(const AttendanceReportFilters(course: '').toQuery(), isEmpty);
      expect(
        const AttendanceReportFilters(
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          course: 'BSIT',
        ).toQuery(),
        <String, dynamic>{
          'startDate': '2026-11-01',
          'endDate': '2026-11-30',
          'course': 'BSIT',
        },
      );
    });

    test('keeps the legacy department filter independent of the course', () {
      final query = const AttendanceReportFilters(
        department: 'CCIS',
        course: 'BSHM',
      ).toQuery();
      expect(query['department'], 'CCIS');
      expect(query['course'], 'BSHM');
    });
  });
}
