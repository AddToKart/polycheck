import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import 'widgets/faculty_shell.dart';

const String customCourseOption = '__custom__';
const List<String> semesterOptions = <String>[
  '1st Semester AY 2026-2027',
  '2nd Semester AY 2026-2027',
  'Summer AY 2026-2027',
];

class _ScheduleRow {
  _ScheduleRow({
    required this.day,
    required String startTime,
    required String endTime,
    String room = '',
  }) : start = TextEditingController(text: startTime),
       end = TextEditingController(text: endTime),
       roomController = TextEditingController(text: room);

  String day;
  final TextEditingController start;
  final TextEditingController end;
  final TextEditingController roomController;

  void dispose() {
    start.dispose();
    end.dispose();
    roomController.dispose();
  }
}

/// Create a section of a parent subject (course, room, schedule, semester).
class SectionCreateScreen extends ConsumerStatefulWidget {
  const SectionCreateScreen({super.key, required this.subjectId});

  final String subjectId;

  @override
  ConsumerState<SectionCreateScreen> createState() =>
      _SectionCreateScreenState();
}

class _SectionCreateScreenState extends ConsumerState<SectionCreateScreen> {
  final TextEditingController _section = TextEditingController();
  final TextEditingController _room = TextEditingController();
  final TextEditingController _customCourse = TextEditingController();
  final List<_ScheduleRow> _schedule = <_ScheduleRow>[];
  String _courseSelection = '';
  String _semester = semesterOptions.first;
  Subject? _subject;
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  String? _sectionError;
  String? _courseError;
  String? _roomError;
  String? _scheduleError;

  @override
  void initState() {
    super.initState();
    _schedule.add(
      _ScheduleRow(day: 'Mon', startTime: '09:00', endTime: '10:30'),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadSubject());
  }

  @override
  void dispose() {
    _section.dispose();
    _room.dispose();
    _customCourse.dispose();
    for (final row in _schedule) {
      row.dispose();
    }
    super.dispose();
  }

  Future<void> _loadSubject() async {
    try {
      final subject = await ref
          .read(subjectsApiProvider)
          .getSubject(widget.subjectId);
      if (!mounted) return;
      setState(() {
        _subject = subject;
        _loading = false;
      });
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    }
  }

  String get _resolvedCourse =>
      (_courseSelection == customCourseOption
              ? _customCourse.text
              : _courseSelection)
          .trim();

  Future<void> _pickCourse() async {
    final selection = await showCampusBottomSheet<String>(
      context,
      title: 'Course',
      child: _CoursePickerSheet(selectedCode: _courseSelection),
    );
    if (selection == null || !mounted) return;
    setState(() {
      _courseSelection = selection;
      _courseError = null;
    });
  }

  void _addScheduleRow() {
    setState(() {
      _schedule.add(
        _ScheduleRow(day: 'Wed', startTime: '09:00', endTime: '10:30'),
      );
      _scheduleError = null;
    });
  }

  bool _validTime(String value) =>
      RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(value.trim());

