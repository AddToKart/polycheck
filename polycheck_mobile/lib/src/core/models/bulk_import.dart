import 'package:freezed_annotation/freezed_annotation.dart';

import 'support/wire_enum.dart';

part 'bulk_import.freezed.dart';
part 'bulk_import.g.dart';

/// Mirrors `shared/src/types/bulk-import.ts` (student + enrollment imports).
enum ImportMode {
  validate('validate'),
  execute('execute');

  const ImportMode(this.wire);

  final String wire;

  static final Map<String, ImportMode> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ImportMode fromWire(String value) =>
      decodeWireEnum('ImportMode', value, byWire);

  static ImportMode? tryParse(String value) => byWire[value];
}

class ImportModeConverter extends JsonConverter<ImportMode, String> {
  const ImportModeConverter();

  @override
  ImportMode fromJson(String json) => ImportMode.fromWire(json);

  @override
  String toJson(ImportMode object) => object.wire;
}

enum ImportConflictMode {
  skipExisting('skip_existing'),
  updateExisting('update_existing');

  const ImportConflictMode(this.wire);

  final String wire;

  static final Map<String, ImportConflictMode> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ImportConflictMode fromWire(String value) =>
      decodeWireEnum('ImportConflictMode', value, byWire);

  static ImportConflictMode? tryParse(String value) => byWire[value];
}

class ImportConflictModeConverter
    extends JsonConverter<ImportConflictMode, String> {
  const ImportConflictModeConverter();

  @override
  ImportConflictMode fromJson(String json) => ImportConflictMode.fromWire(json);

  @override
  String toJson(ImportConflictMode object) => object.wire;
}

enum ImportIssueCode {
  missingRequiredField('MISSING_REQUIRED_FIELD'),
  invalidStudentNumber('INVALID_STUDENT_NUMBER'),
  invalidEmail('INVALID_EMAIL'),
  duplicateInFile('DUPLICATE_IN_FILE'),
  yearLevelOutOfRange('YEAR_LEVEL_OUT_OF_RANGE'),
  programTooShort('PROGRAM_TOO_SHORT'),
  departmentMismatch('DEPARTMENT_MISMATCH'),
  excelMangledStudentNumber('EXCEL_MANGLED_STUDENT_NUMBER'),
  studentNotFound('STUDENT_NOT_FOUND'),
  studentInactive('STUDENT_INACTIVE'),
  alreadyEnrolled('ALREADY_ENROLLED'),
  accountAlreadyExists('ACCOUNT_ALREADY_EXISTS'),
  fieldUpdatePreview('FIELD_UPDATE_PREVIEW'),
  programYearMismatch('PROGRAM_YEAR_MISMATCH');

  const ImportIssueCode(this.wire);

  final String wire;

  static final Map<String, ImportIssueCode> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ImportIssueCode fromWire(String value) =>
      decodeWireEnum('ImportIssueCode', value, byWire);

  static ImportIssueCode? tryParse(String value) => byWire[value];
}

class ImportIssueCodeConverter extends JsonConverter<ImportIssueCode, String> {
  const ImportIssueCodeConverter();

  @override
  ImportIssueCode fromJson(String json) => ImportIssueCode.fromWire(json);

  @override
  String toJson(ImportIssueCode object) => object.wire;
}

enum ImportJobState {
  waiting('waiting'),
  active('active'),
  completed('completed'),
  failed('failed'),
  unknown('unknown');

  const ImportJobState(this.wire);

  final String wire;

  static final Map<String, ImportJobState> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ImportJobState fromWire(String value) =>
      decodeWireEnum('ImportJobState', value, byWire);

  static ImportJobState? tryParse(String value) => byWire[value];
}

class ImportJobStateConverter extends JsonConverter<ImportJobState, String> {
  const ImportJobStateConverter();

  @override
  ImportJobState fromJson(String json) => ImportJobState.fromWire(json);

  @override
  String toJson(ImportJobState object) => object.wire;
}

enum ImportBatchKind {
  studentRegistration('student_registration'),
  sectionEnrollment('section_enrollment');

  const ImportBatchKind(this.wire);

  final String wire;

  static final Map<String, ImportBatchKind> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ImportBatchKind fromWire(String value) =>
      decodeWireEnum('ImportBatchKind', value, byWire);

  static ImportBatchKind? tryParse(String value) => byWire[value];
}

class ImportBatchKindConverter extends JsonConverter<ImportBatchKind, String> {
  const ImportBatchKindConverter();

  @override
  ImportBatchKind fromJson(String json) => ImportBatchKind.fromWire(json);

  @override
  String toJson(ImportBatchKind object) => object.wire;
}

@freezed
abstract class StudentImportRow with _$StudentImportRow {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory StudentImportRow({
    required int rowNumber,
    required String fullName,
    required String studentId,
    String? email,
    String? program,
    int? yearLevel,
    String? department,
  }) = _StudentImportRow;

  factory StudentImportRow.fromJson(Map<String, dynamic> json) =>
      _$StudentImportRowFromJson(json);
}

@freezed
abstract class EnrollImportRow with _$EnrollImportRow {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory EnrollImportRow({
    required int rowNumber,
    required String studentId,
    String? studentName,
    String? expectedProgram,
    int? expectedYearLevel,
  }) = _EnrollImportRow;

  factory EnrollImportRow.fromJson(Map<String, dynamic> json) =>
      _$EnrollImportRowFromJson(json);
}

