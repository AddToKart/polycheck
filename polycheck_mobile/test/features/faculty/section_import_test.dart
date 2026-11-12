import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/bulk_import.dart';
import 'package:polycheck_mobile/src/features/faculty/data/section_import.dart';

void main() {
  group('CSV parser', () {
    test('handles BOM, CRLF, quotes and blank lines', () {
      const csv =
          '\uFEFFStudent No.,Name,Program\r\n'
          '2024-00001-MN-0,"Dela Cruz, Juan",BSIT\r\n'
          '\r\n'
          '2024-00002-MN-0,Mia Aquino,"BS ""IT"""\r\n';
      final parsed = parseImportCsv(csv);
      expect(parsed.headers, ['Student No.', 'Name', 'Program']);
      expect(parsed.rows, hasLength(2));
      expect(parsed.rows.first, ['2024-00001-MN-0', 'Dela Cruz, Juan', 'BSIT']);
      expect(parsed.rows[1][2], 'BS "IT"');
      expect(parsed.errors, isEmpty);
    });

    test('reports an unclosed quote', () {
      final parsed = parseImportCsv('A,B\n"open,value\n');
      expect(parsed.rows, hasLength(1));
      expect(parsed.errors.join(' '), contains('not closed'));
    });

    test('suggests the PUP master-list column mapping', () {
      final mapping = suggestImportMapping(const [
        'Student No.',
        'Name',
        'Program',
        'Year Level',
      ]);
      expect(mapping.studentId, 0);
      expect(mapping.fullName, 1);
      expect(mapping.program, 2);
      expect(mapping.yearLevel, 3);
      expect(mapping.canImport, isTrue);
    });

    test('maps the SN alias for student number', () {
      final mapping = suggestImportMapping(const ['SN', 'Surname, First name']);
      expect(mapping.studentId, 0);
      expect(mapping.fullName, 1);
    });
  });

  group('row building', () {
    test('normalizes identifiers and 1st Year labels', () {
      final mapping = const ImportColumnMapping(
        studentId: 0,
        fullName: 1,
        program: 2,
        yearLevel: 3,
      );
      final built = buildEnrollImportRows([
        [' 2024-00001-mn-0 ', ' Dela Cruz,  Juan ', ' BSIT ', '1st Year'],
        ['2024-00002-MN-0', 'Aquino, Mia', 'BSCS', '2'],
      ], mapping);
      expect(built.issues, isEmpty);
      expect(built.rows, hasLength(2));
      expect(built.rows.first.studentId, '2024-00001-MN-0');
      expect(built.rows.first.studentName, 'Dela Cruz, Juan');
      expect(built.rows.first.expectedProgram, 'BSIT');
      expect(built.rows.first.expectedYearLevel, 1);
      expect(built.rows[1].expectedYearLevel, 2);
      expect(built.rows.first.rowNumber, 2);
    });

    test('flags duplicates, invalid and Excel-mangled numbers', () {
      final mapping = const ImportColumnMapping(studentId: 0, fullName: 1);
      final built = buildEnrollImportRows([
        ['2024-00001-MN-0', 'A'],
        ['2024-00001-MN-0', 'B'],
        ['12345', 'C'],
        ['not-an-id', 'D'],
        ['', 'E'],
      ], mapping);
      expect(built.rows, hasLength(1));
      final codes = built.issues.map((issue) => issue.code).toList();
      expect(codes, contains(ImportIssueCode.duplicateInFile));
      expect(codes, contains(ImportIssueCode.excelMangledStudentNumber));
      expect(codes, contains(ImportIssueCode.invalidStudentNumber));
      expect(built.issues.first.rowNumber, 3);
      // Missing student number rows are skipped silently.
      expect(built.issues.any((issue) => issue.rowNumber == 6), isFalse);
    });

    test('caps at the backend 250-row request limit', () {
      expect(enrollImportMaxRows, 250);
    });

    test('issues CSV is formula-safe and quoted', () {
      final csv = importIssuesCsv([
        const ImportIssue(
          rowNumber: 2,
          column: 'studentId',
          code: ImportIssueCode.invalidStudentNumber,
          message: 'Enter a valid PUP student number (e.g. 2024-00001-MN-0).',
        ),
        const ImportIssue(
          rowNumber: 3,
          column: 'studentId',
          code: ImportIssueCode.excelMangledStudentNumber,
          message: '=SUM(A1)',
        ),
      ]);
      expect(csv.split('\r\n').first, '"Row","Column","Code","Message"');
      expect(csv, contains('"Row","Column"'));
      expect(csv, contains("'=SUM(A1)"));
    });
  });
}
