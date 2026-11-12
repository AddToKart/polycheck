import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_cache.dart';
import 'timetable_card.dart';

/// Student month calendar (gap report B-14; RN `StudentCalendarViews`
/// parity). Data comes from the enrolled sections' weekly schedules, the
/// session cache, and the student's own attendance records.
///
/// Dot coloring follows the PUP status palette (work-order spec):
/// present = gold, late = maroon, absent = deep maroon, disputed = gold
/// border, and a plain scheduled meeting gets the muted event dot.

/// One class meeting plotted on a month grid date.
@immutable
class StudentMonthEvent {
  const StudentMonthEvent({
    required this.date,
    required this.section,
    required this.slot,
    this.subject,
    this.session,
    this.record,
  });

  final String date;
  final Section section;
  final ScheduleDay slot;
  final Subject? subject;
  final Session? session;
  final AttendanceRecord? record;

  String get subjectName {
    final name = subject?.name.trim() ?? '';
    return name.isNotEmpty ? name : section.section;
  }

  TimetableEntry get entry =>
      TimetableEntry(section: section, slot: slot, subject: subject);
}

/// Expands the enrolled weekly schedules over one month and overlays the
/// session cache + attendance statuses. Schedule meetings and same-date
/// sessions of the same section merge into one event (the session wins so
/// the drawn status reflects the actual meeting).
Map<String, List<StudentMonthEvent>> buildStudentMonthEvents({
  required int year,
  required int month,
  required List<Section> sections,
  required List<Session> sessions,
  required List<AttendanceRecord> records,
}) {
  final range = getDateRangeForMonth(year, month);
  final start = DateTime.parse('${range.start}T12:00:00');
  final end = DateTime.parse('${range.end}T12:00:00');

  final events = <String, List<StudentMonthEvent>>{};
  final scheduledIndex = <String, Map<String, StudentMonthEvent>>{};
  void add(StudentMonthEvent event) {
    events.putIfAbsent(event.date, () => <StudentMonthEvent>[]).add(event);
    scheduledIndex.putIfAbsent(
      event.date,
      () => <String, StudentMonthEvent>{},
    )[event.section.id] = event;
  }

  // 1. Weekly schedule → every matching weekday of the month.
  for (
    var day = start;
    !day.isAfter(end);
    day = day.add(const Duration(days: 1))
  ) {
    final date = formatDate(day);
    final wire = getDayName(day.weekday % 7);
    for (final section in sections) {
      for (final slot in section.schedule) {
        if (slot.day.wire != wire) continue;
        add(StudentMonthEvent(date: date, section: section, slot: slot));
      }
    }
  }

  // 2. Session cache → resolves slot data + the status the actual meeting
  //    had for the student (unknown sections without a schedule slot are
  //    dropped rather than inventing meeting times).
  final recordBySessionId = <String, AttendanceRecord>{
    for (final record in records) record.sessionId: record,
  };
  for (final session in sessions) {
    final date = session.date;
    final parsed = DateTime.tryParse('${date}T12:00:00');
    if (parsed == null || parsed.isBefore(start) || parsed.isAfter(end)) {
      continue;
    }
    Section? section;
    for (final item in sections) {
      if (item.id == session.sectionId) {
        section = item;
        break;
      }
    }
    if (section == null) continue;
    final scheduled = scheduledIndex[date]?[session.sectionId];
    final slot =
        scheduled?.slot ??
        ScheduleDay(
          day: DayOfWeek.fromWire(getDayName(parsed.weekday % 7)),
          startTime: session.startTime,
          endTime: session.endTime,
          room: session.room,
        );
    final event = StudentMonthEvent(
      date: date,
      section: section,
      slot: slot,
      session: session,
      record: recordBySessionId[session.id],
    );
    // A session can fall on a weekday that is not part of the section's weekly
    // schedule (make-up/rescheduled class). It still plots; it simply has no
    // scheduled meeting to merge into.
    final list = events.putIfAbsent(date, () => <StudentMonthEvent>[]);
    if (scheduled != null) {
      list[list.indexOf(scheduled)] = event;
    } else {
      list.add(event);
    }
    scheduledIndex[date]?[session.sectionId] = event;
  }

  for (final list in events.values) {
    list.sort((a, b) => a.slot.startTime.compareTo(b.slot.startTime));
  }
  return events;
}

/// Month-view calendar card. Uses `getMonthDays` (never a trailing all-null
/// week) and renders every day through the shared [CampusMonthCell] faculty
/// geometry (54px bordered cells, maroon today fill, 6px dots + `+N`
/// overflow) with the PUP status-dot palette.
class StudentMonthCalendar extends StatelessWidget {
  const StudentMonthCalendar({
    super.key,
    required this.year,
    required this.month,
    required this.events,
    required this.today,
    required this.selectedDate,
    required this.onSelectDay,
  });

  /// 0-based month index (shared calendar contract).
  final int year;
  final int month;
  final Map<String, List<StudentMonthEvent>> events;
  final DateTime today;
  final String selectedDate;
  final ValueChanged<String> onSelectDay;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final weeks = getMonthDays(year, month);
    final todayDate = formatDate(today);
    return CampusCard(
      padding: const EdgeInsets.all(10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              for (var index = 0; index < 7; index++)
                Expanded(
                  child: Center(
                    child: Text(
                      getDayName(index),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: tokens.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          for (final week in weeks)
            Row(
              children: <Widget>[
                for (final day in week)
                  day == null
                      ? const Expanded(child: SizedBox(height: 54))
                      : Expanded(
                          child: _MonthDayCell(
                            date: day,
                            month: month,
                            todayDate: todayDate,
                            selectedDate: selectedDate,
                            events: events,
                            dark: tokens.isDark,
                            onSelectDay: onSelectDay,
                          ),
                        ),
              ],
            ),
        ],
      ),
    );
  }
}

/// Student adapter for the shared [CampusMonthCell]: maps the day's events to
/// the PUP status-dot palette and forwards selection/tap semantics.
class _MonthDayCell extends StatelessWidget {
  const _MonthDayCell({
    required this.date,
    required this.month,
    required this.todayDate,
    required this.selectedDate,
    required this.events,
    required this.dark,
    required this.onSelectDay,
  });

