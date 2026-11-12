import '../../../core/polycheck_core.dart';

/// Client-side CSV helpers for faculty exports.
///
/// The authoritative export is the server (`GET /reports/export` via
/// `DashboardApi.exportAttendanceCsv`); this builder is the offline fallback
/// for the currently filtered rows and must stay formula-safe like the backend
/// (`csvCell` mirrors `android/components/BulkImportSheet.tsx:92-100`).

String csvCell(Object? value) {
  final text = value == null ? '' : '$value';
  final guarded = RegExp(r'^[=+\-@\t\r]').hasMatch(text) ? "'$text" : text;
  return '"${guarded.replaceAll('"', '""')}"';
}

String csvText(Iterable<Iterable<Object?>> rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

const List<String> attendanceCsvColumns = [
  'Record ID',
  'Session ID',
  'Section ID',
  'Section',
  'Subject',
  'Student number',
  'Student name',
  'Timestamp',
  'Status',
  'Mode',
  'Manually set',
  'Disputed',
  'Dispute reason',
  'Synced',
];

String buildAttendanceCsv(
  Iterable<AttendanceRecord> records, {
  Map<String, Section> sectionsById = const {},
  Map<String, String> subjectNames = const {},
}) {
  final rows = <List<Object?>>[attendanceCsvColumns];
  for (final record in records) {
    final section = sectionsById[record.sectionId];
    rows.add([
      record.id,
      record.sessionId,
      record.sectionId,
      section == null
          ? record.sectionId
          : formatSectionHeading(
              section: section.section,
              course: section.course,
            ),
      subjectNames[record.sectionId] ?? '',
      record.studentId,
      record.studentName,
      record.timestamp,
      record.status.wire,
      record.mode?.wire ?? '',
      record.manuallySet ? 'yes' : 'no',
      record.disputeResolved
          ? 'resolved'
          : (record.disputeReason != null ? 'open' : ''),
      record.disputeReason?.wire ?? '',
      record.isSynced ? 'yes' : 'no',
    ]);
  }
  return csvText(rows);
}
