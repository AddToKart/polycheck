/// Ordering and filter choices shared by the professor's record queues.
library;

import '../../../core/polycheck_core.dart';

const List<ListOption> recordSortOptions = <ListOption>[
  ListOption('', 'Newest first'),
  ListOption('oldest', 'Oldest first'),
  ListOption('student', 'Student (A to Z)'),
];

List<AttendanceRecord> sortRecords(
  Iterable<AttendanceRecord> records,
  String sort,
) {
  final copy = records.toList();
  copy.sort((a, b) {
    if (sort == 'student') return a.studentName.compareTo(b.studentName);
    final newest = b.timestamp.compareTo(a.timestamp);
    return sort == 'oldest' ? -newest : newest;
  });
  return copy;
}

/// The sections the given records belong to, labelled for a filter menu.
List<ListOption> sectionOptions(
  Iterable<String> sectionIds,
  Map<String, Section> sectionsById,
) {
  final options = <ListOption>[
    for (final id in sectionIds.toSet())
      if (sectionsById[id] != null)
        ListOption(
          id,
          formatSectionHeading(
            section: sectionsById[id]!.section,
            course: sectionsById[id]!.course,
          ),
        ),
  ]..sort((a, b) => a.label.compareTo(b.label));
  return options;
}

/// True when a record matches what was typed: the student or their class.
bool recordMatches(
  String query,
  AttendanceRecord record,
  Section? section, [
  String? sessionLabel,
]) {
  return matchesQuery(query, [
    record.studentName,
    if (section != null)
      formatSectionHeading(section: section.section, course: section.course),
    sessionLabel,
  ]);
}
