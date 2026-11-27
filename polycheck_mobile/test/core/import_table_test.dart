import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/import_table.dart';
import 'package:polycheck_mobile/src/features/admin/domain/bulk_import.dart';
import 'package:polycheck_mobile/src/features/faculty/data/section_import.dart';

/// Made-up people in the two layouts a registrar actually sends.
void main() {
  const splitNames =
      'Student Number,Last Name,First Name,Middle Name,Section Code,Email\n'
      '2023-00101-SM-0,DELA PEÑA,JUAN CARLO,REYES,BSIT-SM 4-1,juan@example.com\n';
  const combined =
      'Name,Email Address\n'
      '"2023-00101-SM-0 Dela Peña, Juan",juan @exam ple.com\n';

  test('pasted student lists keep the whole name, program and year', () {
    final state = const BulkImportState().withPaste(splitNames);
    final row = buildStudentRows(state.sourceRows, state.mapping).rows.single;

    expect(row.fullName, 'DELA PEÑA, JUAN CARLO REYES');
    expect(row.studentId, '2023-00101-SM-0');
    expect(row.program, 'BSIT');
    expect(row.yearLevel, 4);
  });

  test('a student number sharing the name cell is separated', () {
    final state = const BulkImportState().withPaste(combined);
    final row = buildStudentRows(state.sourceRows, state.mapping).rows.single;

    expect(row.studentId, '2023-00101-SM-0');
    expect(row.fullName, 'Dela Peña, Juan');
    expect(row.email, 'juan@example.com');
  });

  test('a section roster reads the same combined list', () {
    final parsed = parseImportCsv(combined);
    final table = prepareImportTable(parsed.headers, parsed.rows);
    final built = buildEnrollImportRows(
      table.rows,
      suggestImportMapping(table.headers, table.rows),
    );

    expect(built.rows.single.studentId, '2023-00101-SM-0');
    expect(built.rows.single.studentName, 'Dela Peña, Juan');
  });

  test('a well-formed list is left alone', () {
    const headers = ['Student No.', 'Name', 'Program', 'Year Level'];
    const rows = [
      ['2023-00101-SM-0', 'Santos, Maria', 'BSHM', '2'],
    ];
    final table = prepareImportTable(headers, rows);
    expect(table.headers, headers);
    expect(table.rows, rows);
  });
}
