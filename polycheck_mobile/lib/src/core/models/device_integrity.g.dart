// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'device_integrity.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_DeviceIntegrityErrorPayload _$DeviceIntegrityErrorPayloadFromJson(
  Map<String, dynamic> json,
) => _DeviceIntegrityErrorPayload(
  code: const DeviceIntegrityErrorCodeConverter().fromJson(
    json['code'] as String,
  ),
  message: json['message'] as String?,
  remainingMinutes: (json['remainingMinutes'] as num?)?.toInt(),
  remainingSeconds: (json['remainingSeconds'] as num?)?.toInt(),
  activeDeviceKind: _$JsonConverterFromJson<String, ActiveDeviceKind>(
    json['activeDeviceKind'],
    const ActiveDeviceKindConverter().fromJson,
  ),
  activeSessionLastActiveAt: json['activeSessionLastActiveAt'] as String?,
);

Map<String, dynamic> _$DeviceIntegrityErrorPayloadToJson(
  _DeviceIntegrityErrorPayload instance,
) => <String, dynamic>{
  'code': const DeviceIntegrityErrorCodeConverter().toJson(instance.code),
  'message': instance.message,
  'remainingMinutes': instance.remainingMinutes,
  'remainingSeconds': instance.remainingSeconds,
  'activeDeviceKind': _$JsonConverterToJson<String, ActiveDeviceKind>(
    instance.activeDeviceKind,
    const ActiveDeviceKindConverter().toJson,
  ),
  'activeSessionLastActiveAt': instance.activeSessionLastActiveAt,
};

Value? _$JsonConverterFromJson<Json, Value>(
  Object? json,
  Value? Function(Json json) fromJson,
) => json == null ? null : fromJson(json as Json);

Json? _$JsonConverterToJson<Json, Value>(
  Value? value,
  Json? Function(Value value) toJson,
) => value == null ? null : toJson(value);
