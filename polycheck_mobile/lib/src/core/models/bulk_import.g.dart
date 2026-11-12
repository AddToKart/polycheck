// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bulk_import.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_StudentImportRow _$StudentImportRowFromJson(Map<String, dynamic> json) =>
    _StudentImportRow(
      rowNumber: (json['rowNumber'] as num).toInt(),
      fullName: json['fullName'] as String,
      studentId: json['studentId'] as String,
      email: json['email'] as String?,
      program: json['program'] as String?,
      yearLevel: (json['yearLevel'] as num?)?.toInt(),
      department: json['department'] as String?,
    );

Map<String, dynamic> _$StudentImportRowToJson(_StudentImportRow instance) =>
    <String, dynamic>{
      'rowNumber': instance.rowNumber,
      'fullName': instance.fullName,
      'studentId': instance.studentId,
      'email': instance.email,
      'program': instance.program,
      'yearLevel': instance.yearLevel,
      'department': instance.department,
    };

_EnrollImportRow _$EnrollImportRowFromJson(Map<String, dynamic> json) =>
    _EnrollImportRow(
      rowNumber: (json['rowNumber'] as num).toInt(),
      studentId: json['studentId'] as String,
      studentName: json['studentName'] as String?,
      expectedProgram: json['expectedProgram'] as String?,
      expectedYearLevel: (json['expectedYearLevel'] as num?)?.toInt(),
    );

Map<String, dynamic> _$EnrollImportRowToJson(_EnrollImportRow instance) =>
    <String, dynamic>{
      'rowNumber': instance.rowNumber,
      'studentId': instance.studentId,
      'studentName': instance.studentName,
      'expectedProgram': instance.expectedProgram,
      'expectedYearLevel': instance.expectedYearLevel,
    };

_ImportIssue _$ImportIssueFromJson(Map<String, dynamic> json) => _ImportIssue(
  rowNumber: (json['rowNumber'] as num).toInt(),
  column: json['column'] as String?,
  code: const ImportIssueCodeConverter().fromJson(json['code'] as String),
  message: json['message'] as String? ?? '',
);

Map<String, dynamic> _$ImportIssueToJson(_ImportIssue instance) =>
    <String, dynamic>{
      'rowNumber': instance.rowNumber,
      'column': instance.column,
      'code': const ImportIssueCodeConverter().toJson(instance.code),
      'message': instance.message,
    };

