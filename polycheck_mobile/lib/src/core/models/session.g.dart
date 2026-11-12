// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_GeofenceConfig _$GeofenceConfigFromJson(Map<String, dynamic> json) =>
    _GeofenceConfig(
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      radiusMeters: (json['radiusMeters'] as num).toDouble(),
    );

Map<String, dynamic> _$GeofenceConfigToJson(_GeofenceConfig instance) =>
    <String, dynamic>{
      'latitude': instance.latitude,
      'longitude': instance.longitude,
      'radiusMeters': instance.radiusMeters,
    };

_Session _$SessionFromJson(Map<String, dynamic> json) => _Session(
  id: json['id'] as String,
  sectionId: json['sectionId'] as String,
  subjectName: json['subjectName'] as String? ?? '',
  date: json['date'] as String,
  startTime: json['startTime'] as String? ?? '',
  endTime: json['endTime'] as String? ?? '',
  room: json['room'] as String?,
  mode: json['mode'] == null
      ? SessionMode.inPerson
      : const SessionModeConverter().fromJson(json['mode'] as String),
  qrValidityMinutes: (json['qrValidityMinutes'] as num?)?.toInt() ?? 15,
  gracePeriodMinutes: (json['gracePeriodMinutes'] as num?)?.toInt() ?? 15,
  geofence: json['geofence'] == null
      ? null
      : GeofenceConfig.fromJson(json['geofence'] as Map<String, dynamic>),
  isActive: json['isActive'] as bool? ?? false,
  endedAt: json['endedAt'] as String?,
  qrToken: json['qrToken'] as String?,
  qrTokenExpiresAt: json['qrTokenExpiresAt'] as String?,
  qrGeneratedAt: json['qrGeneratedAt'] as String?,
  startQrValiditySeconds: (json['startQrValiditySeconds'] as num?)?.toInt(),
  startGraceMinutes: (json['startGraceMinutes'] as num?)?.toInt(),
  endQrValiditySeconds: (json['endQrValiditySeconds'] as num?)?.toInt(),
  endGraceMinutes: (json['endGraceMinutes'] as num?)?.toInt(),
  startQrToken: json['startQrToken'] as String?,
  startTokenExpiresAt: json['startTokenExpiresAt'] as String?,
  startQrGeneratedAt: json['startQrGeneratedAt'] as String?,
  endQrToken: json['endQrToken'] as String?,
  endTokenExpiresAt: json['endTokenExpiresAt'] as String?,
  endQrGeneratedAt: json['endQrGeneratedAt'] as String?,
  pinRequired: json['pinRequired'] as bool? ?? false,
  autoEndAt: json['autoEndAt'] as String?,
  teacherId: json['teacherId'] as String,
  teacherPublicKey: json['teacherPublicKey'] as String?,
  createdAt: json['createdAt'] as String? ?? '',
  isRescheduled: json['isRescheduled'] as bool? ?? false,
  rescheduledFromDate: json['rescheduledFromDate'] as String?,
  originalScheduleTime: json['originalScheduleTime'] as String?,
  originalRoom: json['originalRoom'] as String?,
);

