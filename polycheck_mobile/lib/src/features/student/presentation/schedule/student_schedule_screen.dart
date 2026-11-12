import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_providers.dart';
import '../common/student_app_bar_actions.dart';
import 'student_month_calendar.dart';
import 'timetable_card.dart';

/// Student schedule: a week carousel plus a Month tab (gap report B-14).
/// The month grid reuses the dot palette from RN `StudentCalendarViews`
/// (work-order colors), and tapping a day opens a bottom sheet with that
/// day's classes built from the same week-row card.
enum StudentScheduleView { week, month }

class StudentScheduleScreen extends ConsumerStatefulWidget {
  const StudentScheduleScreen({super.key});

  @override
  ConsumerState<StudentScheduleScreen> createState() =>
      _StudentScheduleScreenState();
}

class _StudentScheduleScreenState extends ConsumerState<StudentScheduleScreen> {
  late DateTime _anchor;
  late DateTime _monthAnchor;
  late String _selectedDate;
  StudentScheduleView _view = StudentScheduleView.week;

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    _anchor = today;
    _monthAnchor = DateTime(today.year, today.month, 1, 12);
    _selectedDate = formatDate(today);
  }

  void _moveWeek(int delta) {
    setState(() {
      _anchor = DateTime(
        _anchor.year,
        _anchor.month,
        _anchor.day + (delta * 7),
        12,
      );
      final week = getWeekDays(_anchor, today: DateTime.now());
      final todayDate = formatDate(DateTime.now());
      final containsToday = week.any((day) => day.date == todayDate);
      _selectedDate = containsToday ? todayDate : week.first.date;
    });
  }

  void _moveMonth(int delta) {
    setState(() {
      _monthAnchor = DateTime(
        _monthAnchor.year,
        _monthAnchor.month + delta,
        1,
        12,
      );
      final parsed = DateTime.tryParse('${_selectedDate}T12:00:00');
      if (parsed == null ||
          parsed.year != _monthAnchor.year ||
          parsed.month != _monthAnchor.month) {
        _selectedDate = '';
      }
    });
  }

  void _goToday() {
    setState(() {
      final today = DateTime.now();
      _anchor = today;
      _monthAnchor = DateTime(today.year, today.month, 1, 12);
      _selectedDate = formatDate(today);
    });
  }

  String? _dayFullName(String date) {
    final parsed = DateTime.tryParse('${date}T12:00:00');
    if (parsed == null) return null;
    return getDayNameFull(parsed.weekday % 7);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final sectionsAsync = ref.watch(studentSectionsProvider);
    final subjectsAsync = ref.watch(studentSubjectsProvider);
    final sections = sectionsAsync.value ?? const <Section>[];
    final subjects = subjectsAsync.value ?? const <String, Subject>{};
    // Async watches live at the SCREEN level (Bug 3): the month sliver child
    // must be a plain widget so a provider completing mid-diff can never
    // rebuild a sliver child during layout
    // (`sliver_multi_box_adaptor.dart: child == null || indexOf(child) > index`).
    final monthSessionsAsync = ref.watch(
      studentMonthSessionsProvider((
        year: _monthAnchor.year,
        month: _monthAnchor.month - 1,
      )),
    );
    final monthSessions = monthSessionsAsync.value;
    // DD-F14: a failed fetch is surfaced with its retry affordance instead of
    // rendering a silently empty month — including a provider-level failure
    // that never reached [StudentMonthSessions].
    final monthSessionsError =
        monthSessions?.error ??
        (monthSessionsAsync.hasError
            ? 'Your class sessions could not be fetched.'
            : null);
    final records =
        ref.watch(myAttendanceProvider).value ?? const <AttendanceRecord>[];

    return Scaffold(
      appBar: CampusHeader(
        title: 'My schedule',
        subtitle: 'Weekly and monthly class timetable',
        actions: StudentAppBarActions.build(context),
      ),
      body: RefreshIndicator(
        color: tokens.maroon,
        onRefresh: () async {
          ref.invalidate(studentSectionsProvider);
          ref.invalidate(studentSubjectsProvider);
        },
        child: ListView(
          // Keyed by view so toggling Week↔Month tears the sliver state down
          // instead of mutating children in place (Bug 3, defensive layer 1).
          key: ValueKey<StudentScheduleView>(_view),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
          children: <Widget>[
            _ViewTabs(
              view: _view,
              onSelect: (view) => setState(() => _view = view),
            ),
            const SizedBox(height: 10),
            if (_view == StudentScheduleView.week)
              _WeekBody(
                anchor: _anchor,
                selectedDate: _selectedDate,
                sections: sections,
                subjects: subjects,
                loading: sectionsAsync.isLoading && sections.isEmpty,
                onMoveWeek: _moveWeek,
                onToday: _goToday,
                onSelectDay: (date) => setState(() => _selectedDate = date),
              )
            else
              _MonthBody(
                monthAnchor: _monthAnchor,
                selectedDate: _selectedDate,
                sections: sections,
                subjects: subjects,
                sessions: monthSessions?.sessions ?? const <Session>[],
                sessionsLoading:
                    monthSessionsAsync.isLoading && monthSessions == null,
                sessionsError: monthSessionsError,
                sessionsFromCache: monthSessions?.fromCache ?? false,
                onRetrySessions: () => ref.invalidate(
                  studentMonthSessionsProvider((
                    year: _monthAnchor.year,
                    month: _monthAnchor.month - 1,
                  )),
                ),
                records: records,
                onMoveMonth: _moveMonth,
                onToday: _goToday,
                onSelectDay: _openDaySheet,
              ),
          ],
        ),
      ),
    );
  }

  /// Month sessions for the day sheet. A failed fetch is already surfaced in
  /// the grid with its retry affordance, so the sheet opens from the last
  /// known snapshot instead of blocking on the failure.
  Future<StudentMonthSessions> _monthSessionsFor({
    required int year,
    required int month,
  }) async {
    final provider = studentMonthSessionsProvider((year: year, month: month));
    try {
      return await ref.read(provider.future);
    } on Object {
      return ref.read(provider).value ??
          const StudentMonthSessions(sessions: <Session>[]);
    }
  }

  Future<void> _openDaySheet(String date) async {
    final year = int.tryParse(date.split('-')[0]);
    final monthIndex = int.tryParse(date.split('-')[1]);
    if (year == null || monthIndex == null) return;
    final month = monthIndex - 1;
    final sections =
        ref.read(studentSectionsProvider).value ?? const <Section>[];
    final records =
        ref.read(myAttendanceProvider).value ?? const <AttendanceRecord>[];
    final sessions = (await _monthSessionsFor(
      year: year,
      month: month,
    )).sessions;
    if (!mounted) return;
    final events =
        buildStudentMonthEvents(
          year: year,
          month: month,
          sections: sections,
          sessions: sessions,
          records: records,
        )[date] ??
        const <StudentMonthEvent>[];
    final dayName = _dayFullName(date) ?? 'Class day';
    await showCampusBottomSheet<void>(
      context,
      title: '$dayName · $date',
      child: StudentMonthDaySheet(events: events),
    );
  }
}

