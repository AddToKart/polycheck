// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'attendance.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AttendanceCoordinates _$AttendanceCoordinatesFromJson(
  Map<String, dynamic> json,
) => _AttendanceCoordinates(
  latitude: (json['latitude'] as num?)?.toDouble(),
  longitude: (json['longitude'] as num?)?.toDouble(),
);

Map<String, dynamic> _$AttendanceCoordinatesToJson(
  _AttendanceCoordinates instance,
) => <String, dynamic>{
  'latitude': instance.latitude,
  'longitude': instance.longitude,
};

_AttendanceRecord _$AttendanceRecordFromJson(Map<String, dynamic> json) =>
    _AttendanceRecord(
      id: json['id'] as String,
      sessionId: json['sessionId'] as String,
      sectionId: json['sectionId'] as String,
      studentId: json['studentId'] as String,
      studentName: json['studentName'] as String? ?? '',
      studentProgram: json['studentProgram'] as String?,
      timestamp: json['timestamp'] as String? ?? '',
      status: const AttendanceStatusConverter().fromJson(
        json['status'] as String,
      ),
      coordinates: json['coordinates'] == null
          ? const AttendanceCoordinates(latitude: null, longitude: null)
          : AttendanceCoordinates.fromJson(
              json['coordinates'] as Map<String, dynamic>,
            ),
      mode: _$JsonConverterFromJson<String, SessionMode>(
        json['mode'],
        const SessionModeConverter().fromJson,
      ),
      checkInTime: json['checkInTime'] as String?,
      checkInStatus: _$JsonConverterFromJson<String, AttendanceStatus>(
        json['checkInStatus'],
        const AttendanceStatusConverter().fromJson,
      ),
      checkOutTime: json['checkOutTime'] as String?,
      checkOutStatus: _$JsonConverterFromJson<String, AttendanceStatus>(
        json['checkOutStatus'],
        const AttendanceStatusConverter().fromJson,
      ),
      deviceId: json['deviceId'] as String?,
      tokenSnapshot: json['tokenSnapshot'] as String?,
      isSynced: json['isSynced'] as bool? ?? false,
      syncedAt: json['syncedAt'] as String?,
      disputeReason: _$JsonConverterFromJson<String, DisputeReason>(
        json['disputeReason'],
        const DisputeReasonConverter().fromJson,
      ),
      disputeResolved: json['disputeResolved'] as bool? ?? false,
      disputeDescription: json['disputeDescription'] as String?,
      manuallySet: json['manuallySet'] as bool? ?? false,
      notes: json['notes'] as String?,
      excuseStatus: _$JsonConverterFromJson<String, ExcuseStatus>(
        json['excuseStatus'],
        const ExcuseStatusConverter().fromJson,
      ),
      excuseReason: $enumDecodeNullable(
        _$ExcuseReasonEnumMap,
        json['excuseReason'],
      ),
      excuseDescription: json['excuseDescription'] as String?,
      excuseEvidencePath: json['excuseEvidencePath'] as String?,
      excuseReviewedBy: json['excuseReviewedBy'] as String?,
      excuseReviewedAt: json['excuseReviewedAt'] as String?,
      excuseReviewNote: json['excuseReviewNote'] as String?,
    );

Map<String, dynamic> _$AttendanceRecordToJson(_AttendanceRecord instance) =>
    <String, dynamic>{
      'id': instance.id,
      'sessionId': instance.sessionId,
      'sectionId': instance.sectionId,
      'studentId': instance.studentId,
      'studentName': instance.studentName,
      'studentProgram': instance.studentProgram,
      'timestamp': instance.timestamp,
      'status': const AttendanceStatusConverter().toJson(instance.status),
      'coordinates': instance.coordinates.toJson(),
      'mode': _$JsonConverterToJson<String, SessionMode>(
        instance.mode,
        const SessionModeConverter().toJson,
      ),
      'checkInTime': instance.checkInTime,
      'checkInStatus': _$JsonConverterToJson<String, AttendanceStatus>(
        instance.checkInStatus,
        const AttendanceStatusConverter().toJson,
      ),
      'checkOutTime': instance.checkOutTime,
      'checkOutStatus': _$JsonConverterToJson<String, AttendanceStatus>(
        instance.checkOutStatus,
        const AttendanceStatusConverter().toJson,
      ),
      'deviceId': instance.deviceId,
      'tokenSnapshot': instance.tokenSnapshot,
      'isSynced': instance.isSynced,
      'syncedAt': instance.syncedAt,
      'disputeReason': _$JsonConverterToJson<String, DisputeReason>(
        instance.disputeReason,
        const DisputeReasonConverter().toJson,
      ),
      'disputeResolved': instance.disputeResolved,
      'disputeDescription': instance.disputeDescription,
      'manuallySet': instance.manuallySet,
      'notes': instance.notes,
      'excuseStatus': _$JsonConverterToJson<String, ExcuseStatus>(
        instance.excuseStatus,
        const ExcuseStatusConverter().toJson,
      ),
      'excuseReason': _$ExcuseReasonEnumMap[instance.excuseReason],
      'excuseDescription': instance.excuseDescription,
      'excuseEvidencePath': instance.excuseEvidencePath,
      'excuseReviewedBy': instance.excuseReviewedBy,
      'excuseReviewedAt': instance.excuseReviewedAt,
      'excuseReviewNote': instance.excuseReviewNote,
    };

