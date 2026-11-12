import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import 'widgets/faculty_shell.dart';

/// Faculty month/week calendar with event dots and deep links.
class FacultyScheduleScreen extends ConsumerStatefulWidget {
  const FacultyScheduleScreen({super.key});

  @override
  ConsumerState<FacultyScheduleScreen> createState() =>
      _FacultyScheduleScreenState();
}

class _FacultyScheduleScreenState extends ConsumerState<FacultyScheduleScreen> {
  bool _loading = true;
  String? _error;
  bool _monthView = true;
  DateTime _anchor = DateTime.now();
  List<CalendarEvent> _events = const <CalendarEvent>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  ({String start, String end}) get _range {
    if (_monthView) {
      final range = getDateRangeForMonth(_anchor.year, _anchor.month - 1);
      return (start: range.start, end: range.end);
    }
    final range = getDateRangeForWeek(_anchor);
    return (start: range.start, end: range.end);
  }

  Future<void> _load() async {
    final user = ref.read(sessionProvider).user;
    if (user == null) return;
    setState(() {
      _loading = _events.isEmpty;
      _error = null;
    });
    final range = _range;
    try {
      final events = await ref
          .read(dashboardApiProvider)
          .getCalendarEvents(user.id, range.start, range.end);
      if (!mounted) return;
      setState(() {
        _events = events.toList(growable: false)
          ..sort((a, b) {
            final date = a.date.compareTo(b.date);
            return date != 0 ? date : a.startTime.compareTo(b.startTime);
          });
        _loading = false;
      });
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to load the calendar: $error';
      });
    }
  }

  void _shift(int direction) {
    setState(() {
      _anchor = _monthView
          ? DateTime(_anchor.year, _anchor.month + direction, 1, 12)
          : DateTime(
              _anchor.year,
              _anchor.month,
              _anchor.day + 7 * direction,
              12,
            );
    });
    _load();
  }

  void _today() {
    setState(() => _anchor = DateTime.now());
    _load();
  }

  List<CalendarEvent> _eventsOn(String date) =>
      _events.where((event) => event.date == date).toList(growable: false);

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final title = _monthView
        ? '${getMonthName(_anchor.month - 1)} ${_anchor.year}'
        : 'Week of ${formatDate(_anchor)}';
    return FacultyScaffold(
      title: 'Schedule',
      subtitle: title,
      body: FacultyPageBody(
        refresh: _load,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CampusCard(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(
                children: [
                  IconButton(
                    tooltip: 'Previous',
                    onPressed: () => _shift(-1),
                    icon: const Icon(Icons.chevron_left),
                  ),
                  Expanded(
                    child: Text(
                      title,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Next',
                    onPressed: () => _shift(1),
                    icon: const Icon(Icons.chevron_right),
                  ),
                  TextButton(onPressed: _today, child: const Text('Today')),
                ],
              ),
            ),
            const SizedBox(height: 8),
            FacultyTabs(
              labels: const ['Month', 'Week'],
              selectedIndex: _monthView ? 0 : 1,
              onSelected: (index) {
                if ((index == 0) == _monthView) return;
                setState(() => _monthView = index == 0);
                _load();
              },
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 30),
                child: CampusLoading(label: 'Loading the calendar.'),
              )
            else if (_error != null)
              CampusCard(
                borderColor: tokens.gold,
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _error!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              )
            else if (_monthView)
              _MonthGrid(
                anchor: _anchor,
                eventsOn: _eventsOn,
                onDayTap: _openDay,
              )
            else
              _WeekColumns(
                anchor: _anchor,
                eventsFor: _events,
                onEventTap: _openEvent,
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _openDay(String date) async {
    final events = _eventsOn(date);
    // The sheet body pops itself and hands the tapped event back here. The
    // caller context lives on the shell navigator while the sheet can ride the
    // root one, so a caller-context pop removed the PAGE instead of the sheet
    // (the sign-out crash class); DD-F5.
    final selected = await showCampusBottomSheet<CalendarEvent>(
      context,
      title: date,
      child: FacultyDaySheet(events: events),
    );
    if (!mounted || selected == null) return;
    await _openEvent(selected);
  }

  Future<void> _openEvent(CalendarEvent event) async {
    final open = await showCampusBottomSheet<bool>(
      context,
      title: event.subjectName.isEmpty ? event.title : event.subjectName,
      child: FacultyEventSheet(event: event),
    );
    if (!mounted || open != true) return;
    context.push(
      event.type == CalendarEventType.session
          ? '/faculty/sessions/${event.id}'
          : '/faculty/sections/${event.sectionId}',
    );
  }
}

/// Bottom-sheet body for one civil day.
///
/// Each card pops the sheet **with its own context** and returns the tapped
/// event, which `_openDay` then hands to `_openEvent`. Before DD-F5 the card
/// popped with the screen's context while the sheet could be hosted by the
/// root navigator, so a tap removed the schedule page (blank screen) and never
/// delivered the event.
class FacultyDaySheet extends StatelessWidget {
  const FacultyDaySheet({super.key, required this.events});

  final List<CalendarEvent> events;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    if (events.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Text(
          'No classes scheduled.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final event in events)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _EventCard(
              event: event,
              onTap: () => Navigator.of(context).pop(event),
            ),
          ),
      ],
    );
  }
}

