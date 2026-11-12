// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'subject.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ScheduleDay _$ScheduleDayFromJson(Map<String, dynamic> json) => _ScheduleDay(
  day: const DayOfWeekConverter().fromJson(json['day'] as String),
  startTime: json['startTime'] as String,
  endTime: json['endTime'] as String,
  room: json['room'] as String?,
);

Map<String, dynamic> _$ScheduleDayToJson(_ScheduleDay instance) =>
    <String, dynamic>{
      'day': const DayOfWeekConverter().toJson(instance.day),
      'startTime': instance.startTime,
      'endTime': instance.endTime,
      'room': instance.room,
    };

_Subject _$SubjectFromJson(Map<String, dynamic> json) => _Subject(
  id: json['id'] as String,
  name: json['name'] as String,
  code: json['code'] as String,
  description: json['description'] as String?,
  createdAt: json['createdAt'] as String? ?? '',
  updatedAt: json['updatedAt'] as String? ?? '',
);

Map<String, dynamic> _$SubjectToJson(_Subject instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'code': instance.code,
  'description': instance.description,
  'createdAt': instance.createdAt,
  'updatedAt': instance.updatedAt,
};

_Section _$SectionFromJson(Map<String, dynamic> json) => _Section(
  id: json['id'] as String,
  subjectId: json['subjectId'] as String,
  section: json['section'] as String,
  course: json['course'] as String?,
  room: json['room'] as String? ?? '',
  schedule:
      (json['schedule'] as List<dynamic>?)
          ?.map((e) => ScheduleDay.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <ScheduleDay>[],
  semester: json['semester'] as String? ?? '',
  teacherId: json['teacherId'] as String,
  teacherName: json['teacherName'] as String? ?? '',
  enrollmentCode: json['enrollmentCode'] as String?,
  enrollmentCodeExpiry: json['enrollmentCodeExpiry'] as String?,
  studentCount: (json['studentCount'] as num?)?.toInt() ?? 0,
  createdAt: json['createdAt'] as String? ?? '',
  updatedAt: json['updatedAt'] as String? ?? '',
);

Map<String, dynamic> _$SectionToJson(_Section instance) => <String, dynamic>{
  'id': instance.id,
  'subjectId': instance.subjectId,
  'section': instance.section,
  'course': instance.course,
  'room': instance.room,
  'schedule': instance.schedule.map((e) => e.toJson()).toList(),
  'semester': instance.semester,
  'teacherId': instance.teacherId,
  'teacherName': instance.teacherName,
  'enrollmentCode': instance.enrollmentCode,
  'enrollmentCodeExpiry': instance.enrollmentCodeExpiry,
  'studentCount': instance.studentCount,
  'createdAt': instance.createdAt,
  'updatedAt': instance.updatedAt,
};

_Enrollment _$EnrollmentFromJson(Map<String, dynamic> json) => _Enrollment(
  id: json['id'] as String,
  studentId: json['studentId'] as String,
  sectionId: json['sectionId'] as String,
  enrolledAt: json['enrolledAt'] as String? ?? '',
);

Map<String, dynamic> _$EnrollmentToJson(_Enrollment instance) =>
    <String, dynamic>{
      'id': instance.id,
      'studentId': instance.studentId,
      'sectionId': instance.sectionId,
      'enrolledAt': instance.enrolledAt,
    };
