import '../../../core/models/bulk_import.dart';

/// Mirrors `shared/src/utils/import/*` for the paste-first student import
/// wizard (no file picker dependency).
const int importChunkSize = 250;
const int importMaxRows = 5000;

enum ImportField {
  studentId('Student number'),
  fullName('Full name'),
  email('Email'),
  program('Program'),
  yearLevel('Year level'),
  department('Department');

  const ImportField(this.label);

  final String label;
}

const List<ImportField> studentImportFields = <ImportField>[
  ImportField.studentId,
  ImportField.fullName,
  ImportField.email,
  ImportField.program,
  ImportField.yearLevel,
  ImportField.department,
];

typedef ImportColumnMapping = Map<ImportField, int>;

const Set<ImportIssueCode> blockingImportCodes = <ImportIssueCode>{
  ImportIssueCode.missingRequiredField,
  ImportIssueCode.invalidStudentNumber,
  ImportIssueCode.excelMangledStudentNumber,
  ImportIssueCode.duplicateInFile,
};

class ParsedCsv {
  const ParsedCsv({
    required this.headers,
    required this.rows,
    this.errors = const <String>[],
  });

  final List<String> headers;
  final List<List<String>> rows;
  final List<String> errors;

  bool get isEmpty => headers.isEmpty || rows.isEmpty;
}