/// Bottom-sheet body for one calendar event.
///
/// Pops `true` with the sheet's own context when the person asks to open the
/// destination; `_openEvent` owns the routing decision (DD-F5).
class FacultyEventSheet extends StatelessWidget {
  const FacultyEventSheet({super.key, required this.event});

  final CalendarEvent event;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FacultyPill(
          label:
              '${formatTime(event.startTime)} – ${formatTime(event.endTime)}',
          icon: Icons.schedule,
        ),
        const SizedBox(height: 8),
        if (event.sectionName.isNotEmpty)
          _DetailRow(label: 'Section', value: 'Sec ${event.sectionName}'),
        if ((event.room ?? '').isNotEmpty)
          _DetailRow(label: 'Room', value: event.room!),
        if (event.subjectCode != null)
          _DetailRow(label: 'Course code', value: event.subjectCode!),
        if (event.teacherName != null && event.teacherName!.isNotEmpty)
          _DetailRow(label: 'Instructor', value: event.teacherName!),
        if (event.status != null)
          _DetailRow(label: 'Status', value: event.status!.wire),
        const SizedBox(height: 12),
        CampusButton(
          label: event.type == CalendarEventType.session
              ? 'Open session cockpit'
              : 'Open section',
          icon: Icons.arrow_forward,
          onPressed: () => Navigator.of(context).pop(true),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ),
          Expanded(
            child: Text(value, style: Theme.of(context).textTheme.bodySmall),
          ),
        ],
      ),
    );
  }
}

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.anchor,
    required this.eventsOn,
    required this.onDayTap,
  });

  final DateTime anchor;
  final List<CalendarEvent> Function(String date) eventsOn;
  final ValueChanged<String> onDayTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final weeks = getMonthDays(anchor.year, anchor.month - 1);
    final today = formatDate(DateTime.now());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            for (final day in const [
              'Sun',
              'Mon',
              'Tue',
              'Wed',
              'Thu',
              'Fri',
              'Sat',
            ])
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(
                    day,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: tokens.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
        for (final week in weeks)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final day in week)
                Expanded(
                  child: day == null
                      ? const SizedBox(height: 54)
                      : CampusMonthCell(
                          dayNumber: day.day,
                          today: formatDate(day) == today,
                          inMonth: true,
                          dots: [
                            for (final event in eventsOn(formatDate(day)))
                              CampusMonthDot(
                                fill: event.status == CalendarEventStatus.active
                                    ? tokens.gold
                                    : formatDate(day) == today
                                    ? Colors.white
                                    : tokens.maroon,
                              ),
                          ],
                          onTap: () => onDayTap(formatDate(day)),
                        ),
                ),
            ],
          ),
      ],
    );
  }
}

class _WeekColumns extends StatelessWidget {
  const _WeekColumns({
    required this.anchor,
    required this.eventsFor,
    required this.onEventTap,
  });

  final DateTime anchor;
  final List<CalendarEvent> eventsFor;
  final ValueChanged<CalendarEvent> onEventTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final days = getWeekDays(anchor);
    return SizedBox(
      height: 430,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SizedBox(
          width: 760,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final day in days)
                SizedBox(
                  width: 760 / 7,
                  child: Container(
                    margin: const EdgeInsets.all(2),
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: day.isToday
                          ? (tokens.isDark ? tokens.surface : tokens.campus)
                          : tokens.surface,
                      border: Border.all(
                        color: day.isToday
                            ? tokens.maroon
                            : tokens.borderSubtle,
                        width: day.isToday ? 2 : 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          '${day.day} ${day.date.substring(8)}',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                fontWeight: day.isToday
                                    ? FontWeight.w800
                                    : FontWeight.w600,
                                color: day.isToday
                                    ? (tokens.isDark
                                          ? tokens.gold
                                          : tokens.maroon)
                                    : tokens.onSurface,
                              ),
                        ),
                        const SizedBox(height: 4),
                        for (final event
                            in eventsFor
                                .where((event) => event.date == day.date)
                                .toList(growable: false))
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: InkWell(
                              onTap: () => onEventTap(event),
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color:
                                      event.status == CalendarEventStatus.active
                                      ? tokens.gold
                                      : tokens.campus,
                                  border: Border.all(
                                    color: tokens.borderSubtle,
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      formatTime(event.startTime),
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelSmall
                                          ?.copyWith(
                                            fontWeight: FontWeight.w800,
                                            color:
                                                event.status ==
                                                    CalendarEventStatus.active
                                                ? tokens.deepMaroon
                                                : tokens.onSurface,
                                            fontSize: 9,
                                          ),
                                    ),
                                    Text(
                                      event.subjectName.isEmpty
                                          ? event.title
                                          : event.subjectName,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            fontSize: 10,
                                            height: 1.2,
                                            color:
                                                event.status ==
                                                    CalendarEventStatus.active
                                                ? tokens.deepMaroon
                                                : tokens.onSurface,
                                          ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, required this.onTap});

  final CalendarEvent event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      onTap: onTap,
      padding: const EdgeInsets.all(10),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 36,
            color: event.status == CalendarEventStatus.active
                ? tokens.gold
                : tokens.maroon,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.subjectName.isEmpty ? event.title : event.subjectName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  '${formatTime(event.startTime)} – ${formatTime(event.endTime)}'
                  '${(event.room ?? '').isEmpty ? '' : ' · ${event.room}'}',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