@freezed
abstract class ImportIssue with _$ImportIssue {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ImportIssueCodeConverter()],
  )
  const factory ImportIssue({
    required int rowNumber,
    String? column,
    required ImportIssueCode code,
    @Default('') String message,
  }) = _ImportIssue;

  factory ImportIssue.fromJson(Map<String, dynamic> json) =>
      _$ImportIssueFromJson(json);
}

@freezed
abstract class StudentImportSummary with _$StudentImportSummary {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory StudentImportSummary({
    @Default(0) int total,
    @Default(0) int valid,
    @Default(0) int skip,
    @Default(0) int invalid,
    @JsonKey(name: 'new') @Default(0) int newCount,
    @Default(0) int update,
  }) = _StudentImportSummary;

  factory StudentImportSummary.fromJson(Map<String, dynamic> json) =>
      _$StudentImportSummaryFromJson(json);
}

@freezed
abstract class EnrollImportSummary with _$EnrollImportSummary {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory EnrollImportSummary({
    @Default(0) int total,
    @Default(0) int valid,
    @Default(0) int skip,
    @Default(0) int invalid,
    @Default(0) int enrollable,
    int? provisioning,
  }) = _EnrollImportSummary;

  factory EnrollImportSummary.fromJson(Map<String, dynamic> json) =>
      _$EnrollImportSummaryFromJson(json);
}

@freezed
abstract class ImportCredential with _$ImportCredential {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory ImportCredential({
    @Default(0) int rowNumber,
    @Default('') String studentId,
    @Default('') String tempPassword,
  }) = _ImportCredential;

  factory ImportCredential.fromJson(Map<String, dynamic> json) =>
      _$ImportCredentialFromJson(json);
}

@freezed
abstract class StudentImportResult with _$StudentImportResult {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ImportModeConverter(), ImportConflictModeConverter()],
  )
  const factory StudentImportResult({
    required ImportMode mode,
    required ImportConflictMode conflictMode,
    @Default('') String rowChecksum,
    required StudentImportSummary summary,
    @Default(<ImportIssue>[]) List<ImportIssue> issues,
    @Default(false) bool hasMoreIssues,
    List<ImportCredential>? credentials,
  }) = _StudentImportResult;

  factory StudentImportResult.fromJson(Map<String, dynamic> json) =>
      _$StudentImportResultFromJson(json);
}

@freezed
abstract class EnrollImportResult with _$EnrollImportResult {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ImportModeConverter()],
  )
  const factory EnrollImportResult({
    required ImportMode mode,
    @Default('') String rowChecksum,
    required EnrollImportSummary summary,
    @Default(<ImportIssue>[]) List<ImportIssue> issues,
    @Default(false) bool hasMoreIssues,
  }) = _EnrollImportResult;

  factory EnrollImportResult.fromJson(Map<String, dynamic> json) =>
      _$EnrollImportResultFromJson(json);
}

@freezed
abstract class ImportChunkResult with _$ImportChunkResult {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory ImportChunkResult({
    @Default(0) int chunkIndex,
    @Default(0) int created,
    int? updated,
    @Default(0) int skipped,
    @Default(0) int failed,
  }) = _ImportChunkResult;

  factory ImportChunkResult.fromJson(Map<String, dynamic> json) =>
      _$ImportChunkResultFromJson(json);
}

@freezed
abstract class StudentImportRequest with _$StudentImportRequest {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ImportModeConverter(), ImportConflictModeConverter()],
  )
  const factory StudentImportRequest({
    required ImportMode mode,
    required ImportConflictMode conflictMode,
    @Default(<StudentImportRow>[]) List<StudentImportRow> rows,
    String? idempotencyKey,
    String? rowChecksum,
  }) = _StudentImportRequest;

  factory StudentImportRequest.fromJson(Map<String, dynamic> json) =>
      _$StudentImportRequestFromJson(json);
}

@freezed
abstract class EnrollImportRequest with _$EnrollImportRequest {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ImportModeConverter()],
  )
  const factory EnrollImportRequest({
    required ImportMode mode,
    @Default(<EnrollImportRow>[]) List<EnrollImportRow> rows,
    String? idempotencyKey,
    String? rowChecksum,
  }) = _EnrollImportRequest;

  factory EnrollImportRequest.fromJson(Map<String, dynamic> json) =>
      _$EnrollImportRequestFromJson(json);
}

@freezed
abstract class ImportJobProgress with _$ImportJobProgress {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory ImportJobProgress({
    @Default(0) int chunksDone,
    @Default(0) int chunksTotal,
  }) = _ImportJobProgress;

  factory ImportJobProgress.fromJson(Map<String, dynamic> json) =>
      _$ImportJobProgressFromJson(json);
}

@freezed
abstract class ImportJobStatus with _$ImportJobStatus {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ImportJobStateConverter()],
  )
  const factory ImportJobStatus({
    required String id,
    required ImportJobState state,
    ImportJobProgress? progress,
    StudentImportResult? result,
    String? error,
  }) = _ImportJobStatus;

  factory ImportJobStatus.fromJson(Map<String, dynamic> json) =>
      _$ImportJobStatusFromJson(json);
}

@freezed
abstract class ImportBatchSummary with _$ImportBatchSummary {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ImportBatchKindConverter()],
  )
  const factory ImportBatchSummary({
    required String id,
    required ImportBatchKind kind,
    @Default('') String actorId,
    String? department,
    @Default('') String createdAt,
    @Default(0) int total,
    @Default(0) int created,
    @Default(0) int updated,
    @Default(0) int skipped,
    @Default(0) int failed,
    @Default('') String rowChecksum,
  }) = _ImportBatchSummary;

  factory ImportBatchSummary.fromJson(Map<String, dynamic> json) =>
      _$ImportBatchSummaryFromJson(json);
}
