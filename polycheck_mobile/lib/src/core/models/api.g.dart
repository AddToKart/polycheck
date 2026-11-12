// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'api.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_CreateSubjectInput _$CreateSubjectInputFromJson(Map<String, dynamic> json) =>
    _CreateSubjectInput(
      name: json['name'] as String,
      code: json['code'] as String,
      description: json['description'] as String?,
    );

Map<String, dynamic> _$CreateSubjectInputToJson(_CreateSubjectInput instance) =>
    <String, dynamic>{
      'name': instance.name,
      'code': instance.code,
      'description': instance.description,
    };

_CreateTeacherInput _$CreateTeacherInputFromJson(Map<String, dynamic> json) =>
    _CreateTeacherInput(
      fullName: json['fullName'] as String,
      email: json['email'] as String,
      password: json['password'] as String?,
      department: json['department'] as String?,
    );

Map<String, dynamic> _$CreateTeacherInputToJson(_CreateTeacherInput instance) =>
    <String, dynamic>{
      'fullName': instance.fullName,
      'email': instance.email,
      'password': instance.password,
      'department': instance.department,
    };

_CreateStudentInput _$CreateStudentInputFromJson(Map<String, dynamic> json) =>
    _CreateStudentInput(
      fullName: json['fullName'] as String,
      studentId: json['studentId'] as String,
      email: json['email'] as String?,
      password: json['password'] as String?,
      program: json['program'] as String,
      yearLevel: (json['yearLevel'] as num).toInt(),
      department: json['department'] as String,
    );

Map<String, dynamic> _$CreateStudentInputToJson(_CreateStudentInput instance) =>
    <String, dynamic>{
      'fullName': instance.fullName,
      'studentId': instance.studentId,
      'email': instance.email,
      'password': instance.password,
      'program': instance.program,
      'yearLevel': instance.yearLevel,
      'department': instance.department,
    };

_CreateSectionScheduleSlot _$CreateSectionScheduleSlotFromJson(
  Map<String, dynamic> json,
) => _CreateSectionScheduleSlot(
  day: json['day'] as String,
  startTime: json['startTime'] as String,
  endTime: json['endTime'] as String,
  room: json['room'] as String?,
);

Map<String, dynamic> _$CreateSectionScheduleSlotToJson(
  _CreateSectionScheduleSlot instance,
) => <String, dynamic>{
  'day': instance.day,
  'startTime': instance.startTime,
  'endTime': instance.endTime,
  'room': instance.room,
};