Value? _$JsonConverterFromJson<Json, Value>(
  Object? json,
  Value? Function(Json json) fromJson,
) => json == null ? null : fromJson(json as Json);

const _$ExcuseReasonEnumMap = {
  ExcuseReason.medical: 'medical',
  ExcuseReason.familyEmergency: 'familyEmergency',
  ExcuseReason.schoolActivity: 'schoolActivity',
  ExcuseReason.transportation: 'transportation',
  ExcuseReason.bereavement: 'bereavement',
  ExcuseReason.other: 'other',
};

Json? _$JsonConverterToJson<Json, Value>(
  Value? value,
  Json? Function(Value value) toJson,
) => value == null ? null : toJson(value);

_AttendanceSummary _$AttendanceSummaryFromJson(Map<String, dynamic> json) =>
    _AttendanceSummary(
      sectionId: json['sectionId'] as String,
      subjectName: json['subjectName'] as String? ?? '',
      totalSessions: (json['totalSessions'] as num?)?.toInt() ?? 0,
      present: (json['present'] as num?)?.toInt() ?? 0,
      late: (json['late'] as num?)?.toInt() ?? 0,
      absent: (json['absent'] as num?)?.toInt() ?? 0,
      disputed: (json['disputed'] as num?)?.toInt() ?? 0,
      excused: (json['excused'] as num?)?.toInt() ?? 0,
      incomplete: (json['incomplete'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$AttendanceSummaryToJson(_AttendanceSummary instance) =>
    <String, dynamic>{
      'sectionId': instance.sectionId,
      'subjectName': instance.subjectName,
      'totalSessions': instance.totalSessions,
      'present': instance.present,
      'late': instance.late,
      'absent': instance.absent,
      'disputed': instance.disputed,
      'excused': instance.excused,
      'incomplete': instance.incomplete,
    };

_AttendanceAnomalyEvent _$AttendanceAnomalyEventFromJson(
  Map<String, dynamic> json,
) => _AttendanceAnomalyEvent(
  sessionId: json['sessionId'] as String,
  studentId: json['studentId'] as String,
  studentName: json['studentName'] as String?,
  studentNumber: json['studentNumber'] as String?,
  latitude: (json['latitude'] as num?)?.toDouble(),
  longitude: (json['longitude'] as num?)?.toDouble(),
  distanceMeters: (json['distanceMeters'] as num?)?.toDouble(),
  geofenceRadiusMeters: (json['geofenceRadiusMeters'] as num?)?.toDouble(),
  reason: json['reason'] as String,
  timestamp: json['timestamp'] as String,
);

Map<String, dynamic> _$AttendanceAnomalyEventToJson(
  _AttendanceAnomalyEvent instance,
) => <String, dynamic>{
  'sessionId': instance.sessionId,
  'studentId': instance.studentId,
  'studentName': instance.studentName,
  'studentNumber': instance.studentNumber,
  'latitude': instance.latitude,
  'longitude': instance.longitude,
  'distanceMeters': instance.distanceMeters,
  'geofenceRadiusMeters': instance.geofenceRadiusMeters,
  'reason': instance.reason,
  'timestamp': instance.timestamp,
};

_ScanAttemptView _$ScanAttemptViewFromJson(Map<String, dynamic> json) =>
    _ScanAttemptView(
      id: json['id'] as String,
      sessionId: json['sessionId'] as String,
      studentId: json['studentId'] as String,
      studentName: json['studentName'] as String? ?? '',
      studentNumber: json['studentNumber'] as String?,
      timestamp: json['timestamp'] as String,
      clientScannedAt: json['clientScannedAt'] as String?,
      receivedAt: json['receivedAt'] as String,
      coordinates: json['coordinates'] == null
          ? const AttendanceCoordinates(latitude: null, longitude: null)
          : AttendanceCoordinates.fromJson(
              json['coordinates'] as Map<String, dynamic>,
            ),
      accuracyMeters: (json['accuracyMeters'] as num?)?.toDouble(),
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble(),
      geofenceRadiusMeters: (json['geofenceRadiusMeters'] as num?)?.toDouble(),
      outcome: const ScanAttemptOutcomeConverter().fromJson(
        json['outcome'] as String,
      ),
      denialReason: json['denialReason'] as String?,
      mocked: json['mocked'] as bool?,
      pinVerified: json['pinVerified'] as bool?,
      offline: json['offline'] as bool?,
      inputChannel: json['inputChannel'] as String?,
      checkpoint: json['checkpoint'] as String?,
      deviceIdMasked: json['deviceIdMasked'] as String?,
    );

Map<String, dynamic> _$ScanAttemptViewToJson(_ScanAttemptView instance) =>
    <String, dynamic>{
      'id': instance.id,
      'sessionId': instance.sessionId,
      'studentId': instance.studentId,
      'studentName': instance.studentName,
      'studentNumber': instance.studentNumber,
      'timestamp': instance.timestamp,
      'clientScannedAt': instance.clientScannedAt,
      'receivedAt': instance.receivedAt,
      'coordinates': instance.coordinates.toJson(),
      'accuracyMeters': instance.accuracyMeters,
      'distanceMeters': instance.distanceMeters,
      'geofenceRadiusMeters': instance.geofenceRadiusMeters,
      'outcome': const ScanAttemptOutcomeConverter().toJson(instance.outcome),
      'denialReason': instance.denialReason,
      'mocked': instance.mocked,
      'pinVerified': instance.pinVerified,
      'offline': instance.offline,
      'inputChannel': instance.inputChannel,
      'checkpoint': instance.checkpoint,
      'deviceIdMasked': instance.deviceIdMasked,
    };

_RecordTimelineEventDetail _$RecordTimelineEventDetailFromJson(
  Map<String, dynamic> json,
) => _RecordTimelineEventDetail(
  distanceMeters: (json['distanceMeters'] as num?)?.toDouble(),
  radiusMeters: (json['radiusMeters'] as num?)?.toDouble(),
  insideGeofence: json['insideGeofence'] as bool?,
  mocked: json['mocked'] as bool?,
  pinVerified: json['pinVerified'] as bool?,
  channel: json['channel'] as String?,
  deviceIdMasked: json['deviceIdMasked'] as String?,
  receiptId: json['receiptId'] as String?,
);

Map<String, dynamic> _$RecordTimelineEventDetailToJson(
  _RecordTimelineEventDetail instance,
) => <String, dynamic>{
  'distanceMeters': instance.distanceMeters,
  'radiusMeters': instance.radiusMeters,
  'insideGeofence': instance.insideGeofence,
  'mocked': instance.mocked,
  'pinVerified': instance.pinVerified,
  'channel': instance.channel,
  'deviceIdMasked': instance.deviceIdMasked,
  'receiptId': instance.receiptId,
};

_RecordTimelineEvent _$RecordTimelineEventFromJson(Map<String, dynamic> json) =>
    _RecordTimelineEvent(
      kind: const RecordTimelineEventKindConverter().fromJson(
        json['kind'] as String,
      ),
      at: json['at'] as String,
      label: json['label'] as String,
      source: const RecordTimelineEventSourceConverter().fromJson(
        json['source'] as String,
      ),
      detail: json['detail'] == null
          ? null
          : RecordTimelineEventDetail.fromJson(
              json['detail'] as Map<String, dynamic>,
            ),
    );

Map<String, dynamic> _$RecordTimelineEventToJson(
  _RecordTimelineEvent instance,
) => <String, dynamic>{
  'kind': const RecordTimelineEventKindConverter().toJson(instance.kind),
  'at': instance.at,
  'label': instance.label,
  'source': const RecordTimelineEventSourceConverter().toJson(instance.source),
  'detail': instance.detail?.toJson(),
};

_DisputeRecommendation _$DisputeRecommendationFromJson(
  Map<String, dynamic> json,
) => _DisputeRecommendation(
  verdict: const DisputeRecommendationVerdictConverter().fromJson(
    json['verdict'] as String,
  ),
  rationale: json['rationale'] as String,
);

Map<String, dynamic> _$DisputeRecommendationToJson(
  _DisputeRecommendation instance,
) => <String, dynamic>{
  'verdict': const DisputeRecommendationVerdictConverter().toJson(
    instance.verdict,
  ),
  'rationale': instance.rationale,
};

_RecordTimeline _$RecordTimelineFromJson(Map<String, dynamic> json) =>
    _RecordTimeline(
      recordId: json['recordId'] as String,
      events:
          (json['events'] as List<dynamic>?)
              ?.map(
                (e) => RecordTimelineEvent.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          const <RecordTimelineEvent>[],
      recommendation: DisputeRecommendation.fromJson(
        json['recommendation'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$RecordTimelineToJson(_RecordTimeline instance) =>
    <String, dynamic>{
      'recordId': instance.recordId,
      'events': instance.events.map((e) => e.toJson()).toList(),
      'recommendation': instance.recommendation.toJson(),
    };
