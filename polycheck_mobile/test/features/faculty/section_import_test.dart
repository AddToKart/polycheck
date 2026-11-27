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

    test('suggests the registrar master-list column mapping', () {
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

  group('class lists without student numbers', () {
    final parsed = parseImportCsv(
      'Name,Email Address,Mobile\n'
      '"Dela Cruz, Juan",JUAN@example.edu.ph,0917\n'
      '"Reyes, Ana",,0917\n',
    );

    test('matches rows by school email and reports the ones it cannot', () {
      final mapping = suggestImportMapping(parsed.headers, parsed.rows);
      expect(mapping.studentId, isNull);
      expect(mapping.email, 1);
      expect(mapping.canImport, isTrue);

      final built = buildEnrollImportRows(parsed.rows, mapping);
      expect(built.rows.single.email, 'juan@example.edu.ph');
      expect(built.rows.single.toJson().containsKey('studentId'), isFalse);
      expect(built.issues.single.rowNumber, 3);
      expect(built.issues.single.code, ImportIssueCode.missingRequiredField);
    });

    test('moving a column frees it from the field that had it', () {
      const mapping = ImportColumnMapping(email: 1, fullName: 0);
      final moved = mapping.withColumn('studentId', 1);
      expect(moved.studentId, 1);
      expect(moved.email, isNull);
      expect(moved.fullName, 0);
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
      // A named row with no number or email is reported, not dropped unseen.
      expect(
        built.issues.singleWhere((issue) => issue.rowNumber == 6).code,
        ImportIssueCode.missingRequiredField,
      );
    });

    test('caps at the backend 250-row request limit', () {
      expect(enrollImportMaxRows, 250);
    });

    test('truncates over-long names and programs at the DTO cap (FLF-05)', () {
      // `EnrollImportRowDto.studentName` / `.expectedProgram` are
      // `@MaxLength(150)`; the shared normalizer slices rather than rejects
      // (`shared/src/utils/import/normalize.ts:12,51`).
      expect(enrollImportMaxNameLength, 150);
      expect(enrollImportMaxProgramLength, 150);

      final mapping = const ImportColumnMapping(
        studentId: 0,
        fullName: 1,
        program: 2,
      );
      final built = buildEnrollImportRows([
        ['2024-00001-MN-0', 'A' * 300, 'B' * 300],
      ], mapping);

      expect(built.issues, isEmpty, reason: 'a long cell must not 400 or drop');
      expect(built.rows, hasLength(1));
      expect(built.rows.first.studentName, hasLength(150));
      expect(built.rows.first.expectedProgram, hasLength(150));
    });

    test('collapses whitespace before applying the cap (FLF-05)', () {
      final mapping = const ImportColumnMapping(studentId: 0, fullName: 1);
      final built = buildEnrollImportRows([
        [' 2024-00001-MN-0 ', '  Dela   Cruz,   Juan  '],
      ], mapping);

      expect(built.rows.single.studentName, 'Dela Cruz, Juan');
    });

    test('a collapsed name longer than 150 characters is sliced', () {
      final mapping = const ImportColumnMapping(studentId: 0, fullName: 1);
      // 200 chars of `x` separated by single spaces collapse to 399 chars.
      final name = List<String>.filled(200, 'x').join(' ');
      final built = buildEnrollImportRows([
        ['2024-00001-MN-0', name],
      ], mapping);

      expect(built.rows.single.studentName, hasLength(150));
      expect(built.rows.single.studentName, name.substring(0, 150));
    });

    test('issues CSV is formula-safe and quoted', () {
      final csv = importIssuesCsv([
        const ImportIssue(
          rowNumber: 2,
          column: 'studentId',
          code: ImportIssueCode.invalidStudentNumber,
          message: 'Enter a valid student number (e.g. 2024-00001-MN-0).',
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
