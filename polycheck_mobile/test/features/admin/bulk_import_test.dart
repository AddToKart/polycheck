import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/bulk_import.dart';
import 'package:polycheck_mobile/src/features/admin/domain/bulk_import.dart';

void main() {
  group('CSV parsing', () {
    test('strips BOM, handles quotes, CRLF, and skips blank lines', () {
      final parsed = parseCsv(
        '\uFEFFStudent No,Name,Email\r\n'
        '"2024-00001-MN-0","Santos, Maria",maria@example.edu.ph\r\n'
        '\r\n'
        '"2024-00002-MN-0","Dela ""Cruz""",,\r\n',
      );
      expect(parsed.headers, <String>['Student No', 'Name', 'Email']);
      expect(parsed.rows.length, 2);
      expect(parsed.rows.first[1], 'Santos, Maria');
      expect(parsed.rows.last[1], 'Dela "Cruz"');
      expect(parsed.isEmpty, isFalse);
    });

    test('reports an unterminated quote', () {
      final parsed = parseCsv('Name,Email\n"Maria,maria@example.edu.ph');
      expect(parsed.errors, isNotEmpty);
    });
  });

  group('column mapping', () {
    test('suggests the registrar master-list layout', () {
      final mapping = suggestColumnMapping(<String>[
        'Student No',
        'Name',
        'Email',
        'Program',
        'Year Level',
        'Department',
      ]);
      expect(mapping[ImportField.studentId], 0);
      expect(mapping[ImportField.fullName], 1);
      expect(mapping[ImportField.email], 2);
      expect(mapping[ImportField.program], 3);
      expect(mapping[ImportField.yearLevel], 4);
      // Students have no department, so that column is left alone.
      expect(mapping.values, isNot(contains(5)));
      expect(isMappingComplete(mapping), isTrue);
    });

    test('recognises unfamiliar headings by their contents', () {
      final mapping = suggestColumnMapping(
        <String>['Learner Ref', 'Learner', 'Contact', 'Track'],
        const <List<String>>[
          <String>['2023-00101-SM-0', 'Maria', 'maria@example.com', 'BSHM'],
        ],
      );
      expect(mapping[ImportField.studentId], 0);
      expect(mapping[ImportField.email], 2);
      expect(mapping[ImportField.program], 3);
    });

    test('names the missing column and never fills two fields from one', () {
      const noNumbers = 'Name,Email Address\nMaria Santos,maria@example.com\n';
      var state = const BulkImportState().withPaste(noNumbers);
      expect(
        missingColumnMessage(state.mapping),
        contains('holds: Student number'),
      );

      state = state.withMapping(ImportField.studentId, 0);
      expect(state.mapping[ImportField.studentId], 0);
      expect(state.mapping.containsKey(ImportField.fullName), isFalse);
    });

    test('requires student number and full name', () {
      final mapping = suggestColumnMapping(<String>['Email', 'Program']);
      expect(isMappingComplete(mapping), isFalse);
    });
  });

  group('normalization and row building', () {
    test('student numbers are normalized and Excel damage is detected', () {
      expect(normalizeStudentId(' 2024-00001-mn-0 ').value, '2024-00001-MN-0');
      expect(
        normalizeStudentId('202400001.0').issue,
        ImportIssueCode.excelMangledStudentNumber,
      );
      expect(
        normalizeStudentId('202400001').issue,
        ImportIssueCode.excelMangledStudentNumber,
      );
      expect(
        normalizeStudentId('ABC').issue,
        ImportIssueCode.invalidStudentNumber,
      );
      expect(
        normalizeStudentId('').issue,
        ImportIssueCode.missingRequiredField,
      );
    });

    test('year levels accept common formats and reject out-of-range', () {
      expect(normalizeYearLevel('2nd year').value, 2);
      expect(normalizeYearLevel('Year 4').value, 4);
      expect(
        normalizeYearLevel('9').issue,
        ImportIssueCode.yearLevelOutOfRange,
      );
      expect(normalizeYearLevel('').value, isNull);
    });

    test('builds rows and reports duplicates', () {
      final mapping = suggestColumnMapping(<String>[
        'Student No',
        'Name',
        'Email',
        'Program',
        'Year Level',
        'Department',
      ]);
      final built = buildStudentRows(<List<String>>[
        <String>[
          '2024-00001-MN-0',
          'Maria Santos',
          'MARIA@example.edu.ph',
          'BSIT',
          '2nd year',
          'CCIS',
        ],
        <String>['2024-00001-MN-0', 'Maria Santos', '', '', '', ''],
        <String>['202400002', 'Pedro Cruz', 'bad-email', '', '9', ''],
      ], mapping);

      expect(built.rows.length, 1);
      expect(built.rows.first.email, 'maria@example.edu.ph');
      expect(built.rows.first.yearLevel, 2);
      expect(
        built.issues.any(
          (issue) => issue.code == ImportIssueCode.duplicateInFile,
        ),
        isTrue,
      );
      expect(
        built.issues.any(
          (issue) => issue.code == ImportIssueCode.excelMangledStudentNumber,
        ),
        isTrue,
      );
      expect(blockingIssueCount(built.issues), greaterThan(0));
    });
  });

  group('chunking and CSV output', () {
    test('chunks rows at the server limit', () {
      final rows = List<int>.generate(501, (index) => index);
      final chunks = chunkRows(rows, importChunkSize);
      expect(chunks.length, 3);
      expect(chunks.first.length, 250);
      expect(chunks.last.length, 1);
    });

    test('encodes credentials and issues with escaping', () {
      final csv = credentialsCsv(const <ImportCredential>[
        ImportCredential(
          rowNumber: 2,
          studentId: '2024-00001-MN-0',
          tempPassword: 'PCK-A,BC!',
        ),
      ]);
      expect(csv.split('\r\n').first, 'Row,Student number,Temporary password');
      expect(csv, contains('"PCK-A,BC!"'));

      final issues = issuesCsv(const <ImportIssue>[
        ImportIssue(
          rowNumber: 3,
          column: 'studentId',
          code: ImportIssueCode.invalidStudentNumber,
          message: 'Enter a valid student number.',
        ),
      ]);
      expect(issues, contains('INVALID_STUDENT_NUMBER'));
    });
  });

  group('wizard transitions', () {
    const csv =
        'Student No,Name,Email\n'
        '2024-00001-MN-0,Maria Santos,maria@example.edu.ph\n';

    test('paste advances to mapping and validation to review', () {
      var state = const BulkImportState();
      expect(state.step, BulkImportStep.input);

      state = state.withPaste('');
      expect(state.error, contains('header row'));
      expect(state.step, BulkImportStep.input);

      state = state.withPaste(csv);
      expect(state.step, BulkImportStep.map);
      expect(state.headers.length, 3);
      expect(isMappingComplete(state.mapping), isTrue);

      state = state.withMapping(ImportField.email, null);
      expect(state.mapping[ImportField.email], isNull);
      state = state.withMapping(ImportField.email, 2);
      expect(state.mapping[ImportField.email], 2);

      state = state.afterValidation(
        local: const <ImportIssue>[],
        server: const <ImportIssue>[],
        more: false,
        validRows: 1,
      );
      expect(state.step, BulkImportStep.review);
      expect(state.validRowCount, 1);

      state = state.afterCommit(
        committed: const ImportCommitCounts(created: 1),
        issuedCredentials: const <ImportCredential>[],
        done: 1,
        total: 1,
      );
      expect(state.step, BulkImportStep.report);
      expect(state.counts.created, 1);
    });

    test('back walks the wizard without leaving the report step', () {
      const report = BulkImportState(step: BulkImportStep.report);
      expect(report.back().step, BulkImportStep.report);
      const review = BulkImportState(step: BulkImportStep.review);
      expect(review.back().step, BulkImportStep.map);
      const map = BulkImportState(step: BulkImportStep.map);
      expect(map.back().step, BulkImportStep.input);
    });

    test('over-limit lists and issue blocking are visible', () {
      final state = const BulkImportState().withPaste('');
      expect(state.error, isNotNull);
      expect(
        hasBlockingIssues(const <ImportIssue>[
          ImportIssue(
            rowNumber: 1,
            code: ImportIssueCode.duplicateInFile,
            message: 'Duplicate',
          ),
        ]),
        isTrue,
      );
      expect(
        hasBlockingIssues(const <ImportIssue>[
          ImportIssue(
            rowNumber: 1,
            code: ImportIssueCode.invalidEmail,
            message: 'Ignored email',
          ),
        ]),
        isFalse,
      );
    });
  });
}