Map<String, dynamic> _$SessionToJson(_Session instance) => <String, dynamic>{
  'id': instance.id,
  'sectionId': instance.sectionId,
  'subjectName': instance.subjectName,
  'date': instance.date,
  'startTime': instance.startTime,
  'endTime': instance.endTime,
  'room': instance.room,
  'mode': const SessionModeConverter().toJson(instance.mode),
  'qrValidityMinutes': instance.qrValidityMinutes,
  'gracePeriodMinutes': instance.gracePeriodMinutes,
  'geofence': instance.geofence?.toJson(),
  'isActive': instance.isActive,
  'endedAt': instance.endedAt,
  'qrToken': instance.qrToken,
  'qrTokenExpiresAt': instance.qrTokenExpiresAt,
  'qrGeneratedAt': instance.qrGeneratedAt,
  'startQrValiditySeconds': instance.startQrValiditySeconds,
  'startGraceMinutes': instance.startGraceMinutes,
  'endQrValiditySeconds': instance.endQrValiditySeconds,
  'endGraceMinutes': instance.endGraceMinutes,
  'startQrToken': instance.startQrToken,
  'startTokenExpiresAt': instance.startTokenExpiresAt,
  'startQrGeneratedAt': instance.startQrGeneratedAt,
  'endQrToken': instance.endQrToken,
  'endTokenExpiresAt': instance.endTokenExpiresAt,
  'endQrGeneratedAt': instance.endQrGeneratedAt,
  'pinRequired': instance.pinRequired,
  'autoEndAt': instance.autoEndAt,
  'teacherId': instance.teacherId,
  'teacherPublicKey': instance.teacherPublicKey,
  'createdAt': instance.createdAt,
  'isRescheduled': instance.isRescheduled,
  'rescheduledFromDate': instance.rescheduledFromDate,
  'originalScheduleTime': instance.originalScheduleTime,
  'originalRoom': instance.originalRoom,
};

_QRTokenPayload _$QRTokenPayloadFromJson(Map<String, dynamic> json) =>
    _QRTokenPayload(
      version: (json['version'] as num).toInt(),
      sessionId: json['sessionId'] as String,
      sectionId: json['sectionId'] as String,
      issuedAt: (json['issuedAt'] as num).toInt(),
      validityMinutes: (json['validityMinutes'] as num).toInt(),
      gracePeriodMinutes: (json['gracePeriodMinutes'] as num).toInt(),
      teacherId: json['teacherId'] as String,
      teacherName: json['teacherName'] as String,
      mode: json['mode'] == null
          ? SessionMode.inPerson
          : const SessionModeConverter().fromJson(json['mode'] as String),
      checkpoint: _$JsonConverterFromJson<String, CheckpointType>(
        json['checkpoint'],
        const CheckpointTypeConverter().fromJson,
      ),
      pinRequired: json['pinRequired'] as bool? ?? false,
      pinHash: json['pinHash'] as String?,
      validitySeconds: (json['validitySeconds'] as num?)?.toInt(),
    );

Map<String, dynamic> _$QRTokenPayloadToJson(_QRTokenPayload instance) =>
    <String, dynamic>{
      'version': instance.version,
      'sessionId': instance.sessionId,
      'sectionId': instance.sectionId,
      'issuedAt': instance.issuedAt,
      'validityMinutes': instance.validityMinutes,
      'gracePeriodMinutes': instance.gracePeriodMinutes,
      'teacherId': instance.teacherId,
      'teacherName': instance.teacherName,
      'mode': const SessionModeConverter().toJson(instance.mode),
      'checkpoint': _$JsonConverterToJson<String, CheckpointType>(
        instance.checkpoint,
        const CheckpointTypeConverter().toJson,
      ),
      'pinRequired': instance.pinRequired,
      'pinHash': instance.pinHash,
      'validitySeconds': instance.validitySeconds,
    };

Value? _$JsonConverterFromJson<Json, Value>(
  Object? json,
  Value? Function(Json json) fromJson,
) => json == null ? null : fromJson(json as Json);

Json? _$JsonConverterToJson<Json, Value>(
  Value? value,
  Json? Function(Value value) toJson,
) => value == null ? null : toJson(value);

_SessionFinaleSummary _$SessionFinaleSummaryFromJson(
  Map<String, dynamic> json,
) => _SessionFinaleSummary(
  sessionId: json['sessionId'] as String,
  endedAt: json['endedAt'] as String,
  counts: json['counts'] == null
      ? const <FinaleCountStatus, int>{}
      : finaleCountsFromJson(json['counts'] as Map<String, dynamic>),
  capacity: (json['capacity'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$SessionFinaleSummaryToJson(
  _SessionFinaleSummary instance,
) => <String, dynamic>{
  'sessionId': instance.sessionId,
  'endedAt': instance.endedAt,
  'counts': finaleCountsToJson(instance.counts),
  'capacity': instance.capacity,
};
