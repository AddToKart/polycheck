import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import '../data/session_wizard.dart';
import 'widgets/faculty_shell.dart';
import 'widgets/geofence_map.dart';

class _BulkEdit {
  _BulkEdit({
    required this.day,
    required String startTime,
    required String endTime,
    this.selected = true,
  }) : start = TextEditingController(text: startTime),
       end = TextEditingController(text: endTime);

  String day;
  bool selected;
  final TextEditingController start;
  final TextEditingController end;

  BulkSlotRow toRow() => BulkSlotRow(
    day: day,
    startTime: start.text.trim(),
    endTime: end.text.trim(),
    selected: selected,
  );

  void dispose() {
    start.dispose();
    end.dispose();
  }
}

/// Create one session or a recurring bulk set.
class SessionCreateScreen extends ConsumerStatefulWidget {
  const SessionCreateScreen({super.key, this.initialSectionId});

  final String? initialSectionId;

  @override
  ConsumerState<SessionCreateScreen> createState() =>
      _SessionCreateScreenState();
}

class _SessionCreateScreenState extends ConsumerState<SessionCreateScreen> {
  bool _loading = true;
  String? _error;
  bool _submitting = false;

  List<Subject> _subjects = const <Subject>[];
  List<Section> _sections = const <Section>[];
  List<Session> _existingSessions = const <Session>[];

  String _subjectId = '';
  String _sectionId = '';
  SessionMode _mode = SessionMode.inPerson;
  bool _bulkMode = false;
  bool _isRescheduled = false;

  final TextEditingController _date = TextEditingController();
  final TextEditingController _start = TextEditingController(text: '09:00');
  final TextEditingController _end = TextEditingController(text: '10:30');
  final TextEditingController _room = TextEditingController();
  final TextEditingController _bulkStart = TextEditingController();
  final TextEditingController _bulkEnd = TextEditingController();
  final TextEditingController _qrValidity = TextEditingController(text: '5');
  final TextEditingController _grace = TextEditingController(text: '15');

  List<_BulkEdit> _bulkEdits = <_BulkEdit>[];
  String _slotSelection = customSlotValue;

  double _latitude = defaultCampusLatitude;
  double _longitude = defaultCampusLongitude;
  double _radius = 40;