  final DateTime date;
  final int month;
  final String todayDate;
  final String selectedDate;
  final Map<String, List<StudentMonthEvent>> events;
  final bool dark;
  final ValueChanged<String> onSelectDay;

  @override
  Widget build(BuildContext context) {
    final dateStr = formatDate(date);
    final dayEvents = events[dateStr] ?? const <StudentMonthEvent>[];
    return CampusMonthCell(
      key: ValueKey('month-cell-$dateStr'),
      dayNumber: date.day,
      today: dateStr == todayDate,
      inMonth: date.month == month + 1,
      selected: dateStr == selectedDate,
      dots: <CampusMonthDot>[
        for (final event in dayEvents) _studentDot(event, dark: dark),
      ],
      onTap: () => onSelectDay(dateStr),
      semanticLabel: 'Open $dateStr — ${dayEvents.length} classes',
    );
  }
}

/// Maps one month event to the shared dot type via the PUP status palette.
CampusMonthDot _studentDot(StudentMonthEvent event, {required bool dark}) {
  final style = studentMonthDotStyle(event.record?.status, isDark: dark);
  return CampusMonthDot(fill: style.fill, border: style.border);
}

/// Dot colors derived from the centralized status styles so tests assert the
/// same values the roster badges draw.
StudentMonthDotStyle studentMonthDotStyle(
  AttendanceStatus? status, {
  required bool isDark,
}) {
  if (status == null) {
    return const StudentMonthDotStyle(
      fill: PupColors.muted,
      border: PupColors.muted,
    );
  }
  final style = attendanceStatusStyle(status, isDark: isDark);
  return StudentMonthDotStyle(fill: style.background, border: style.border);
}

@immutable
class StudentMonthDotStyle {
  const StudentMonthDotStyle({required this.fill, required this.border});

  final Color fill;
  final Color border;

  @override
  bool operator ==(Object other) =>
      other is StudentMonthDotStyle &&
      other.fill == fill &&
      other.border == border;

  @override
  int get hashCode => Object.hash(fill, border);

  @override
  String toString() => 'StudentMonthDotStyle($fill, $border)';
}

/// Day drilldown sheet body: that date's classes rendered through the shared
/// week-row card (`TimetableCard`), plus the recorded attendance status.
class StudentMonthDaySheet extends StatelessWidget {
  const StudentMonthDaySheet({super.key, required this.events});

  final List<StudentMonthEvent> events;

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) {
      return CampusEmptyState(
        icon: Icons.event_available_outlined,
        title: 'No classes this day',
        message: 'Choose another date to review your schedule.',
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (final event in events) ...<Widget>[
          TimetableCard(entry: event.entry, record: event.record),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

/// Result of the month-view session fetch.
///
/// A failed server fetch is data, not an escaping exception: [sessions] then
/// carries whatever the owner's offline cache holds (possibly nothing),
/// [fromCache] marks it as snapshot data, and [error] is the reason the view
/// renders beside its retry affordance. A month must never render silently
/// empty because of an unclassified failure.
@immutable
class StudentMonthSessions {
  const StudentMonthSessions({
    required this.sessions,
    this.fromCache = false,
    this.error,
  });

  final List<Session> sessions;
  final bool fromCache;
  final String? error;

  bool get hasError => error != null;
}

/// Sessions for the month view: the server fetch (role-scoped `/sessions`)
/// upserts the offline cache first; any failure falls back to every cached
/// session for the owner and keeps the error visible for a retry.
Future<StudentMonthSessions> fetchStudentMonthSessions(
  AppDatabase database,
  SessionsApi api,
  User user,
) async {
  try {
    final sessions = await api.getSessions();
    await database.upsertSessions(user.id, sessions);
    return StudentMonthSessions(sessions: sessions);
  } on Object catch (error) {
    // Widened from `on ApiRequestError`: decode/transport/drift failures all
    // degrade to the last cached month instead of an empty grid.
    List<Session> cached;
    try {
      cached = await readCachedSessions(database, user.id);
    } on Object {
      // Documented degraded mode: an unreadable cache leaves the grid empty,
      // but [error] still surfaces with the retry action.
      cached = const <Session>[];
    }
    return StudentMonthSessions(
      sessions: cached,
      fromCache: true,
      error: _monthFetchFailureMessage(error),
    );
  }
}

/// User-facing reason for a failed month fetch.
String _monthFetchFailureMessage(Object error) {
  if (error is ApiRequestError) {
    final message = error.message.trim();
    if (message.isNotEmpty) return message;
  }
  return 'Your class sessions could not be fetched.';
}

/// Screen-local month data source (presentation-owned; drift-backed).
final studentMonthSessionsProvider = FutureProvider.autoDispose
    .family<StudentMonthSessions, ({int year, int month})>((ref, _) async {
      final user = ref.watch(sessionProvider).user;
      if (user == null) {
        return const StudentMonthSessions(sessions: <Session>[]);
      }
      return fetchStudentMonthSessions(
        ref.watch(appDatabaseProvider),
        ref.watch(sessionsApiProvider),
        user,
      );
    });
