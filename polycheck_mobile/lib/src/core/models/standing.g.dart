// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'standing.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AttendanceStanding _$AttendanceStandingFromJson(Map<String, dynamic> json) =>
    _AttendanceStanding(
      sectionId: json['sectionId'] as String,
      subjectName: json['subjectName'] as String? ?? '',
      subjectCode: json['subjectCode'] as String? ?? '',
      sectionName: json['sectionName'] as String? ?? '',
      professorName: json['professorName'] as String? ?? '',
      thresholdPercent: (json['thresholdPercent'] as num?)?.toInt() ?? 75,
      present: (json['present'] as num?)?.toInt() ?? 0,
      late: (json['late'] as num?)?.toInt() ?? 0,
      absent: (json['absent'] as num?)?.toInt() ?? 0,
      disputed: (json['disputed'] as num?)?.toInt() ?? 0,
      incomplete: (json['incomplete'] as num?)?.toInt() ?? 0,
      countedSessions: (json['countedSessions'] as num?)?.toInt() ?? 0,
      attendanceRate: (json['attendanceRate'] as num?)?.toDouble(),
      status: const AttendanceStandingStatusConverter().fromJson(
        json['status'] as String,
      ),
      absencesBeforeBelowThreshold:
          (json['absencesBeforeBelowThreshold'] as num?)?.toInt(),
      lastSessionDate: json['lastSessionDate'] as String?,
      caveat: json['caveat'] as String?,
    );

Map<String, dynamic> _$AttendanceStandingToJson(
  _AttendanceStanding instance,
) => <String, dynamic>{
  'sectionId': instance.sectionId,
  'subjectName': instance.subjectName,
  'subjectCode': instance.subjectCode,
  'sectionName': instance.sectionName,
  'professorName': instance.professorName,
  'thresholdPercent': instance.thresholdPercent,
  'present': instance.present,
  'late': instance.late,
  'absent': instance.absent,
  'disputed': instance.disputed,
  'incomplete': instance.incomplete,
  'countedSessions': instance.countedSessions,
  'attendanceRate': instance.attendanceRate,
  'status': const AttendanceStandingStatusConverter().toJson(instance.status),
  'absencesBeforeBelowThreshold': instance.absencesBeforeBelowThreshold,
  'lastSessionDate': instance.lastSessionDate,
  'caveat': instance.caveat,
};
