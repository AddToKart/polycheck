// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'maintenance.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_MaintenanceBlockBody _$MaintenanceBlockBodyFromJson(
  Map<String, dynamic> json,
) => _MaintenanceBlockBody(
  code: json['code'] as String? ?? 'system_maintenance',
  message: json['message'] as String? ?? '',
  estimatedEnd: json['estimatedEnd'] as String?,
);

Map<String, dynamic> _$MaintenanceBlockBodyToJson(
  _MaintenanceBlockBody instance,
) => <String, dynamic>{
  'code': instance.code,
  'message': instance.message,
  'estimatedEnd': instance.estimatedEnd,
};

_MaintenanceStatus _$MaintenanceStatusFromJson(Map<String, dynamic> json) =>
    _MaintenanceStatus(
      enabled: json['enabled'] as bool,
      message: json['message'] as String?,
      estimatedEnd: json['estimatedEnd'] as String?,
    );

Map<String, dynamic> _$MaintenanceStatusToJson(_MaintenanceStatus instance) =>
    <String, dynamic>{
      'enabled': instance.enabled,
      'message': instance.message,
      'estimatedEnd': instance.estimatedEnd,
    };
