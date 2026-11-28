/// Mirrors `shared/src/types/subject-lifecycle.ts`.
library;

/// Days after archiving when a subject's evidence is erased for good. The
/// Privacy Policy states the same number.
const int archiveEvidenceRetentionDays = 90;

class SubjectArchiveCounts {
  const SubjectArchiveCounts({
    this.sections = 0,
    this.sessions = 0,
    this.attendanceRecords = 0,
    this.classPhotos = 0,
    this.excusePhotos = 0,
  });

  factory SubjectArchiveCounts.fromJson(Map<String, dynamic> json) {
    int read(String key) => (json[key] as num?)?.toInt() ?? 0;
    return SubjectArchiveCounts(
      sections: read('sections'),
      sessions: read('sessions'),
      attendanceRecords: read('attendanceRecords'),
      classPhotos: read('classPhotos'),
      excusePhotos: read('excusePhotos'),
    );
  }

  final int sections;
  final int sessions;
  final int attendanceRecords;
  final int classPhotos;
  final int excusePhotos;
}

/// What the archive screen shows: when the evidence goes, and how much there is.
class SubjectLifecycle {
  const SubjectLifecycle({
    required this.subjectId,
    required this.name,
    required this.code,
    this.archivedAt,
    this.evidencePurgeAt,
    this.evidencePurgedAt,
    this.counts = const SubjectArchiveCounts(),
  });

  factory SubjectLifecycle.fromJson(Map<String, dynamic> json) {
    DateTime? when(String key) =>
        DateTime.tryParse(json[key]?.toString() ?? '')?.toUtc();
    final counts = json['counts'];
    return SubjectLifecycle(
      subjectId: json['subjectId']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      archivedAt: when('archivedAt'),
      evidencePurgeAt: when('evidencePurgeAt'),
      evidencePurgedAt: when('evidencePurgedAt'),
      counts: counts is Map
          ? SubjectArchiveCounts.fromJson(counts.cast<String, dynamic>())
          : const SubjectArchiveCounts(),
    );
  }

  final String subjectId;
  final String name;
  final String code;
  final DateTime? archivedAt;
  final DateTime? evidencePurgeAt;
  final DateTime? evidencePurgedAt;
  final SubjectArchiveCounts counts;
}