/// Month/Week segmented control (square PUP pill styling).
class _ViewTabs extends StatelessWidget {
  const _ViewTabs({required this.view, required this.onSelect});

  final StudentScheduleView view;
  final ValueChanged<StudentScheduleView> onSelect;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Row(
      children: <Widget>[
        for (final candidate in StudentScheduleView.values)
          Expanded(
            child: InkWell(
              key: ValueKey('schedule-view-${candidate.name}'),
              onTap: () => onSelect(candidate),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: candidate == view ? tokens.maroon : tokens.surface,
                  border: Border.all(
                    color: candidate == view
                        ? tokens.maroon
                        : tokens.borderSubtle,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  candidate == StudentScheduleView.month ? 'Month' : 'Week',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: candidate == view ? Colors.white : tokens.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Week branch (unchanged parity): timetable rows for the selected weekday.
class _WeekBody extends StatelessWidget {
  const _WeekBody({
    required this.anchor,
    required this.selectedDate,
    required this.sections,
    required this.subjects,
    required this.loading,
    required this.onMoveWeek,
    required this.onToday,
    required this.onSelectDay,
  });

  final DateTime anchor;
  final String selectedDate;
  final List<Section> sections;
  final Map<String, Subject> subjects;
  final bool loading;
  final ValueChanged<int> onMoveWeek;
  final VoidCallback onToday;
  final ValueChanged<String> onSelectDay;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final week = getWeekDays(anchor, today: DateTime.now());
    final dayCode = dayOfWeek(selectedDate);
    final entries = <TimetableEntry>[];
    for (final section in sections) {
      for (final slot in section.schedule) {
        if (slot.day.wire == dayCode) {
          entries.add(
            TimetableEntry(
              section: section,
              slot: slot,
              subject: subjects[section.subjectId],
            ),
          );
        }
      }
    }
    entries.sort((a, b) => a.slot.startTime.compareTo(b.slot.startTime));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            IconButton(
              tooltip: 'Previous week',
              onPressed: () => onMoveWeek(-1),
              icon: const Icon(Icons.chevron_left),
            ),
            Expanded(
              child: Column(
                children: <Widget>[
                  Text(
                    '${getMonthName(int.tryParse(week.first.date.split('-')[1])! - 1)} ${week.first.date.split('-')[0]}',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: tokens.onSurface,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    '${week.first.date} → ${week.last.date}',
                    style: Theme.of(
                      context,
                    ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                  ),
                ],
              ),
            ),
            TextButton(onPressed: onToday, child: const Text('Today')),
            IconButton(
              tooltip: 'Next week',
              onPressed: () => onMoveWeek(1),
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            for (final day in week)
              Expanded(
                child: _DayChip(
                  day: day,
                  selected: day.date == selectedDate,
                  onTap: () => onSelectDay(day.date),
                ),
              ),
          ],
        ),
        const SizedBox(height: 18),
        Text(
          dayCode == null
              ? 'Classes'
              : '${getDayNameFull(_weekdayIndex(dayCode))} · $selectedDate',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: tokens.onSurface,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),
        if (loading)
          const CampusLoading(label: 'Loading your classes…')
        else if (entries.isEmpty)
          CampusCard(
            child: CampusEmptyState(
              icon: Icons.event_available_outlined,
              title: 'No classes this day',
              message: 'Enrolled classes for this weekday will appear here.',
            ),
          )
        else
          for (final entry in entries) ...<Widget>[
            TimetableCard(entry: entry),
            const SizedBox(height: 10),
          ],
      ],
    );
  }

  int _weekdayIndex(String day) {
    const names = <String>['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final index = names.indexOf(day);
    return index < 0 ? 0 : index;
  }
}

/// Month branch (plain widget — Bug 3): grid + day drilldown through the
/// campus bottom sheet. All async data arrives as plain values from the
/// screen-level watches; no provider is watched inside the sliver child.
class _MonthBody extends StatelessWidget {
  const _MonthBody({
    required this.monthAnchor,
    required this.selectedDate,
    required this.sections,
    required this.subjects,
    required this.sessions,
    required this.sessionsLoading,
    required this.sessionsError,
    required this.sessionsFromCache,
    required this.onRetrySessions,
    required this.records,
    required this.onMoveMonth,
    required this.onToday,
    required this.onSelectDay,
  });

  final DateTime monthAnchor;
  final String selectedDate;
  final List<Section> sections;
  final Map<String, Subject> subjects;
  final List<Session> sessions;
  final bool sessionsLoading;
  final String? sessionsError;
  final bool sessionsFromCache;
  final VoidCallback onRetrySessions;
  final List<AttendanceRecord> records;
  final ValueChanged<int> onMoveMonth;
  final VoidCallback onToday;
  final ValueChanged<String> onSelectDay;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final year = monthAnchor.year;
    final month = monthAnchor.month - 1;
    final now = DateTime.now();
    final todayDate = formatCampusDate(now);
    final today = DateTime.parse('${todayDate}T12:00:00');
    final events = buildStudentMonthEvents(
      year: year,
      month: month,
      sections: sections,
      sessions: sessions,
      records: records,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            IconButton(
              tooltip: 'Previous month',
              onPressed: () => onMoveMonth(-1),
              icon: const Icon(Icons.chevron_left),
            ),
            Expanded(
              child: Text(
                '${getMonthName(month)} $year',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            TextButton(onPressed: onToday, child: const Text('Today')),
            IconButton(
              tooltip: 'Next month',
              onPressed: () => onMoveMonth(1),
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        const SizedBox(height: 6),
        if (sessionsError != null) ...<Widget>[
          _MonthFetchNotice(
            message: sessionsError!,
            fromCache: sessionsFromCache,
            onRetry: onRetrySessions,
          ),
          const SizedBox(height: 8),
        ],
        if (sessionsLoading) ...<Widget>[
          const CampusLoading(label: 'Loading your sessions…', compact: true),
          const SizedBox(height: 6),
        ],
        StudentMonthCalendar(
          year: year,
          month: month,
          events: events,
          today: today,
          selectedDate: selectedDate,
          onSelectDay: onSelectDay,
        ),
        const SizedBox(height: 10),
        Text(
          'Tap a day to open its classes. Dots mark class meetings; colored '
          'dots are your attendance status for that day.',
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: tokens.muted),
        ),
      ],
    );
  }
}

/// Month-view fetch failure: keeps the cached/fallback grid visible and offers
/// a retry, so a failed fetch never reads as an empty month.
class _MonthFetchNotice extends StatelessWidget {
  const _MonthFetchNotice({
    required this.message,
    required this.fromCache,
    required this.onRetry,
  });

  final String message;
  final bool fromCache;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      key: const ValueKey('month-sessions-error'),
      borderColor: tokens.gold,
      color: tokens.gold.withValues(alpha: 0.08),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            fromCache
                ? 'Showing saved sessions'
                : 'Unable to load your sessions',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            fromCache
                ? '$message Showing the sessions saved on this device.'
                : message,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.4),
          ),
          const SizedBox(height: 8),
          CampusButton(
            key: const ValueKey('month-sessions-retry'),
            label: 'Try again',
            variant: CampusButtonVariant.outline,
            expand: false,
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip({
    required this.day,
    required this.selected,
    required this.onTap,
  });

  final WeekDay day;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final background = selected
        ? (tokens.isDark ? tokens.gold : tokens.maroon)
        : tokens.surface;
    final foreground = selected
        ? (tokens.isDark ? tokens.deepMaroon : Colors.white)
        : tokens.onSurface;
    final dayNumber = int.tryParse(day.date.split('-').last) ?? 0;
    return Semantics(
      selected: selected,
      button: true,
      label: '${day.day} ${day.date}',
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: Material(
          color: background,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.zero,
            side: BorderSide(
              color: day.isToday
                  ? (tokens.isDark ? tokens.gold : tokens.maroon)
                  : tokens.borderSubtle,
              width: day.isToday ? 2 : 1,
            ),
          ),
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                children: <Widget>[
                  Text(
                    day.day.toUpperCase(),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: selected ? foreground : tokens.muted,
                      fontWeight: FontWeight.w700,
                      fontSize: 9,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '$dayNumber',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: foreground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: day.isToday
                          ? (selected ? foreground : tokens.gold)
                          : Colors.transparent,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