_StudentImportSummary _$StudentImportSummaryFromJson(
  Map<String, dynamic> json,
) => _StudentImportSummary(
  total: (json['total'] as num?)?.toInt() ?? 0,
  valid: (json['valid'] as num?)?.toInt() ?? 0,
  skip: (json['skip'] as num?)?.toInt() ?? 0,
  invalid: (json['invalid'] as num?)?.toInt() ?? 0,
  newCount: (json['new'] as num?)?.toInt() ?? 0,
  update: (json['update'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$StudentImportSummaryToJson(
  _StudentImportSummary instance,
) => <String, dynamic>{
  'total': instance.total,
  'valid': instance.valid,
  'skip': instance.skip,
  'invalid': instance.invalid,
  'new': instance.newCount,
  'update': instance.update,
};

_EnrollImportSummary _$EnrollImportSummaryFromJson(Map<String, dynamic> json) =>
    _EnrollImportSummary(
      total: (json['total'] as num?)?.toInt() ?? 0,
      valid: (json['valid'] as num?)?.toInt() ?? 0,
      skip: (json['skip'] as num?)?.toInt() ?? 0,
      invalid: (json['invalid'] as num?)?.toInt() ?? 0,
      enrollable: (json['enrollable'] as num?)?.toInt() ?? 0,
      provisioning: (json['provisioning'] as num?)?.toInt(),
    );

Map<String, dynamic> _$EnrollImportSummaryToJson(
  _EnrollImportSummary instance,
) => <String, dynamic>{
  'total': instance.total,
  'valid': instance.valid,
  'skip': instance.skip,
  'invalid': instance.invalid,
  'enrollable': instance.enrollable,
  'provisioning': instance.provisioning,
};

_ImportCredential _$ImportCredentialFromJson(Map<String, dynamic> json) =>
    _ImportCredential(
      rowNumber: (json['rowNumber'] as num?)?.toInt() ?? 0,
      studentId: json['studentId'] as String? ?? '',
      tempPassword: json['tempPassword'] as String? ?? '',
    );

Map<String, dynamic> _$ImportCredentialToJson(_ImportCredential instance) =>
    <String, dynamic>{
      'rowNumber': instance.rowNumber,
      'studentId': instance.studentId,
      'tempPassword': instance.tempPassword,
    };

_StudentImportResult _$StudentImportResultFromJson(Map<String, dynamic> json) =>
    _StudentImportResult(
      mode: const ImportModeConverter().fromJson(json['mode'] as String),
      conflictMode: const ImportConflictModeConverter().fromJson(
        json['conflictMode'] as String,
      ),
      rowChecksum: json['rowChecksum'] as String? ?? '',
      summary: StudentImportSummary.fromJson(
        json['summary'] as Map<String, dynamic>,
      ),
      issues:
          (json['issues'] as List<dynamic>?)
              ?.map((e) => ImportIssue.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ImportIssue>[],
      hasMoreIssues: json['hasMoreIssues'] as bool? ?? false,
      credentials: (json['credentials'] as List<dynamic>?)
          ?.map((e) => ImportCredential.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$StudentImportResultToJson(
  _StudentImportResult instance,
) => <String, dynamic>{
  'mode': const ImportModeConverter().toJson(instance.mode),
  'conflictMode': const ImportConflictModeConverter().toJson(
    instance.conflictMode,
  ),
  'rowChecksum': instance.rowChecksum,
  'summary': instance.summary.toJson(),
  'issues': instance.issues.map((e) => e.toJson()).toList(),
  'hasMoreIssues': instance.hasMoreIssues,
  'credentials': instance.credentials?.map((e) => e.toJson()).toList(),
};

_EnrollImportResult _$EnrollImportResultFromJson(Map<String, dynamic> json) =>
    _EnrollImportResult(
      mode: const ImportModeConverter().fromJson(json['mode'] as String),
      rowChecksum: json['rowChecksum'] as String? ?? '',
      summary: EnrollImportSummary.fromJson(
        json['summary'] as Map<String, dynamic>,
      ),
      issues:
          (json['issues'] as List<dynamic>?)
              ?.map((e) => ImportIssue.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ImportIssue>[],
      hasMoreIssues: json['hasMoreIssues'] as bool? ?? false,
    );

Map<String, dynamic> _$EnrollImportResultToJson(_EnrollImportResult instance) =>
    <String, dynamic>{
      'mode': const ImportModeConverter().toJson(instance.mode),
      'rowChecksum': instance.rowChecksum,
      'summary': instance.summary.toJson(),
      'issues': instance.issues.map((e) => e.toJson()).toList(),
      'hasMoreIssues': instance.hasMoreIssues,
    };

_ImportChunkResult _$ImportChunkResultFromJson(Map<String, dynamic> json) =>
    _ImportChunkResult(
      chunkIndex: (json['chunkIndex'] as num?)?.toInt() ?? 0,
      created: (json['created'] as num?)?.toInt() ?? 0,
      updated: (json['updated'] as num?)?.toInt(),
      skipped: (json['skipped'] as num?)?.toInt() ?? 0,
      failed: (json['failed'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$ImportChunkResultToJson(_ImportChunkResult instance) =>
    <String, dynamic>{
      'chunkIndex': instance.chunkIndex,
      'created': instance.created,
      'updated': instance.updated,
      'skipped': instance.skipped,
      'failed': instance.failed,
    };

_StudentImportRequest _$StudentImportRequestFromJson(
  Map<String, dynamic> json,
) => _StudentImportRequest(
  mode: const ImportModeConverter().fromJson(json['mode'] as String),
  conflictMode: const ImportConflictModeConverter().fromJson(
    json['conflictMode'] as String,
  ),
  rows:
      (json['rows'] as List<dynamic>?)
          ?.map((e) => StudentImportRow.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <StudentImportRow>[],
  idempotencyKey: json['idempotencyKey'] as String?,
  rowChecksum: json['rowChecksum'] as String?,
);

Map<String, dynamic> _$StudentImportRequestToJson(
  _StudentImportRequest instance,
) => <String, dynamic>{
  'mode': const ImportModeConverter().toJson(instance.mode),
  'conflictMode': const ImportConflictModeConverter().toJson(
    instance.conflictMode,
  ),
  'rows': instance.rows.map((e) => e.toJson()).toList(),
  'idempotencyKey': instance.idempotencyKey,
  'rowChecksum': instance.rowChecksum,
};

_EnrollImportRequest _$EnrollImportRequestFromJson(Map<String, dynamic> json) =>
    _EnrollImportRequest(
      mode: const ImportModeConverter().fromJson(json['mode'] as String),
      rows:
          (json['rows'] as List<dynamic>?)
              ?.map((e) => EnrollImportRow.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <EnrollImportRow>[],
      idempotencyKey: json['idempotencyKey'] as String?,
      rowChecksum: json['rowChecksum'] as String?,
    );

Map<String, dynamic> _$EnrollImportRequestToJson(
  _EnrollImportRequest instance,
) => <String, dynamic>{
  'mode': const ImportModeConverter().toJson(instance.mode),
  'rows': instance.rows.map((e) => e.toJson()).toList(),
  'idempotencyKey': instance.idempotencyKey,
  'rowChecksum': instance.rowChecksum,
};

_ImportJobProgress _$ImportJobProgressFromJson(Map<String, dynamic> json) =>
    _ImportJobProgress(
      chunksDone: (json['chunksDone'] as num?)?.toInt() ?? 0,
      chunksTotal: (json['chunksTotal'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$ImportJobProgressToJson(_ImportJobProgress instance) =>
    <String, dynamic>{
      'chunksDone': instance.chunksDone,
      'chunksTotal': instance.chunksTotal,
    };

_ImportJobStatus _$ImportJobStatusFromJson(
  Map<String, dynamic> json,
) => _ImportJobStatus(
  id: json['id'] as String,
  state: const ImportJobStateConverter().fromJson(json['state'] as String),
  progress: json['progress'] == null
      ? null
      : ImportJobProgress.fromJson(json['progress'] as Map<String, dynamic>),
  result: json['result'] == null
      ? null
      : StudentImportResult.fromJson(json['result'] as Map<String, dynamic>),
  error: json['error'] as String?,
);

Map<String, dynamic> _$ImportJobStatusToJson(_ImportJobStatus instance) =>
    <String, dynamic>{
      'id': instance.id,
      'state': const ImportJobStateConverter().toJson(instance.state),
      'progress': instance.progress?.toJson(),
      'result': instance.result?.toJson(),
      'error': instance.error,
    };

_ImportBatchSummary _$ImportBatchSummaryFromJson(Map<String, dynamic> json) =>
    _ImportBatchSummary(
      id: json['id'] as String,
      kind: const ImportBatchKindConverter().fromJson(json['kind'] as String),
      actorId: json['actorId'] as String? ?? '',
      department: json['department'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
      total: (json['total'] as num?)?.toInt() ?? 0,
      created: (json['created'] as num?)?.toInt() ?? 0,
      updated: (json['updated'] as num?)?.toInt() ?? 0,
      skipped: (json['skipped'] as num?)?.toInt() ?? 0,
      failed: (json['failed'] as num?)?.toInt() ?? 0,
      rowChecksum: json['rowChecksum'] as String? ?? '',
    );

Map<String, dynamic> _$ImportBatchSummaryToJson(_ImportBatchSummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'kind': const ImportBatchKindConverter().toJson(instance.kind),
      'actorId': instance.actorId,
      'department': instance.department,
      'createdAt': instance.createdAt,
      'total': instance.total,
      'created': instance.created,
      'updated': instance.updated,
      'skipped': instance.skipped,
      'failed': instance.failed,
      'rowChecksum': instance.rowChecksum,
    };