  @override
  void initState() {
    super.initState();
    _date.text = formatCampusDate();
    _bulkStart.text = formatCampusDate();
    final today = DateTime.now();
    _bulkEnd.text = formatDate(
      DateTime(today.year, today.month + 4, today.day),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    for (final controller in <TextEditingController>[
      _date,
      _start,
      _end,
      _room,
      _bulkStart,
      _bulkEnd,
      _qrValidity,
      _grace,
    ]) {
      controller.dispose();
    }
    _disposeBulkEdits();
    super.dispose();
  }

  void _disposeBulkEdits() {
    for (final row in _bulkEdits) {
      row.dispose();
    }
    _bulkEdits = <_BulkEdit>[];
  }

  Future<void> _load() async {
    final user = ref.read(sessionProvider).user;
    if (user == null) return;
    setState(() {
      _loading = _sections.isEmpty;
      _error = null;
    });
    try {
      final results = await Future.wait<Object>(<Future<Object>>[
        ref.read(subjectsApiProvider).getSubjects(),
        ref.read(sectionsApiProvider).getSections(),
        ref.read(settingsApiProvider).getSettings(),
      ]);
      if (!mounted) return;
      final subjects = results[0] as List<Subject>;
      final sections = (results[1] as List<Section>)
          .where((section) => section.teacherId == user.id)
          .toList(growable: false);
      final settings = results[2] as List<AppSetting>;
      final values = <String, String>{
        for (final setting in settings) setting.key: setting.value,
      };
      int? readInt(String key, int min, int max) {
        final parsed = int.tryParse(values[key]?.trim() ?? '');
        if (parsed == null || parsed < min || parsed > max) return null;
        return parsed;
      }

      final radius = readInt('default_geofence_radius_meters', 10, 500);
      final validity = readInt('default_qr_validity_minutes', 1, 15);
      final grace = readInt('default_grace_period_minutes', 0, 60);
      _radius = radius?.toDouble() ?? _radius;
      _qrValidity.text = '${validity ?? 5}';
      _grace.text = '${grace ?? 15}';

      setState(() {
        _subjects = subjects;
        _sections = sections;
        _loading = false;
      });
      final initial = widget.initialSectionId;
      if (initial != null) {
        final match = sections.where((section) => section.id == initial);
        if (match.isNotEmpty) _selectSection(match.first);
      }
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
        _error = 'Unable to load the wizard: $error';
      });
    }
  }

  Section? get _section {
    for (final candidate in _sections) {
      if (candidate.id == _sectionId) return candidate;
    }
    return null;
  }

  List<SessionSlot> get _scheduleSlots => scheduleSlotsForSection(_section);

  Future<void> _selectSection(Section section) async {
    final previous = _section;
    if (previous?.id == section.id) return;
    setState(() {
      _subjectId = section.subjectId;
      _sectionId = section.id;
      _room.text = section.room;
      _isRescheduled = false;
      final slots = scheduleSlotsForSection(section);
      _slotSelection = slots.isEmpty
          ? customSlotValue
          : defaultSlotSelection(slots, _date.text);
      final pick = applySlotPick(schedule: slots, selection: _slotSelection);
      if (pick != null) {
        _start.text = pick.startTime;
        _end.text = pick.endTime;
        if (pick.room != null && pick.room!.isNotEmpty) _room.text = pick.room!;
      }
      _disposeBulkEdits();
      _bulkEdits = [
        for (final row in buildBulkRows(slots, section.room))
          _BulkEdit(
            day: row.day,
            startTime: row.startTime,
            endTime: row.endTime,
            selected: row.selected,
          ),
      ];
      _error = null;
    });
    await _loadExistingSessions(section.id);
  }

  Future<void> _loadExistingSessions(String sectionId) async {
    try {
      final sessions = await ref
          .read(sessionsApiProvider)
          .getSessions(sectionId: sectionId);
      if (!mounted || _sectionId != sectionId) return;
      setState(() => _existingSessions = sessions);
    } catch (_) {
      if (!mounted) return;
      setState(() => _existingSessions = const <Session>[]);
    }
  }

  void _onSubjectChanged(String? subjectId) {
    if (subjectId == null) return;
    setState(() {
      _subjectId = subjectId;
      _sectionId = '';
      _existingSessions = const <Session>[];
      _disposeBulkEdits();
      _bulkEdits = <_BulkEdit>[];
    });
  }

  void _onDateChanged(String value) {
    setState(() {
      _date.text = value;
      final section = _section;
      if (section == null) return;
      final slots = scheduleSlotsForSection(section);
      if (slots.isEmpty) return;
      final selection = slotSelectionForDate(slots, value);
      _slotSelection = selection;
      final pick = applySlotPick(schedule: slots, selection: selection);
      if (pick != null) {
        _start.text = pick.startTime;
        _end.text = pick.endTime;
        if (pick.room != null && pick.room!.isNotEmpty) _room.text = pick.room!;
      }
    });
  }

  void _onSlotChanged(String? selection) {
    if (selection == null) return;
    setState(() {
      _slotSelection = selection;
      final pick = applySlotPick(
        schedule: _scheduleSlots,
        selection: selection,
      );
      if (pick == null) return;
      _date.text = pick.date;
      _start.text = pick.startTime;
      _end.text = pick.endTime;
      if (pick.room != null && pick.room!.isNotEmpty) _room.text = pick.room!;
    });
  }

  List<BulkSlotRow> get _bulkRows => [
    for (final row in _bulkEdits) row.toRow(),
  ];

  String? get _duplicateDate {
    final duplicate = duplicateSessionOnDate(_existingSessions, _date.text);
    if (duplicate == null || _isRescheduled) return null;
    return 'A session already exists on ${_date.text} '
        '(${formatTime(duplicate.startTime)} – ${formatTime(duplicate.endTime)}). '
        'Tick “make-up session” below to create an additional one.';
  }

  List<String> get _bulkConflicts => bulkConflictingDates(
    rows: _bulkRows,
    startDate: _bulkStart.text.trim(),
    endDate: _bulkEnd.text.trim(),
    existingDates: _existingSessions.map((session) => session.date).toSet(),
  );

  bool _validTime(String value) =>
      RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(value.trim());

  bool _validDate(String value) => parseCampusDate(value) != null;

  Future<void> _submit() async {
    if (_submitting) return;
    final user = ref.read(sessionProvider).user;
    final section = _section;
    final subject = _subjects.where((item) => item.id == _subjectId);
    if (user == null || section == null || subject.isEmpty) {
      setState(() => _error = 'Choose a subject and section first.');
      return;
    }
    final qrValidity = int.tryParse(_qrValidity.text.trim()) ?? 5;
    final grace = int.tryParse(_grace.text.trim()) ?? 15;
    if (qrValidity < minQrValidityMinutes ||
        qrValidity > maxQrValidityMinutes) {
      setState(() => _error = 'QR validity must be 1–15 minutes.');
      return;
    }
    if (grace < minGracePeriodMinutes || grace > maxGracePeriodMinutes) {
      setState(() => _error = 'Grace period must be 0–60 minutes.');
      return;
    }
    final geofence = _mode == SessionMode.inPerson
        ? GeofenceConfig(
            latitude: _latitude,
            longitude: _longitude,
            radiusMeters: _radius,
          )
        : null;
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      if (_bulkMode) {
        if (!_validDate(_bulkStart.text.trim()) ||
            !_validDate(_bulkEnd.text.trim())) {
          throw _FormIssue('Choose valid bulk start and end dates.');
        }
        final rows = _bulkRows;
        final invalid = firstInvalidSlotRow(rows);
        if (invalid != null) {
          throw _FormIssue(
            'Every selected meeting needs a start/end time with the end after '
            'the start (${invalid.day}).',
          );
        }
        if (rows.where((row) => row.selected).isEmpty) {
          throw _FormIssue('Select at least one class meeting.');
        }
        final conflicts = _bulkConflicts;
        if (conflicts.isNotEmpty) {
          throw _FormIssue(
            '${conflicts.length} date(s) already have a session for this '
            'section (${conflicts.take(3).join(', ')}). Remove them or choose '
            'a different range.',
          );
        }
        final input = buildBulkSessionInput(
          section: section,
          subjectName: subject.first.name,
          startDate: _bulkStart.text.trim(),
          endDate: _bulkEnd.text.trim(),
          rows: rows,
          teacherId: user.id,
          mode: _mode,
          room: _room.text.trim().isEmpty ? null : _room.text.trim(),
          qrValidityMinutes: qrValidity,
          gracePeriodMinutes: grace,
          geofence: geofence,
        );
        final created = await ref
            .read(sessionsApiProvider)
            .createBulkSessions(input);
        if (!mounted) return;
        CampusToast.showIn(
          context,
          '${created.length} session(s) created.',
          tone: CampusToastTone.success,
        );
        context.go('/faculty/sessions');
        return;
      }

      final date = _date.text.trim();
      if (!_validDate(date)) {
        throw _FormIssue('Choose a valid session date.');
      }
      if (!_validTime(_start.text) || !_validTime(_end.text)) {
        throw _FormIssue('Enter start/end times in 24-hour HH:mm form.');
      }
      if (_end.text.trim().compareTo(_start.text.trim()) <= 0) {
        throw _FormIssue('The end time must be after the start time.');
      }
      if (_duplicateDate != null) {
        throw _FormIssue(_duplicateDate!);
      }
      final duplicate = duplicateSessionOnDate(_existingSessions, date);
      final input = buildSingleSessionInput(
        section: section,
        subjectName: subject.first.name,
        date: date,
        startTime: _start.text.trim(),
        endTime: _end.text.trim(),
        teacherId: user.id,
        mode: _mode,
        room: _room.text.trim().isEmpty ? null : _room.text.trim(),
        qrValidityMinutes: qrValidity,
        gracePeriodMinutes: grace,
        geofence: geofence,
        isRescheduled: _isRescheduled && duplicate != null,
        rescheduledFromDate: duplicate?.date,
        originalScheduleTime: duplicate == null
            ? null
            : '${duplicate.startTime}-${duplicate.endTime}',
        originalRoom: duplicate?.room,
      );
      final created = await ref.read(sessionsApiProvider).createSession(input);
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Session created. Open the cockpit to arm the QR.',
        tone: CampusToastTone.success,
      );
      context.pushReplacement('/faculty/sessions/${created.id}');
    } on _FormIssue catch (issue) {
      if (mounted) setState(() => _error = issue.message);
    } on ApiRequestError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) setState(() => _error = 'Unable to create: $error');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _pickDate(
    TextEditingController controller,
    ValueChanged<String> onPicked,
  ) async {
    final initial = parseCampusDate(controller.text) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked == null) return;
    onPicked(formatDate(picked));
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final section = _section;
    final subjectSections = _sections
        .where(
          (candidate) =>
              _subjectId.isEmpty || candidate.subjectId == _subjectId,
        )
        .toList(growable: false);
    final slots = _scheduleSlots;
    final bulkCount = _bulkMode
        ? countSlotOccurrences(
            _bulkRows,
            _bulkStart.text.trim(),
            _bulkEnd.text.trim(),
          )
        : 0;
    final conflicts = _bulkMode ? _bulkConflicts : const <String>[];

    return FacultyScaffold(
      title: 'New session',
      subtitle: _bulkMode ? 'Recurring sessions' : 'Single class meeting',
      showDefaultActions: false,
      body: _loading
          ? const FacultyLoading(label: 'Loading the wizard.')
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
                        FacultyTabs(
                          labels: const ['In person', 'Online'],
                          selectedIndex: _mode == SessionMode.inPerson ? 0 : 1,
                          onSelected: (index) => setState(() {
                            _mode = index == 0
                                ? SessionMode.inPerson
                                : SessionMode.online;
                          }),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          modeHint(_mode),
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                        ),
                        const SizedBox(height: 12),
                        FacultyDropdown<String>(
                          label: 'Subject',
                          hint: 'Choose a subject',
                          value: _subjectId.isEmpty ? null : _subjectId,
                          items: [
                            for (final subject in _subjects)
                              DropdownMenuItem<String>(
                                value: subject.id,
                                child: Text(
                                  '${subject.name} (${subject.code})',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: _onSubjectChanged,
                        ),
                        const SizedBox(height: 12),
                        FacultyDropdown<String>(
                          label: 'Section',
                          hint: _subjectId.isEmpty
                              ? 'Choose a subject first'
                              : 'Choose a section',
                          value: _sectionId.isEmpty ? null : _sectionId,
                          enabled: _subjectId.isNotEmpty,
                          items: [
                            for (final candidate in subjectSections)
                              DropdownMenuItem<String>(
                                value: candidate.id,
                                child: Text(
                                  '${formatSectionHeading(section: candidate.section, course: candidate.course)} · '
                                  '${candidate.schedule.map((day) => day.day.wire).join('/')}',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: (value) {
                            if (value == null) return;
                            final match = _sections.where(
                              (candidate) => candidate.id == value,
                            );
                            if (match.isNotEmpty) _selectSection(match.first);
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
                                'Session window',
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ),
                            TextButton.icon(
                              onPressed: () => setState(() {
                                _bulkMode = !_bulkMode;
                                _error = null;
                              }),
                              icon: Icon(
                                _bulkMode
                                    ? Icons.looks_one_outlined
                                    : Icons.repeat,
                                size: 16,
                              ),
                              label: Text(_bulkMode ? 'Single' : 'Recurring'),
                            ),
                          ],
                        ),
                        if (!_bulkMode) ...[
                          _DateField(
                            label: 'Date',
                            controller: _date,
                            onChanged: _onDateChanged,
                            onPick: () => _pickDate(_date, _onDateChanged),
                          ),
                          const SizedBox(height: 10),
                          if (slots.isNotEmpty)
                            FacultyDropdown<String>(
                              label: 'Class meeting',
                              hint: 'Choose a meeting',
                              value: _slotSelection,
                              items: [
                                for (
                                  var index = 0;
                                  index < slots.length;
                                  index += 1
                                )
                                  DropdownMenuItem<String>(
                                    value: '$index',
                                    child: Text(
                                      slotLabel(slots[index]),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                const DropdownMenuItem<String>(
                                  value: customSlotValue,
                                  child: Text('Custom / make-up time'),
                                ),
                              ],
                              onChanged: _onSlotChanged,
                            ),
                          if (slots.isNotEmpty) const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: CampusTextField(
                                  controller: _start,
                                  label: 'Start (HH:mm)',
                                  keyboardType: TextInputType.datetime,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: CampusTextField(
                                  controller: _end,
                                  label: 'End (HH:mm)',
                                  keyboardType: TextInputType.datetime,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          CampusTextField(
                            controller: _room,
                            label: 'Room (optional)',
                            hint: 'e.g. CCIS Lab 3',
                          ),
                          if (_duplicateDate != null) ...[
                            const SizedBox(height: 10),
                            CampusCard(
                              borderColor: tokens.gold,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _duplicateDate!,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                  CheckboxListTile(
                                    contentPadding: EdgeInsets.zero,
                                    dense: true,
                                    value: _isRescheduled,
                                    onChanged: (value) => setState(
                                      () => _isRescheduled = value ?? false,
                                    ),
                                    title: const Text(
                                      'Create as a make-up / rescheduled session',
                                    ),
                                    controlAffinity:
                                        ListTileControlAffinity.leading,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ] else ...[
                          Row(
                            children: [
                              Expanded(
                                child: _DateField(
                                  label: 'First date',
                                  controller: _bulkStart,
                                  onChanged: (_) => setState(() {}),
                                  onPick: () => _pickDate(
                                    _bulkStart,
                                    (value) => setState(() {}),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _DateField(
                                  label: 'Last date',
                                  controller: _bulkEnd,
                                  onChanged: (_) => setState(() {}),
                                  onPick: () => _pickDate(
                                    _bulkEnd,
                                    (value) => setState(() {}),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          if (_bulkEdits.isEmpty)
                            Text(
                              'Choose a section with a schedule to build the '
                              'recurring meetings.',
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(color: tokens.muted),
                            )
                          else
                            for (final row in _bulkEdits) ...[
                              _BulkRowEditor(
                                row: row,
                                onChanged: () => setState(() {}),
                              ),
                              const SizedBox(height: 8),
                            ],
                          CampusCard(
                            child: Text(
                              '$bulkCount session(s) will be created.',
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                          ),
                          if (conflicts.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            CampusCard(
                              borderColor: tokens.gold,
                              child: Text(
                                '${conflicts.length} date(s) already have a '
                                'session for this section '
                                '(${conflicts.take(3).join(', ')}). The backend '
                                'rejects the whole request until the range is '
                                'clear.',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          _mode == SessionMode.inPerson
                              ? 'QR defaults (in person)'
                              : 'Checkpoint timing',
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 8),
                        if (_mode == SessionMode.inPerson) ...[
                          Row(
                            children: [
                              Expanded(
                                child: CampusTextField(
                                  controller: _qrValidity,
                                  label: 'QR validity (1–15 min)',
                                  keyboardType: TextInputType.number,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: CampusTextField(
                                  controller: _grace,
                                  label: 'Grace (0–60 min)',
                                  keyboardType: TextInputType.number,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Scans inside the QR window are Present; scans in '
                            'the grace window are Late. The session auto-ends '
                            'when grace expires.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ] else
                          Text(
                            'Online sessions use two 60–300 second checkpoints '
                            'configured in the cockpit. No location is '
                            'collected (RA 10173).',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          _mode == SessionMode.inPerson
                              ? 'Classroom geofence'
                              : 'Privacy',
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 8),
                        if (_mode == SessionMode.inPerson)
                          GeofenceMapPicker(
                            latitude: _latitude,
                            longitude: _longitude,
                            radiusMeters: _radius,
                            onChanged: (latitude, longitude) => setState(() {
                              _latitude = latitude;
                              _longitude = longitude;
                            }),
                            onRadiusChanged: (radius) =>
                                setState(() => _radius = radius),
                          )
                        else
                          Text(
                            'Online sessions collect no GPS. Students scan '
                            'both checkpoints from anywhere; the optional '
                            'meeting PIN blocks forwarded screenshots.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  CampusButton(
                    label: _bulkMode
                        ? 'Create $bulkCount session(s)'
                        : 'Create session',
                    icon: Icons.event_available_outlined,
                    loading: _submitting,
                    onPressed: _submitting || section == null ? null : _submit,
                  ),
                ],
              ),
            ),
    );
  }
}

class _FormIssue implements Exception {
  const _FormIssue(this.message);

  final String message;
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.controller,
    required this.onChanged,
    required this.onPick,
  });

  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    return CampusTextField(
      controller: controller,
      label: label,
      hint: 'YYYY-MM-DD',
      readOnly: true,
      onChanged: onChanged,
      suffix: IconButton(
        tooltip: 'Pick $label',
        onPressed: onPick,
        icon: const Icon(Icons.calendar_today_outlined, size: 18),
      ),
    );
  }
}

class _BulkRowEditor extends StatefulWidget {
  const _BulkRowEditor({required this.row, required this.onChanged});

  final _BulkEdit row;
  final VoidCallback onChanged;

  @override
  State<_BulkRowEditor> createState() => _BulkRowEditorState();
}

class _BulkRowEditorState extends State<_BulkRowEditor> {
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
              Checkbox(
                value: widget.row.selected,
                onChanged: (value) {
                  setState(() => widget.row.selected = value ?? true);
                  widget.onChanged();
                },
              ),
              Expanded(
                child: DropdownButton<String>(
                  value: widget.row.day,
                  isExpanded: true,
                  underline: const SizedBox.shrink(),
                  items: [
                    for (final day in _days)
                      DropdownMenuItem<String>(value: day, child: Text(day)),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() => widget.row.day = value);
                    widget.onChanged();
                  },
                ),
              ),
            ],
          ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: widget.row.start,
                  keyboardType: TextInputType.datetime,
                  onChanged: (_) {
                    setState(() {});
                    widget.onChanged();
                  },
                  decoration: const InputDecoration(
                    labelText: 'Start',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: widget.row.end,
                  keyboardType: TextInputType.datetime,
                  onChanged: (_) {
                    setState(() {});
                    widget.onChanged();
                  },
                  decoration: const InputDecoration(
                    labelText: 'End',
                    isDense: true,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