_CreateSectionInput _$CreateSectionInputFromJson(Map<String, dynamic> json) =>
    _CreateSectionInput(
      subjectId: json['subjectId'] as String,
      section: json['section'] as String,
      course: json['course'] as String?,
      room: json['room'] as String,
      schedule:
          (json['schedule'] as List<dynamic>?)
              ?.map(
                (e) => CreateSectionScheduleSlot.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList() ??
          const <CreateSectionScheduleSlot>[],
      semester: json['semester'] as String,
    );

Map<String, dynamic> _$CreateSectionInputToJson(_CreateSectionInput instance) =>
    <String, dynamic>{
      'subjectId': instance.subjectId,
      'section': instance.section,
      'course': instance.course,
      'room': instance.room,
      'schedule': instance.schedule.map((e) => e.toJson()).toList(),
      'semester': instance.semester,
    };

_CreateSessionInput _$CreateSessionInputFromJson(Map<String, dynamic> json) =>
    _CreateSessionInput(
      sectionId: json['sectionId'] as String,
      subjectName: json['subjectName'] as String,
      date: json['date'] as String,
      startTime: json['startTime'] as String,
      endTime: json['endTime'] as String,
      room: json['room'] as String?,
      mode: _$JsonConverterFromJson<String, SessionMode>(
        json['mode'],
        const SessionModeConverter().fromJson,
      ),
      qrValidityMinutes: (json['qrValidityMinutes'] as num?)?.toInt(),
      gracePeriodMinutes: (json['gracePeriodMinutes'] as num?)?.toInt(),
      startQrValiditySeconds: (json['startQrValiditySeconds'] as num?)?.toInt(),
      startGraceMinutes: (json['startGraceMinutes'] as num?)?.toInt(),
      endQrValiditySeconds: (json['endQrValiditySeconds'] as num?)?.toInt(),
      geofence: json['geofence'] == null
          ? null
          : GeofenceConfig.fromJson(json['geofence'] as Map<String, dynamic>),
      teacherId: json['teacherId'] as String,
      isRescheduled: json['isRescheduled'] as bool?,
      rescheduledFromDate: json['rescheduledFromDate'] as String?,
      originalScheduleTime: json['originalScheduleTime'] as String?,
      originalRoom: json['originalRoom'] as String?,
    );

Map<String, dynamic> _$CreateSessionInputToJson(_CreateSessionInput instance) =>
    <String, dynamic>{
      'sectionId': instance.sectionId,
      'subjectName': instance.subjectName,
      'date': instance.date,
      'startTime': instance.startTime,
      'endTime': instance.endTime,
      'room': instance.room,
      'mode': _$JsonConverterToJson<String, SessionMode>(
        instance.mode,
        const SessionModeConverter().toJson,
      ),
      'qrValidityMinutes': instance.qrValidityMinutes,
      'gracePeriodMinutes': instance.gracePeriodMinutes,
      'startQrValiditySeconds': instance.startQrValiditySeconds,
      'startGraceMinutes': instance.startGraceMinutes,
      'endQrValiditySeconds': instance.endQrValiditySeconds,
      'geofence': instance.geofence?.toJson(),
      'teacherId': instance.teacherId,
      'isRescheduled': instance.isRescheduled,
      'rescheduledFromDate': instance.rescheduledFromDate,
      'originalScheduleTime': instance.originalScheduleTime,
      'originalRoom': instance.originalRoom,
    };

Value? _$JsonConverterFromJson<Json, Value>(
  Object? json,
  Value? Function(Json json) fromJson,
) => json == null ? null : fromJson(json as Json);

Json? _$JsonConverterToJson<Json, Value>(
  Value? value,
  Json? Function(Value value) toJson,
) => value == null ? null : toJson(value);

_TeacherActivationLocation _$TeacherActivationLocationFromJson(
  Map<String, dynamic> json,
) => _TeacherActivationLocation(
  latitude: (json['latitude'] as num?)?.toDouble(),
  longitude: (json['longitude'] as num?)?.toDouble(),
  overrideFlag: json['override'] as bool?,
);

Map<String, dynamic> _$TeacherActivationLocationToJson(
  _TeacherActivationLocation instance,
) => <String, dynamic>{
  'latitude': instance.latitude,
  'longitude': instance.longitude,
  'override': instance.overrideFlag,
};

_GenerateCheckpointQrInput _$GenerateCheckpointQrInputFromJson(
  Map<String, dynamic> json,
) => _GenerateCheckpointQrInput(
  sessionId: json['sessionId'] as String,
  checkpoint: const CheckpointTypeConverter().fromJson(
    json['checkpoint'] as String,
  ),
  validitySeconds: (json['validitySeconds'] as num).toInt(),
  graceMinutes: (json['graceMinutes'] as num?)?.toInt(),
  regenerate: json['regenerate'] as bool?,
  pin: json['pin'] as String?,
  teacherLocation: json['teacherLocation'] == null
      ? null
      : TeacherActivationLocation.fromJson(
          json['teacherLocation'] as Map<String, dynamic>,
        ),
);

Map<String, dynamic> _$GenerateCheckpointQrInputToJson(
  _GenerateCheckpointQrInput instance,
) => <String, dynamic>{
  'sessionId': instance.sessionId,
  'checkpoint': const CheckpointTypeConverter().toJson(instance.checkpoint),
  'validitySeconds': instance.validitySeconds,
  'graceMinutes': instance.graceMinutes,
  'regenerate': instance.regenerate,
  'pin': instance.pin,
  'teacherLocation': instance.teacherLocation?.toJson(),
};

_BulkSessionSlot _$BulkSessionSlotFromJson(Map<String, dynamic> json) =>
    _BulkSessionSlot(
      day: json['day'] as String,
      startTime: json['startTime'] as String,
      endTime: json['endTime'] as String,
    );

Map<String, dynamic> _$BulkSessionSlotToJson(_BulkSessionSlot instance) =>
    <String, dynamic>{
      'day': instance.day,
      'startTime': instance.startTime,
      'endTime': instance.endTime,
    };

_BulkSessionInput _$BulkSessionInputFromJson(Map<String, dynamic> json) =>
    _BulkSessionInput(
      sectionId: json['sectionId'] as String,
      subjectName: json['subjectName'] as String,
      startDate: json['startDate'] as String,
      endDate: json['endDate'] as String,
      slots: (json['slots'] as List<dynamic>?)
          ?.map((e) => BulkSessionSlot.fromJson(e as Map<String, dynamic>))
          .toList(),
      daysOfWeek: (json['daysOfWeek'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      startTime: json['startTime'] as String?,
      endTime: json['endTime'] as String?,
      room: json['room'] as String?,
      mode: _$JsonConverterFromJson<String, SessionMode>(
        json['mode'],
        const SessionModeConverter().fromJson,
      ),
      qrValidityMinutes: (json['qrValidityMinutes'] as num?)?.toInt(),
      gracePeriodMinutes: (json['gracePeriodMinutes'] as num?)?.toInt(),
      startQrValiditySeconds: (json['startQrValiditySeconds'] as num?)?.toInt(),
      startGraceMinutes: (json['startGraceMinutes'] as num?)?.toInt(),
      endQrValiditySeconds: (json['endQrValiditySeconds'] as num?)?.toInt(),
      geofence: json['geofence'] == null
          ? null
          : GeofenceConfig.fromJson(json['geofence'] as Map<String, dynamic>),
      teacherId: json['teacherId'] as String,
    );

Map<String, dynamic> _$BulkSessionInputToJson(_BulkSessionInput instance) =>
    <String, dynamic>{
      'sectionId': instance.sectionId,
      'subjectName': instance.subjectName,
      'startDate': instance.startDate,
      'endDate': instance.endDate,
      'slots': instance.slots?.map((e) => e.toJson()).toList(),
      'daysOfWeek': instance.daysOfWeek,
      'startTime': instance.startTime,
      'endTime': instance.endTime,
      'room': instance.room,
      'mode': _$JsonConverterToJson<String, SessionMode>(
        instance.mode,
        const SessionModeConverter().toJson,
      ),
      'qrValidityMinutes': instance.qrValidityMinutes,
      'gracePeriodMinutes': instance.gracePeriodMinutes,
      'startQrValiditySeconds': instance.startQrValiditySeconds,
      'startGraceMinutes': instance.startGraceMinutes,
      'endQrValiditySeconds': instance.endQrValiditySeconds,
      'geofence': instance.geofence?.toJson(),
      'teacherId': instance.teacherId,
    };

_EnrollStudentInput _$EnrollStudentInputFromJson(Map<String, dynamic> json) =>
    _EnrollStudentInput(
      sectionId: json['sectionId'] as String,
      studentId: json['studentId'] as String,
      studentName: json['studentName'] as String,
    );

Map<String, dynamic> _$EnrollStudentInputToJson(_EnrollStudentInput instance) =>
    <String, dynamic>{
      'sectionId': instance.sectionId,
      'studentId': instance.studentId,
      'studentName': instance.studentName,
    };

_CalendarEventAttendanceCounts _$CalendarEventAttendanceCountsFromJson(
  Map<String, dynamic> json,
) => _CalendarEventAttendanceCounts(
  present: (json['present'] as num?)?.toInt() ?? 0,
  late: (json['late'] as num?)?.toInt() ?? 0,
  absent: (json['absent'] as num?)?.toInt() ?? 0,
  disputed: (json['disputed'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$CalendarEventAttendanceCountsToJson(
  _CalendarEventAttendanceCounts instance,
) => <String, dynamic>{
  'present': instance.present,
  'late': instance.late,
  'absent': instance.absent,
  'disputed': instance.disputed,
};

_CalendarEventReschedule _$CalendarEventRescheduleFromJson(
  Map<String, dynamic> json,
) => _CalendarEventReschedule(
  date: json['date'] as String,
  startTime: json['startTime'] as String,
  endTime: json['endTime'] as String,
  room: json['room'] as String?,
);

Map<String, dynamic> _$CalendarEventRescheduleToJson(
  _CalendarEventReschedule instance,
) => <String, dynamic>{
  'date': instance.date,
  'startTime': instance.startTime,
  'endTime': instance.endTime,
  'room': instance.room,
};

_CalendarEvent _$CalendarEventFromJson(Map<String, dynamic> json) =>
    _CalendarEvent(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      date: json['date'] as String,
      startTime: json['startTime'] as String? ?? '',
      endTime: json['endTime'] as String? ?? '',
      room: json['room'] as String?,
      sectionId: json['sectionId'] as String,
      subjectName: json['subjectName'] as String? ?? '',
      sectionName: json['sectionName'] as String? ?? '',
      type: const CalendarEventTypeConverter().fromJson(json['type'] as String),
      status: _$JsonConverterFromJson<String, CalendarEventStatus>(
        json['status'],
        const CalendarEventStatusConverter().fromJson,
      ),
      studentStatus:
          _$JsonConverterFromJson<String, CalendarEventStudentStatus>(
            json['studentStatus'],
            const CalendarEventStudentStatusConverter().fromJson,
          ),
      attendanceCounts: json['attendanceCounts'] == null
          ? null
          : CalendarEventAttendanceCounts.fromJson(
              json['attendanceCounts'] as Map<String, dynamic>,
            ),
      teacherName: json['teacherName'] as String?,
      subjectCode: json['subjectCode'] as String?,
      isRescheduled: json['isRescheduled'] as bool?,
      rescheduledFromDate: json['rescheduledFromDate'] as String?,
      rescheduledTo: json['rescheduledTo'] == null
          ? null
          : CalendarEventReschedule.fromJson(
              json['rescheduledTo'] as Map<String, dynamic>,
            ),
    );

Map<String, dynamic> _$CalendarEventToJson(
  _CalendarEvent instance,
) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'date': instance.date,
  'startTime': instance.startTime,
  'endTime': instance.endTime,
  'room': instance.room,
  'sectionId': instance.sectionId,
  'subjectName': instance.subjectName,
  'sectionName': instance.sectionName,
  'type': const CalendarEventTypeConverter().toJson(instance.type),
  'status': _$JsonConverterToJson<String, CalendarEventStatus>(
    instance.status,
    const CalendarEventStatusConverter().toJson,
  ),
  'studentStatus': _$JsonConverterToJson<String, CalendarEventStudentStatus>(
    instance.studentStatus,
    const CalendarEventStudentStatusConverter().toJson,
  ),
  'attendanceCounts': instance.attendanceCounts?.toJson(),
  'teacherName': instance.teacherName,
  'subjectCode': instance.subjectCode,
  'isRescheduled': instance.isRescheduled,
  'rescheduledFromDate': instance.rescheduledFromDate,
  'rescheduledTo': instance.rescheduledTo?.toJson(),
};

_EmergencyDeviceReleaseResult _$EmergencyDeviceReleaseResultFromJson(
  Map<String, dynamic> json,
) => _EmergencyDeviceReleaseResult(
  user: User.fromJson(json['user'] as Map<String, dynamic>),
  clearedCooldown: json['clearedCooldown'] as bool? ?? false,
  hadCooldown: json['hadCooldown'] as bool?,
  hadBinding: json['hadBinding'] as bool?,
  message: json['message'] as String? ?? '',
);

Map<String, dynamic> _$EmergencyDeviceReleaseResultToJson(
  _EmergencyDeviceReleaseResult instance,
) => <String, dynamic>{
  'user': instance.user.toJson(),
  'clearedCooldown': instance.clearedCooldown,
  'hadCooldown': instance.hadCooldown,
  'hadBinding': instance.hadBinding,
  'message': instance.message,
};

_AuditLogEntry _$AuditLogEntryFromJson(Map<String, dynamic> json) =>
    _AuditLogEntry(
      id: json['id'] as String,
      actorId: json['actorId'] as String? ?? '',
      actorName: json['actorName'] as String? ?? '',
      actorRole: json['actorRole'] as String? ?? '',
      action: json['action'] as String? ?? '',
      entityType: json['entityType'] as String? ?? '',
      entityId: json['entityId'] as String?,
      outcome: const AuditOutcomeConverter().fromJson(
        json['outcome'] as String,
      ),
      ipAddress: json['ipAddress'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );

Map<String, dynamic> _$AuditLogEntryToJson(_AuditLogEntry instance) =>
    <String, dynamic>{
      'id': instance.id,
      'actorId': instance.actorId,
      'actorName': instance.actorName,
      'actorRole': instance.actorRole,
      'action': instance.action,
      'entityType': instance.entityType,
      'entityId': instance.entityId,
      'outcome': const AuditOutcomeConverter().toJson(instance.outcome),
      'ipAddress': instance.ipAddress,
      'createdAt': instance.createdAt,
    };