  Future<void> _submit() async {
    if (_submitting) return;
    final section = _section.text.trim();
    final room = _room.text.trim();
    final course = _resolvedCourse;
    String? scheduleError;
    final slots = <CreateSectionScheduleSlot>[];
    for (final row in _schedule) {
      final start = row.start.text.trim();
      final end = row.end.text.trim();
      if (!_validTime(start) || !_validTime(end) || end.compareTo(start) <= 0) {
        scheduleError =
            'Each meeting needs a valid start/end time in 24-hour HH:mm form '
            'with the end after the start.';
        break;
      }
      slots.add(
        CreateSectionScheduleSlot(
          day: row.day,
          startTime: start,
          endTime: end,
          room: row.roomController.text.trim().isEmpty
              ? null
              : row.roomController.text.trim(),
        ),
      );
    }
    if (scheduleError == null && slots.isEmpty) {
      scheduleError = 'Add at least one class meeting.';
    }
    setState(() {
      _sectionError = section.isEmpty ? 'Enter the section label.' : null;
      _courseError = course.isEmpty ? 'Choose the section course.' : null;
      _roomError = room.isEmpty ? 'Enter the default room.' : null;
      _scheduleError = scheduleError;
      _error = null;
    });
    if (_sectionError != null ||
        _courseError != null ||
        _roomError != null ||
        _scheduleError != null) {
      return;
    }
    setState(() => _submitting = true);
    try {
      final created = await ref
          .read(sectionsApiProvider)
          .createSection(
            CreateSectionInput(
              subjectId: widget.subjectId,
              section: section,
              course: course,
              room: room,
              schedule: slots,
              semester: _semester,
            ),
          );
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Section ${created.section} created.',
        tone: CampusToastTone.success,
      );
      context.pushReplacement('/faculty/sections/${created.id}');
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Unable to create the section: $error');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return FacultyScaffold(
      title: 'New section',
      subtitle: _subject == null
          ? null
          : '${_subject!.name} · ${_subject!.code}',
      showDefaultActions: false,
      body: _loading
          ? const FacultyLoading(label: 'Loading subject.')
          : FacultyPageBody(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_error != null) ...[
                    CampusCard(
                      borderColor: tokens.gold,
                      child: Text(
                        _error!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Course',
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 6),
                        InkWell(
                          onTap: _pickCourse,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              border: Border.all(color: tokens.borderSubtle),
                              color: tokens.surface,
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    _courseSelection.isEmpty
                                        ? 'Select a course…'
                                        : _courseSelection == customCourseOption
                                        ? 'Other — specify manually'
                                        : '$_courseSelection — '
                                              '${pupCourseName(_courseSelection)}',
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(
                                          color: _courseSelection.isEmpty
                                              ? tokens.muted
                                              : tokens.onSurface,
                                        ),
                                  ),
                                ),
                                Icon(
                                  Icons.expand_more,
                                  size: 20,
                                  color: tokens.muted,
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (_courseSelection == customCourseOption) ...[
                          const SizedBox(height: 10),
                          CampusTextField(
                            controller: _customCourse,
                            label: 'Custom course code',
                            hint: 'e.g. BSIT',
                            onChanged: (_) {
                              if (_courseError != null) {
                                setState(() => _courseError = null);
                              }
                            },
                          ),
                        ],
                        if (_courseError != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            _courseError!,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        Text(
                          'The course is shown wherever the section is '
                          'identified (`Section 4-1 · BSIT`).',
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        CampusTextField(
                          controller: _section,
                          label: 'Section',
                          hint: 'e.g. A',
                          errorText: _sectionError,
                        ),
                        const SizedBox(height: 12),
                        CampusTextField(
                          controller: _room,
                          label: 'Default room',
                          hint: 'e.g. CCIS Lab 3',
                          errorText: _roomError,
                        ),
                        const SizedBox(height: 12),
                        FacultyDropdown<String>(
                          label: 'Semester',
                          value: _semester,
                          hint: 'Select semester',
                          items: [
                            for (final semester in semesterOptions)
                              DropdownMenuItem<String>(
                                value: semester,
                                child: Text(
                                  semester,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: (value) {
                            if (value == null) return;
                            setState(() => _semester = value);
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Schedule',
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ),
                            TextButton.icon(
                              onPressed: _addScheduleRow,
                              icon: const Icon(Icons.add, size: 16),
                              label: const Text('Add'),
                            ),
                          ],
                        ),
                        for (
                          var index = 0;
                          index < _schedule.length;
                          index += 1
                        )
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: _ScheduleRowEditor(
                              row: _schedule[index],
                              onDayChanged: (day) =>
                                  setState(() => _schedule[index].day = day),
                              onRemove: _schedule.length == 1
                                  ? null
                                  : () => setState(() {
                                      _schedule.removeAt(index).dispose();
                                    }),
                            ),
                          ),
                        if (_scheduleError != null) ...[
                          const SizedBox(height: 8),
                          Text(
                            _scheduleError!,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  CampusButton(
                    label: 'Create section',
                    icon: Icons.add,
                    loading: _submitting,
                    onPressed: _submitting ? null : _submit,
                  ),
                ],
              ),
            ),
    );
  }
}

/// Searchable course catalog picker (Bug 2): the full unfiltered list was an
/// unsearchable full-screen sheet. The search field filters by program code
/// and name live, department group headers survive filtering, and the
/// "Other — specify manually" escape hatch stays reachable at the bottom.
class _CoursePickerSheet extends StatefulWidget {
  const _CoursePickerSheet({required this.selectedCode});

  final String selectedCode;

  @override
  State<_CoursePickerSheet> createState() => _CoursePickerSheetState();
}

class _CoursePickerSheetState extends State<_CoursePickerSheet> {
  final TextEditingController _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<PupCourseGroup> get _filteredGroups {
    final needle = _query.trim().toLowerCase();
    final groups = pupCoursesByDepartment();
    if (needle.isEmpty) return groups;
    return <PupCourseGroup>[
      for (final group in groups)
        PupCourseGroup(
          department: group.department,
          courses: <PupCourse>[
            for (final course in group.courses)
              if (course.code.toLowerCase().contains(needle) ||
                  course.name.toLowerCase().contains(needle))
                course,
          ],
        ),
    ]..removeWhere((group) => group.courses.isEmpty);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final groups = _filteredGroups;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        CampusTextField(
          key: const ValueKey('course-search'),
          controller: _search,
          label: 'Search',
          hint: 'Program code or name, e.g. BSIT',
          prefixIcon: Icons.search,
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: 8),
        if (groups.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Text(
              'No catalog course matches "$_query". '
              'Use "Other — specify manually" below.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          )
        else
          for (final group in groups) ...[
            Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 4),
              child: Text(
                group.department.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                ),
              ),
            ),
            for (final course in group.courses)
              ListTile(
                key: ValueKey('course-option-${course.code}'),
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text('${course.code} — ${course.name}'),
                trailing: widget.selectedCode == course.code
                    ? const Icon(Icons.check)
                    : null,
                onTap: () => Navigator.of(context).pop(course.code),
              ),
          ],
        const Divider(height: 20),
        ListTile(
          key: const ValueKey('course-option-custom'),
          dense: true,
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.edit_outlined, size: 18),
          title: const Text('Other — specify manually'),
          trailing: widget.selectedCode == customCourseOption
              ? const Icon(Icons.check)
              : null,
          onTap: () => Navigator.of(context).pop(customCourseOption),
        ),
      ],
    );
  }
}

