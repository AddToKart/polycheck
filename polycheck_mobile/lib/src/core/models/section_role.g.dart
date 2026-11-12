// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'section_role.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SectionRole _$SectionRoleFromJson(Map<String, dynamic> json) => _SectionRole(
  id: json['id'] as String,
  sectionId: json['sectionId'] as String,
  studentId: json['studentId'] as String,
  studentName: json['studentName'] as String? ?? '',
  role: const SectionRoleTypeConverter().fromJson(json['role'] as String),
  grantedBy: json['grantedBy'] as String? ?? '',
  grantedAt: json['grantedAt'] as String? ?? '',
);

Map<String, dynamic> _$SectionRoleToJson(_SectionRole instance) =>
    <String, dynamic>{
      'id': instance.id,
      'sectionId': instance.sectionId,
      'studentId': instance.studentId,
      'studentName': instance.studentName,
      'role': const SectionRoleTypeConverter().toJson(instance.role),
      'grantedBy': instance.grantedBy,
      'grantedAt': instance.grantedAt,
    };

_SessionPermission _$SessionPermissionFromJson(Map<String, dynamic> json) =>
    _SessionPermission(
      id: json['id'] as String,
      sectionId: json['sectionId'] as String,
      studentId: json['studentId'] as String,
      grantedBy: json['grantedBy'] as String? ?? '',
      grantedAt: json['grantedAt'] as String? ?? '',
      expiresAt: json['expiresAt'] as String,
      isActive: json['isActive'] as bool? ?? false,
    );

Map<String, dynamic> _$SessionPermissionToJson(_SessionPermission instance) =>
    <String, dynamic>{
      'id': instance.id,
      'sectionId': instance.sectionId,
      'studentId': instance.studentId,
      'grantedBy': instance.grantedBy,
      'grantedAt': instance.grantedAt,
      'expiresAt': instance.expiresAt,
      'isActive': instance.isActive,
    };

_ProofOfClass _$ProofOfClassFromJson(Map<String, dynamic> json) =>
    _ProofOfClass(
      id: json['id'] as String,
      sectionId: json['sectionId'] as String,
      sessionId: json['sessionId'] as String,
      uploadedBy: json['uploadedBy'] as String,
      uploadedByStudentName: json['uploadedByStudentName'] as String? ?? '',
      photoData: json['photoData'] as String? ?? '',
      uploadedAt: json['uploadedAt'] as String? ?? '',
      description: json['description'] as String?,
    );

Map<String, dynamic> _$ProofOfClassToJson(_ProofOfClass instance) =>
    <String, dynamic>{
      'id': instance.id,
      'sectionId': instance.sectionId,
      'sessionId': instance.sessionId,
      'uploadedBy': instance.uploadedBy,
      'uploadedByStudentName': instance.uploadedByStudentName,
      'photoData': instance.photoData,
      'uploadedAt': instance.uploadedAt,
      'description': instance.description,
    };
