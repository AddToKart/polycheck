/// Mirrors `QacSection` / `QacSessionSlot` in
/// `shared/src/types/section-role.ts` (`GET /proofs/qac/mine`).
class QacSessionSlot {
  const QacSessionSlot({
    required this.id,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.open,
    required this.myPhotoCount,
    this.room,
  });

  factory QacSessionSlot.fromJson(Map<String, dynamic> json) => QacSessionSlot(
    id: json['id'] as String,
    date: json['date'] as String? ?? '',
    startTime: json['startTime'] as String? ?? '',
    endTime: json['endTime'] as String? ?? '',
    room: json['room'] as String?,
    open: json['open'] as bool? ?? false,
    myPhotoCount: (json['myPhotoCount'] as num?)?.toInt() ?? 0,
  );

  final String id;
  final String date;
  final String startTime;
  final String endTime;
  final String? room;

  /// Photos can be uploaded right now.
  final bool open;
  final int myPhotoCount;
}

class QacSection {
  const QacSection({
    required this.sectionId,
    required this.subjectName,
    required this.subjectCode,
    required this.section,
    required this.teacherName,
    required this.sessions,
    this.course,
  });

  factory QacSection.fromJson(Map<String, dynamic> json) => QacSection(
    sectionId: json['sectionId'] as String,
    subjectName: json['subjectName'] as String? ?? '',
    subjectCode: json['subjectCode'] as String? ?? '',
    section: json['section'] as String? ?? '',
    course: json['course'] as String?,
    teacherName: json['teacherName'] as String? ?? '',
    sessions: <QacSessionSlot>[
      for (final item in json['sessions'] as List<dynamic>? ?? const [])
        QacSessionSlot.fromJson(Map<String, dynamic>.from(item as Map)),
    ],
  );

  final String sectionId;
  final String subjectName;
  final String subjectCode;
  final String section;
  final String? course;
  final String teacherName;
  final List<QacSessionSlot> sessions;

  bool get hasOpenSession => sessions.any((slot) => slot.open);
}