class _ScheduleRowEditor extends StatelessWidget {
  const _ScheduleRowEditor({
    required this.row,
    required this.onDayChanged,
    this.onRemove,
  });

  final _ScheduleRow row;
  final ValueChanged<String> onDayChanged;
  final VoidCallback? onRemove;

  static const List<String> _days = <String>[
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ];

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(border: Border.all(color: tokens.borderSubtle)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: row.day,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Day',
                    isDense: true,
                  ),
                  items: [
                    for (final day in _days)
                      DropdownMenuItem<String>(value: day, child: Text(day)),
                  ],
                  onChanged: (value) {
                    if (value != null) onDayChanged(value);
                  },
                ),
              ),
              if (onRemove != null)
                IconButton(
                  tooltip: 'Remove meeting',
                  onPressed: onRemove,
                  icon: const Icon(Icons.delete_outline, size: 20),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: row.start,
                  keyboardType: TextInputType.datetime,
                  decoration: const InputDecoration(
                    labelText: 'Start (HH:mm)',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: row.end,
                  keyboardType: TextInputType.datetime,
                  decoration: const InputDecoration(
                    labelText: 'End (HH:mm)',
                    isDense: true,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: row.roomController,
            decoration: const InputDecoration(
              labelText: 'Room for this meeting (optional)',
              isDense: true,
            ),
          ),
        ],
      ),
    );
  }
}