/// Minimal CSV parser (quotes, escaped quotes, CRLF). BOM is stripped.
ParsedCsv parseCsv(String text) {
  var source = text;
  if (source.startsWith('\uFEFF')) source = source.substring(1);
  final rows = <List<String>>[];
  var current = <String>[];
  final field = StringBuffer();
  var inQuotes = false;
  final errors = <String>[];
  var index = 0;

  void endRow() {
    current.add(field.toString());
    field.clear();
    rows.add(current);
    current = <String>[];
  }

  while (index < source.length) {
    final char = source[index];
    if (inQuotes) {
      if (char == '"') {
        if (index + 1 < source.length && source[index + 1] == '"') {
          field.write('"');
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field.write(char);
      index += 1;
      continue;
    }
    if (char == '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char == ',') {
      current.add(field.toString());
      field.clear();
      index += 1;
      continue;
    }
    if (char == '\r' || char == '\n') {
      if (char == '\r' &&
          index + 1 < source.length &&
          source[index + 1] == '\n') {
        index += 1;
      }
      endRow();
      index += 1;
      continue;
    }
    field.write(char);
    index += 1;
  }
  if (inQuotes) errors.add('A quoted value was not closed.');
  if (field.isNotEmpty || current.isNotEmpty) endRow();

  final cleaned = rows
      .where((row) => row.any((cell) => cell.trim().isNotEmpty))
      .toList(growable: false);
  if (cleaned.isEmpty) {
    return ParsedCsv(
      headers: const <String>[],
      rows: const <List<String>>[],
      errors: errors,
    );
  }
  final headers = cleaned.first
      .map((header) => header.trim())
      .toList(growable: false);
  final dataRows = cleaned
      .skip(1)
      .map((row) => row.map((cell) => cell.trim()).toList(growable: false))
      .toList(growable: false);
  return ParsedCsv(headers: headers, rows: dataRows, errors: errors);
}

String csvCell(
  List<String> row,
  ImportField field,
  ImportColumnMapping mapping,
) {
  final index = mapping[field];
  if (index == null || index < 0 || index >= row.length) return '';
  return row[index].trim();
}

bool isMappingComplete(ImportColumnMapping mapping) =>
    mapping.containsKey(ImportField.studentId) &&
    mapping.containsKey(ImportField.fullName);

const Map<ImportField, List<String>> _aliases = <ImportField, List<String>>{
  ImportField.studentId: <String>[
    'studentnumber',
    'studentno',
    'studentid',
    'studentnumberno',
    'sn',
    'pupstudentnumber',
    'pupstudentid',
    'idnumber',
  ],
  ImportField.fullName: <String>[
    'name',
    'fullname',
    'studentname',
    'nameofstudent',
    'surnamefirstname',
    'surnamefirstnamemi',
    'lastnamefirstname',
    'completename',
  ],
  ImportField.email: <String>[
    'email',
    'emailaddress',
    'pupemail',
    'studentemail',
  ],
  ImportField.program: <String>[
    'program',
    'course',
    'degree',
    'degreeprogram',
    'curriculum',
  ],
  ImportField.yearLevel: <String>[
    'yearlevel',
    'year',
    'yr',
    'yrlevel',
    'yearofstudy',
    'yearstanding',
  ],
  ImportField.department: <String>[
    'department',
    'dept',
    'college',
    'collegedepartment',
    'departmentcollege',
  ],
};

String canonicalHeader(String value) =>
    value.toLowerCase().replaceAll(RegExp('[^a-z0-9]'), '');

int _scoreHeader(ImportField field, String header) {
  final canonical = canonicalHeader(header);
  if (canonical.isEmpty) return 0;
  if (_aliases[field]!.contains(canonical)) return 100;
  switch (field) {
    case ImportField.studentId:
      if (RegExp('student(number|no|id)').hasMatch(canonical)) return 90;
      if (canonical == 'sn') return 85;
      if (RegExp('(^|student)pup?(number|no|id)').hasMatch(canonical)) {
        return 70;
      }
      if (canonical.endsWith('idnumber')) return 60;
      return 0;
    case ImportField.fullName:
      if (canonical.contains('name') && !canonical.contains('program')) {
        return 80;
      }
      if (canonical.contains('surname')) return 70;
      return 0;
    case ImportField.email:
      return canonical.contains('email') ? 90 : 0;
    case ImportField.program:
      if (canonical.contains('program') || canonical.contains('course')) {
        return 80;
      }
      if (canonical.contains('degree') || canonical.contains('curriculum')) {
        return 65;
      }
      return 0;
    case ImportField.yearLevel:
      if (RegExp(r'^(year|yr)(level|ofstudy|standing)?$').hasMatch(canonical)) {
        return 85;
      }
      if (canonical.contains('yearlevel') ||
          canonical.contains('yearofstudy')) {
        return 80;
      }
      return 0;
    case ImportField.department:
      if (canonical.contains('department') || canonical.contains('dept')) {
        return 85;
      }
      if (canonical.contains('college')) return 75;
      return 0;
  }
}

const List<ImportField> _mappingFieldOrder = <ImportField>[
  ImportField.studentId,
  ImportField.email,
  ImportField.yearLevel,
  ImportField.program,
  ImportField.department,
  ImportField.fullName,
];

ImportColumnMapping suggestColumnMapping(List<String> headers) {
  final mapping = <ImportField, int>{};
  final used = <int>{};
  for (final field in _mappingFieldOrder) {
    int? bestIndex;
    var bestScore = 0;
    for (var index = 0; index < headers.length; index++) {
      if (used.contains(index)) continue;
      final score = _scoreHeader(field, headers[index]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex != null && bestScore >= 60) {
      mapping[field] = bestIndex;
      used.add(bestIndex);
    }
  }
  return mapping;
}

class NormalizedValue<T> {
  const NormalizedValue({this.value, this.issue});

  final T? value;
  final ImportIssueCode? issue;
}

String _collapseWhitespace(String raw) =>
    raw.replaceAll(RegExp(r'\s+'), ' ').trim();

NormalizedValue<String> normalizeFullName(String raw) {
  final value = _collapseWhitespace(raw);
  if (value.length < 2) {
    return const NormalizedValue<String>(
      issue: ImportIssueCode.missingRequiredField,
    );
  }
  return NormalizedValue<String>(
    value: value.length > 150 ? value.substring(0, 150) : value,
  );
}

NormalizedValue<String> normalizeStudentId(String raw) {
  var value = raw.replaceAll(RegExp(r'\s+'), '').trim().toUpperCase();
  if (value.isEmpty) {
    return const NormalizedValue<String>(
      issue: ImportIssueCode.missingRequiredField,
    );
  }
  if (value.endsWith('.0') && RegExp('^\\d').hasMatch(value)) {
    value = value.substring(0, value.length - 2);
  }
  if (RegExp(r'^\d+(\.\d+)?$').hasMatch(value) ||
      RegExp(r'^\d{4}[/-]\d{1,2}[/-]\d{1,2}$').hasMatch(value) ||
      RegExp(r'^\d{5,}$').hasMatch(value)) {
    return const NormalizedValue<String>(
      issue: ImportIssueCode.excelMangledStudentNumber,
    );
  }
  if (!RegExp(r'^\d{4}-\d{5}-[A-Z]{2}-\d$').hasMatch(value)) {
    return const NormalizedValue<String>(
      issue: ImportIssueCode.invalidStudentNumber,
    );
  }
  return NormalizedValue<String>(value: value);
}

final RegExp _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

NormalizedValue<String> normalizeEmail(String raw) {
  final value = raw.trim().toLowerCase();
  if (value.isEmpty) return const NormalizedValue<String>();
  if (!_emailPattern.hasMatch(value) || value.length > 254) {
    return const NormalizedValue<String>(issue: ImportIssueCode.invalidEmail);
  }
  return NormalizedValue<String>(value: value);
}

NormalizedValue<String> normalizeProgram(String raw) {
  final value = _collapseWhitespace(raw);
  if (value.isEmpty) return const NormalizedValue<String>();
  if (value.length < 2) {
    return const NormalizedValue<String>(
      issue: ImportIssueCode.programTooShort,
    );
  }
  return NormalizedValue<String>(
    value: value.length > 150 ? value.substring(0, 150) : value,
  );
}

String? normalizeDepartment(String raw) {
  final value = _collapseWhitespace(raw);
  if (value.isEmpty) return null;
  return value.length > 100 ? value.substring(0, 100) : value;
}

NormalizedValue<int> normalizeYearLevel(String raw) {
  final value = raw.trim();
  if (value.isEmpty) return const NormalizedValue<int>();
  final numeric = RegExp(
    r'^(\d{1,2})(?:st|nd|rd|th)?\s*(?:year|yr)?$',
    caseSensitive: false,
  ).firstMatch(value);
  final prefixed = RegExp(
    r'^(?:year|yr)\s*(\d{1,2})$',
    caseSensitive: false,
  ).firstMatch(value);
  final parsed = int.tryParse(numeric?.group(1) ?? prefixed?.group(1) ?? '');
  if (parsed == null || parsed < 1 || parsed > 8) {
    return const NormalizedValue<int>(
      issue: ImportIssueCode.yearLevelOutOfRange,
    );
  }
  return NormalizedValue<int>(value: parsed);
}

class BuildResult {
  const BuildResult({required this.rows, required this.issues});

  final List<StudentImportRow> rows;
  final List<ImportIssue> issues;
}

BuildResult buildStudentRows(
  List<List<String>> rawRows,
  ImportColumnMapping mapping,
) {
  final rows = <StudentImportRow>[];
  final issues = <ImportIssue>[];
  final seen = <String, int>{};

  for (var index = 0; index < rawRows.length; index++) {
    final raw = rawRows[index];
    final rowNumber = index + 2;
    final studentIdResult = normalizeStudentId(
      csvCell(raw, ImportField.studentId, mapping),
    );
    final nameRaw = csvCell(raw, ImportField.fullName, mapping);
    final nameResult = normalizeFullName(nameRaw);

    if (studentIdResult.issue == ImportIssueCode.missingRequiredField &&
        nameRaw.trim().isEmpty) {
      continue;
    }
    if (studentIdResult.issue != null) {
      issues.add(
        ImportIssue(
          rowNumber: rowNumber,
          column: 'studentId',
          code: studentIdResult.issue!,
          message:
              studentIdResult.issue == ImportIssueCode.excelMangledStudentNumber
              ? 'Student number looks mangled by Excel. Re-export the CSV '
                    'with the SN column formatted as text.'
              : 'Enter a valid PUP student number (e.g. 2024-00001-MN-0).',
        ),
      );
    }
    if (nameResult.issue != null) {
      issues.add(
        ImportIssue(
          rowNumber: rowNumber,
          column: 'fullName',
          code: ImportIssueCode.missingRequiredField,
          message: 'Full name is required (at least 2 characters).',
        ),
      );
    }
    final studentId = studentIdResult.value;
    final fullName = nameResult.value;
    if (studentId == null || fullName == null) continue;

    final duplicateOf = seen[studentId];
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
    seen[studentId] = rowNumber;

    final emailResult = normalizeEmail(
      csvCell(raw, ImportField.email, mapping),
    );
    final programResult = normalizeProgram(
      csvCell(raw, ImportField.program, mapping),
    );
    final yearResult = normalizeYearLevel(
      csvCell(raw, ImportField.yearLevel, mapping),
    );
    if (emailResult.issue != null) {
      issues.add(
        ImportIssue(
          rowNumber: rowNumber,
          column: 'email',
          code: ImportIssueCode.invalidEmail,
          message: 'Email address is invalid and was ignored.',
        ),
      );
    }
    if (programResult.issue != null) {
      issues.add(
        ImportIssue(
          rowNumber: rowNumber,
          column: 'program',
          code: ImportIssueCode.programTooShort,
          message: 'Program name is too short and was ignored.',
        ),
      );
    }
    if (yearResult.issue != null) {
      issues.add(
        ImportIssue(
          rowNumber: rowNumber,
          column: 'yearLevel',
          code: ImportIssueCode.yearLevelOutOfRange,
          message: 'Year level must be between 1 and 8 and was ignored.',
        ),
      );
    }

    rows.add(
      StudentImportRow(
        rowNumber: rowNumber,
        studentId: studentId,
        fullName: fullName,
        email: emailResult.value,
        program: programResult.value,
        yearLevel: yearResult.value,
        department: normalizeDepartment(
          csvCell(raw, ImportField.department, mapping),
        ),
      ),
    );
  }
  return BuildResult(rows: rows, issues: issues);
}

List<List<T>> chunkRows<T>(List<T> rows, int size) {
  if (size <= 0) return <List<T>>[rows];
  final chunks = <List<T>>[];
  for (var start = 0; start < rows.length; start += size) {
    final end = start + size < rows.length ? start + size : rows.length;
    chunks.add(rows.sublist(start, end));
  }
  return chunks;
}

int blockingIssueCount(Iterable<ImportIssue> issues) =>
    issues.where((issue) => blockingImportCodes.contains(issue.code)).length;

bool hasBlockingIssues(Iterable<ImportIssue> issues) =>
    blockingIssueCount(issues) > 0;

String encodeCsv(List<List<String>> rows) {
  String escape(String value) {
    if (value.contains('"') ||
        value.contains(',') ||
        value.contains('\n') ||
        value.contains('\r')) {
      return '"${value.replaceAll('"', '""')}"';
    }
    return value;
  }

  return rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

String credentialsCsv(List<ImportCredential> credentials) {
  return encodeCsv(<List<String>>[
    const <String>['Row', 'Student number', 'Temporary password'],
    for (final credential in credentials)
      <String>[
        '${credential.rowNumber}',
        credential.studentId,
        credential.tempPassword,
      ],
  ]);
}

String issuesCsv(List<ImportIssue> issues) {
  return encodeCsv(<List<String>>[
    const <String>['Row', 'Column', 'Code', 'Message'],
    for (final issue in issues)
      <String>[
        '${issue.rowNumber}',
        issue.column ?? '',
        issue.code.wire,
        issue.message,
      ],
  ]);
}

class ImportCommitCounts {
  const ImportCommitCounts({
    this.created = 0,
    this.updated = 0,
    this.skipped = 0,
    this.failed = 0,
  });

  final int created;
  final int updated;
  final int skipped;
  final int failed;

  ImportCommitCounts plus({
    int created = 0,
    int updated = 0,
    int skipped = 0,
    int failed = 0,
  }) {
    return ImportCommitCounts(
      created: this.created + created,
      updated: this.updated + updated,
      skipped: this.skipped + skipped,
      failed: this.failed + failed,
    );
  }
}

enum BulkImportStep { input, map, review, report }

class BulkImportState {
  const BulkImportState({
    this.step = BulkImportStep.input,
    this.headers = const <String>[],
    this.sourceRows = const <List<String>>[],
    this.mapping = const <ImportField, int>{},
    this.localIssues = const <ImportIssue>[],
    this.serverIssues = const <ImportIssue>[],
    this.hasMoreIssues = false,
    this.rowChecksum,
    this.validRowCount = 0,
    this.conflictMode = ImportConflictMode.skipExisting,
    this.counts = const ImportCommitCounts(),
    this.credentials = const <ImportCredential>[],
    this.chunksDone = 0,
    this.chunksTotal = 0,
    this.error,
  });

  final BulkImportStep step;
  final List<String> headers;
  final List<List<String>> sourceRows;
  final ImportColumnMapping mapping;
  final List<ImportIssue> localIssues;
  final List<ImportIssue> serverIssues;
  final bool hasMoreIssues;
  final String? rowChecksum;
  final int validRowCount;
  final ImportConflictMode conflictMode;
  final ImportCommitCounts counts;
  final List<ImportCredential> credentials;
  final int chunksDone;
  final int chunksTotal;
  final String? error;

  List<ImportIssue> get allIssues => <ImportIssue>[
    ...localIssues,
    ...serverIssues,
  ];

  BulkImportState copyWith({
    BulkImportStep? step,
    List<String>? headers,
    List<List<String>>? sourceRows,
    ImportColumnMapping? mapping,
    List<ImportIssue>? localIssues,
    List<ImportIssue>? serverIssues,
    bool? hasMoreIssues,
    String? rowChecksum,
    int? validRowCount,
    ImportConflictMode? conflictMode,
    ImportCommitCounts? counts,
    List<ImportCredential>? credentials,
    int? chunksDone,
    int? chunksTotal,
    String? error,
    bool clearError = false,
    bool clearChecksum = false,
  }) {
    return BulkImportState(
      step: step ?? this.step,
      headers: headers ?? this.headers,
      sourceRows: sourceRows ?? this.sourceRows,
      mapping: mapping ?? this.mapping,
      localIssues: localIssues ?? this.localIssues,
      serverIssues: serverIssues ?? this.serverIssues,
      hasMoreIssues: hasMoreIssues ?? this.hasMoreIssues,
      rowChecksum: clearChecksum ? null : (rowChecksum ?? this.rowChecksum),
      validRowCount: validRowCount ?? this.validRowCount,
      conflictMode: conflictMode ?? this.conflictMode,
      counts: counts ?? this.counts,
      credentials: credentials ?? this.credentials,
      chunksDone: chunksDone ?? this.chunksDone,
      chunksTotal: chunksTotal ?? this.chunksTotal,
      error: clearError ? null : (error ?? this.error),
    );
  }

  BulkImportState withPaste(String text) {
    final parsed = parseCsv(text);
    if (parsed.headers.isEmpty) {
      return copyWith(error: 'Paste a CSV with a header row first.');
    }
    if (parsed.rows.isEmpty) {
      return copyWith(error: 'The pasted list has no data rows.');
    }
    if (parsed.rows.length > importMaxRows) {
      return copyWith(
        error:
            'This list has ${parsed.rows.length} rows. The limit is '
            '$importMaxRows.',
      );
    }
    if (parsed.errors.isNotEmpty) {
      return copyWith(error: parsed.errors.first);
    }
    return BulkImportState(
      step: BulkImportStep.map,
      headers: parsed.headers,
      sourceRows: parsed.rows,
      mapping: suggestColumnMapping(parsed.headers),
    );
  }

  BulkImportState withMapping(ImportField field, int? columnIndex) {
    final next = <ImportField, int>{...mapping};
    if (columnIndex == null) {
      next.remove(field);
    } else {
      next[field] = columnIndex;
    }
    return copyWith(mapping: next, clearError: true);
  }

  BulkImportState withConflictMode(ImportConflictMode mode) =>
      copyWith(conflictMode: mode);

  BulkImportState afterValidation({
    required List<ImportIssue> local,
    required List<ImportIssue> server,
    required bool more,
    required int validRows,
    String? checksum,
  }) {
    return copyWith(
      step: BulkImportStep.review,
      localIssues: local,
      serverIssues: server,
      hasMoreIssues: more,
      validRowCount: validRows,
      rowChecksum: checksum,
      clearError: true,
    );
  }

  BulkImportState afterCommit({
    required ImportCommitCounts committed,
    required List<ImportCredential> issuedCredentials,
    required int done,
    required int total,
  }) {
    return copyWith(
      step: BulkImportStep.report,
      counts: committed,
      credentials: issuedCredentials,
      chunksDone: done,
      chunksTotal: total,
      clearError: true,
    );
  }

  BulkImportState back() {
    return switch (step) {
      BulkImportStep.input => this,
      BulkImportStep.map => copyWith(
        step: BulkImportStep.input,
        clearError: true,
      ),
      BulkImportStep.review => copyWith(
        step: BulkImportStep.map,
        clearError: true,
      ),
      BulkImportStep.report => copyWith(step: BulkImportStep.report),
    };
  }
}
