// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_DelegatedTeacherPermissions _$DelegatedTeacherPermissionsFromJson(
  Map<String, dynamic> json,
) => _DelegatedTeacherPermissions(
  canResetStudentPasswords: json['canResetStudentPasswords'] as bool,
  canEmergencyUnbindDevices: json['canEmergencyUnbindDevices'] as bool,
);

Map<String, dynamic> _$DelegatedTeacherPermissionsToJson(
  _DelegatedTeacherPermissions instance,
) => <String, dynamic>{
  'canResetStudentPasswords': instance.canResetStudentPasswords,
  'canEmergencyUnbindDevices': instance.canEmergencyUnbindDevices,
};

_User _$UserFromJson(Map<String, dynamic> json) => _User(
  id: json['id'] as String,
  studentId: json['studentId'] as String?,
  fullName: json['fullName'] as String,
  email: json['email'] as String?,
  role: json['role'] == null
      ? UserRole.student
      : const UserRoleConverter().fromJson(json['role'] as String),
  program: json['program'] as String?,
  yearLevel: (json['yearLevel'] as num?)?.toInt(),
  department: json['department'] as String?,
  photoUrl: json['photoUrl'] as String?,
  isActive: json['isActive'] as bool? ?? true,
  privacyConsentVersion: json['privacyConsentVersion'] as String?,
  privacyConsentedAt: json['privacyConsentedAt'] as String?,
  mustChangePassword: json['mustChangePassword'] as bool? ?? false,
  boundDeviceId: json['boundDeviceId'] as String?,
  deviceBoundAt: json['deviceBoundAt'] as String?,
  deviceCooldownUntil: json['deviceCooldownUntil'] as String?,
  cooldownDeviceId: json['cooldownDeviceId'] as String?,
  canResetStudentPasswords: json['canResetStudentPasswords'] as bool?,
  canEmergencyUnbindDevices: json['canEmergencyUnbindDevices'] as bool?,
  delegatedPermissions: json['delegatedPermissions'] == null
      ? null
      : DelegatedTeacherPermissions.fromJson(
          json['delegatedPermissions'] as Map<String, dynamic>,
        ),
  isItCoordinator: json['isItCoordinator'] as bool? ?? false,
  isDepartmentHead: json['isDepartmentHead'] as bool? ?? false,
  isUserRegistrar: json['isUserRegistrar'] as bool? ?? false,
  contactEmail: json['contactEmail'] as String?,
  contactPhone: json['contactPhone'] as String?,
  enrolledSectionIds:
      (json['enrolledSectionIds'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList() ??
      const <String>[],
  scope: json['scope'] as String?,
  createdAt: json['createdAt'] as String? ?? '',
  updatedAt: json['updatedAt'] as String? ?? '',
);

Map<String, dynamic> _$UserToJson(_User instance) => <String, dynamic>{
  'id': instance.id,
  'studentId': instance.studentId,
  'fullName': instance.fullName,
  'email': instance.email,
  'role': const UserRoleConverter().toJson(instance.role),
  'program': instance.program,
  'yearLevel': instance.yearLevel,
  'department': instance.department,
  'photoUrl': instance.photoUrl,
  'isActive': instance.isActive,
  'privacyConsentVersion': instance.privacyConsentVersion,
  'privacyConsentedAt': instance.privacyConsentedAt,
  'mustChangePassword': instance.mustChangePassword,
  'boundDeviceId': instance.boundDeviceId,
  'deviceBoundAt': instance.deviceBoundAt,
  'deviceCooldownUntil': instance.deviceCooldownUntil,
  'cooldownDeviceId': instance.cooldownDeviceId,
  'canResetStudentPasswords': instance.canResetStudentPasswords,
  'canEmergencyUnbindDevices': instance.canEmergencyUnbindDevices,
  'delegatedPermissions': instance.delegatedPermissions?.toJson(),
  'isItCoordinator': instance.isItCoordinator,
  'isDepartmentHead': instance.isDepartmentHead,
  'isUserRegistrar': instance.isUserRegistrar,
  'contactEmail': instance.contactEmail,
  'contactPhone': instance.contactPhone,
  'enrolledSectionIds': instance.enrolledSectionIds,
  'scope': instance.scope,
  'createdAt': instance.createdAt,
  'updatedAt': instance.updatedAt,
};
