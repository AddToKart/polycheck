import '../../../core/polycheck_core.dart';

/// Paste-first enrollment import (Android BM6 parity).
///
/// Mirrors `shared/src/utils/import/{parse,map,normalize,rows}.ts`, capped at
/// the backend's 250-row `EnrollImportRequestSchema` limit
/// (`shared/src/validation/bulk-import.ts:23-68`).

const int enrollImportMaxRows = 250;

class ParsedCsv {
  const ParsedCsv({
    required this.headers,
    required this.rows,
    this.errors = const [],
  });

  final List<String> headers;
  final List<List<String>> rows;
  final List<String> errors;

  bool get isEmpty => headers.isEmpty || rows.isEmpty;
}

/// Minimal RFC-4180-style parser: quoted cells, doubled quotes, CRLF/LF, BOM.
ParsedCsv parseImportCsv(String text) {
  final cleaned = text.replaceFirst('\uFEFF', '');
  final records = <List<String>>[];
  var field = StringBuffer();
  var row = <String>[];
  var inQuotes = false;
  var errors = <String>[];

  void endField() {
    row.add(field.toString());
    field = StringBuffer();
  }

  void endRow() {
    endField();
    if (row.any((cell) => cell.trim().isNotEmpty)) records.add(row);
    row = <String>[];
  }

  for (var index = 0; index < cleaned.length; index += 1) {
    final char = cleaned[index];
    if (inQuotes) {
      if (char == '"') {
        if (index + 1 < cleaned.length && cleaned[index + 1] == '"') {
          field.write('"');
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field.write(char);
      }
      continue;
    }
    if (char == '"') {
      if (field.isNotEmpty) {
        errors.add(
          'Row ${records.length + 1}: unexpected quote inside a value.',
        );
      }
      inQuotes = true;
    } else if (char == ',') {
      endField();
    } else if (char == '\r') {
      if (index + 1 < cleaned.length && cleaned[index + 1] == '\n') {
        index += 1;
      }
      endRow();
    } else if (char == '\n') {
      endRow();
    } else {
      field.write(char);
    }
  }
  if (inQuotes) errors.add('The last quoted value is not closed.');
  if (field.isNotEmpty || row.isNotEmpty) endRow();
  if (records.isEmpty) {
    return ParsedCsv(headers: const [], rows: const [], errors: errors);
  }

  final headers = records.first.map((header) => header.trim()).toList();
  final rows = records
      .skip(1)
      .where((candidate) => candidate.any((cell) => cell.trim().isNotEmpty))
      .toList(growable: false);
  return ParsedCsv(headers: headers, rows: rows, errors: errors);
}

String importCell(List<String> row, int? index) {
  if (index == null || index < 0 || index >= row.length) return '';
  return row[index].trim();
}

class ImportColumnMapping {
  const ImportColumnMapping({
    this.studentId,
    this.fullName,
    this.program,
    this.yearLevel,
  });

  final int? studentId;
  final int? fullName;
  final int? program;
  final int? yearLevel;

  bool get canImport => studentId != null;
}

const Map<String, List<String>> _headerAliases = {
  'studentId': [
    'studentnumber',
    'studentno',
    'studentid',
    'sn',
    'pupstudentnumber',
    'pupstudentid',
    'idnumber',
  ],
  'fullName': [
    'name',
    'fullname',
    'studentname',
    'nameofstudent',
    'surnamefirstname',
    'lastnamefirstname',
    'completename',
  ],
  'program': ['program', 'course', 'degree', 'degreeprogram', 'curriculum'],
  'yearLevel': ['yearlevel', 'year', 'yr', 'yrlevel', 'yearofstudy'],
};

String _canonicalHeader(String value) =>
    value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

/// Suggests the automatic mapping for known PUP SIS headers.
ImportColumnMapping suggestImportMapping(List<String> headers) {
  final canonical = headers.map(_canonicalHeader).toList(growable: false);
  final used = <int>{};
  int? find(List<String> aliases, {bool containsName = false}) {
    for (var index = 0; index < canonical.length; index += 1) {
      if (used.contains(index)) continue;
      final header = canonical[index];
      if (aliases.contains(header)) {
        used.add(index);
        return index;
      }
    }
    if (containsName) {
      for (var index = 0; index < canonical.length; index += 1) {
        if (used.contains(index)) continue;
        if (canonical[index].contains('name') &&
            !canonical[index].contains('program')) {
          used.add(index);
          return index;
        }
      }
    }
    return null;
  }

  return ImportColumnMapping(
    studentId: find(_headerAliases['studentId']!),
    fullName: find(_headerAliases['fullName']!, containsName: true),
    program: find(_headerAliases['program']!),
    yearLevel: find(_headerAliases['yearLevel']!),
  );
}

final RegExp pupStudentIdPattern = RegExp(r'^\d{4}-\d{5}-[A-Z]{2}-\d$');

enum NormalizedIdIssue { missing, excelMangled, invalid }

({String? value, NormalizedIdIssue? issue}) normalizeStudentNumber(String raw) {
  var value = raw.replaceAll(RegExp(r'\s+'), '').trim().toUpperCase();
  if (value.isEmpty) return (value: null, issue: NormalizedIdIssue.missing);
  if (value.endsWith('.0') && RegExp(r'^\d').hasMatch(value)) {
    value = value.substring(0, value.length - 2);
  }
  if (RegExp(r'^\d+(\.\d+)?$').hasMatch(value) ||
      RegExp(r'^\d{4}[/-]\d{1,2}[/-]\d{1,2}$').hasMatch(value) ||
      RegExp(r'^\d{5,}$').hasMatch(value)) {
    return (value: null, issue: NormalizedIdIssue.excelMangled);
  }
  if (!pupStudentIdPattern.hasMatch(value)) {
    return (value: null, issue: NormalizedIdIssue.invalid);
  }
  return (value: value, issue: null);
}

int? normalizeYearLevel(String raw) {
  final value = raw.trim();
  if (value.isEmpty) return null;
  final numeric = RegExp(
    r'^(\d{1,2})(?:st|nd|rd|th)?\s*(?:year|yr)?$',
    caseSensitive: false,
  ).firstMatch(value);
  final prefixed = RegExp(
    r'^(?:year|yr)\s*(\d{1,2})$',
    caseSensitive: false,
  ).firstMatch(value);
  final parsed = int.tryParse(numeric?.group(1) ?? prefixed?.group(1) ?? '');
  if (parsed == null || parsed < 1 || parsed > 8) return null;
  return parsed;
}

class BuiltEnrollRows {
  const BuiltEnrollRows({required this.rows, required this.issues});

  final List<EnrollImportRow> rows;
  final List<ImportIssue> issues;
}

BuiltEnrollRows buildEnrollImportRows(
  List<List<String>> rawRows,
  ImportColumnMapping mapping,
) {
  final rows = <EnrollImportRow>[];
  final issues = <ImportIssue>[];
  final seen = <String, int>{};

  for (var index = 0; index < rawRows.length; index += 1) {
    final raw = rawRows[index];
    final rowNumber = index + 2;
    final id = normalizeStudentNumber(importCell(raw, mapping.studentId));
    if (id.issue == NormalizedIdIssue.missing) continue;
    if (id.issue != null) {
      issues.add(
        ImportIssue(
          rowNumber: rowNumber,
          column: 'studentId',
          code: id.issue == NormalizedIdIssue.excelMangled
              ? ImportIssueCode.excelMangledStudentNumber
              : ImportIssueCode.invalidStudentNumber,
          message: id.issue == NormalizedIdIssue.excelMangled
              ? 'Student number looks mangled by Excel. Re-export the CSV with '
                    'the SN column formatted as text.'
              : 'Enter a valid PUP student number (e.g. 2024-00001-MN-0).',
        ),
      );
      continue;
    }
    final duplicateOf = seen[id.value];
    if (duplicateOf != null) {
      issues.add(
        ImportIssue(
          rowNumber: rowNumber,
          column: 'studentId',
          code: ImportIssueCode.duplicateInFile,
          message: 'Duplicate of row $duplicateOf.',
        ),
      );
      continue;
    }
    seen[id.value!] = rowNumber;

    final name = importCell(
      raw,
      mapping.fullName,
    ).replaceAll(RegExp(r'\s+'), ' ');
    final program = importCell(
      raw,
      mapping.program,
    ).replaceAll(RegExp(r'\s+'), ' ');
    final year = normalizeYearLevel(importCell(raw, mapping.yearLevel));
    rows.add(
      EnrollImportRow(
        rowNumber: rowNumber,
        studentId: id.value!,
        studentName: name.isEmpty ? null : name,
        expectedProgram: program.isEmpty ? null : program,
        expectedYearLevel: year,
      ),
    );
  }
  return BuiltEnrollRows(rows: rows, issues: issues);
}

/// Issues CSV for sharing/copying after a validation run.
String importIssuesCsv(Iterable<ImportIssue> issues) {
  return csvTextForImport([
    ['Row', 'Column', 'Code', 'Message'],
    for (final issue in issues)
      [issue.rowNumber, issue.column ?? '', issue.code.wire, issue.message],
  ]);
}

String csvTextForImport(Iterable<Iterable<Object?>> rows) {
  String cell(Object? value) {
    final text = value == null ? '' : '$value';
    final guarded = RegExp(r'^[=+\-@\t\r]').hasMatch(text) ? "'$text" : text;
    return '"${guarded.replaceAll('"', '""')}"';
  }

  return rows.map((row) => row.map(cell).join(',')).join('\r\n');
}
