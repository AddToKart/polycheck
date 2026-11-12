// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'at_risk.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_StudentAtRisk _$StudentAtRiskFromJson(Map<String, dynamic> json) =>
    _StudentAtRisk(
      studentId: json['studentId'] as String,
      studentName: json['studentName'] as String? ?? '',
      studentNumber: json['studentNumber'] as String?,
      sectionId: json['sectionId'] as String,
      sectionName: json['sectionName'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? '',
      professorName: json['professorName'] as String? ?? '',
      thresholdPercent: (json['thresholdPercent'] as num?)?.toInt() ?? 75,
      attendanceRate: (json['attendanceRate'] as num?)?.toDouble(),
      status: const AttendanceStandingStatusConverter().fromJson(
        json['status'] as String,
      ),
      absencesBeforeBelowThreshold:
          (json['absencesBeforeBelowThreshold'] as num?)?.toInt(),
      lastAbsenceDate: json['lastAbsenceDate'] as String?,
    );

Map<String, dynamic> _$StudentAtRiskToJson(
  _StudentAtRisk instance,
) => <String, dynamic>{
  'studentId': instance.studentId,
  'studentName': instance.studentName,
  'studentNumber': instance.studentNumber,
  'sectionId': instance.sectionId,
  'sectionName': instance.sectionName,
  'subjectName': instance.subjectName,
  'professorName': instance.professorName,
  'thresholdPercent': instance.thresholdPercent,
  'attendanceRate': instance.attendanceRate,
  'status': const AttendanceStandingStatusConverter().toJson(instance.status),
  'absencesBeforeBelowThreshold': instance.absencesBeforeBelowThreshold,
  'lastAbsenceDate': instance.lastAbsenceDate,
};

_AtRiskReferral _$AtRiskReferralFromJson(Map<String, dynamic> json) =>
    _AtRiskReferral(
      id: json['id'] as String,
      studentId: json['studentId'] as String,
      studentName: json['studentName'] as String? ?? '',
      studentNumber: json['studentNumber'] as String?,
      sectionId: json['sectionId'] as String,
      sectionName: json['sectionName'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? '',
      professorName: json['professorName'] as String? ?? '',
      generatedById: json['generatedById'] as String? ?? '',
      generatedByName: json['generatedByName'] as String? ?? '',
      status: const ReferralStatusConverter().fromJson(
        json['status'] as String,
      ),
      note: json['note'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );

Map<String, dynamic> _$AtRiskReferralToJson(_AtRiskReferral instance) =>
    <String, dynamic>{
      'id': instance.id,
      'studentId': instance.studentId,
      'studentName': instance.studentName,
      'studentNumber': instance.studentNumber,
      'sectionId': instance.sectionId,
      'sectionName': instance.sectionName,
      'subjectName': instance.subjectName,
      'professorName': instance.professorName,
      'generatedById': instance.generatedById,
      'generatedByName': instance.generatedByName,
      'status': const ReferralStatusConverter().toJson(instance.status),
      'note': instance.note,
      'createdAt': instance.createdAt,
      'updatedAt': instance.updatedAt,
    };

_AtRiskReferralFilters _$AtRiskReferralFiltersFromJson(
  Map<String, dynamic> json,
) => _AtRiskReferralFilters(
  status: _$JsonConverterFromJson<String, ReferralStatus>(
    json['status'],
    const ReferralStatusConverter().fromJson,
  ),
  sectionId: json['sectionId'] as String?,
);

Map<String, dynamic> _$AtRiskReferralFiltersToJson(
  _AtRiskReferralFilters instance,
) => <String, dynamic>{
  'status': _$JsonConverterToJson<String, ReferralStatus>(
    instance.status,
    const ReferralStatusConverter().toJson,
  ),
  'sectionId': instance.sectionId,
};

Value? _$JsonConverterFromJson<Json, Value>(
  Object? json,
  Value? Function(Json json) fromJson,
) => json == null ? null : fromJson(json as Json);

Json? _$JsonConverterToJson<Json, Value>(
  Value? value,
  Json? Function(Value value) toJson,
) => value == null ? null : toJson(value);
