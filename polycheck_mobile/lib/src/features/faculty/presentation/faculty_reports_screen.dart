import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import '../data/faculty_csv.dart';
import '../data/faculty_logic.dart';
import 'widgets/attendance_donut.dart';
import 'widgets/faculty_shell.dart';

/// Reports and exports: analytics, per-section comparison, CSV, and the PUP
/// document downloads (master list, class record, session attendance).
class FacultyReportsScreen extends ConsumerStatefulWidget {
  const FacultyReportsScreen({super.key});

  @override
  ConsumerState<FacultyReportsScreen> createState() =>
      _FacultyReportsScreenState();
}

class _FacultyReportsScreenState extends ConsumerState<FacultyReportsScreen> {
  final CampusDateRange _initialRange = getRecentCampusDateRange(30);
  late String _startDate = _initialRange.startDate;
  late String _endDate = _initialRange.endDate;
  String _subjectId = '';
  String _sectionId = '';

  bool _loading = true;
  String? _error;
  AttendanceReport? _report;
  List<Subject> _subjects = const <Subject>[];
  List<Section> _sections = const <Section>[];
  String _docSectionId = '';
  String _docSessionId = '';
  List<Session> _docSessions = const <Session>[];
  String? _busy;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  AttendanceReportFilters get _filters => AttendanceReportFilters(
    startDate: _startDate,
    endDate: _endDate,
    subjectId: _subjectId.isEmpty ? null : _subjectId,
    sectionId: _sectionId.isEmpty ? null : _sectionId,
  );

  Future<void> _load() async {
    setState(() {
      _loading = _report == null;
      _error = null;
    });
    try {
      final results = await Future.wait<Object?>(<Future<Object?>>[
        ref.read(subjectsApiProvider).getSubjects(),
        ref.read(sectionsApiProvider).getSections(),
        ref.read(attendanceApiProvider).getAttendanceReport(_filters),
      ]);
      if (!mounted) return;
      setState(() {
        _subjects = results[0] as List<Subject>? ?? const [];
        _sections = results[1] as List<Section>? ?? const [];
        _report = results[2] as AttendanceReport?;
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
        _error = 'Unable to load reports: $error';
      });
    }
  }

  Future<void> _loadDocSessions(String sectionId) async {
    setState(() {
      _docSectionId = sectionId;
      _docSessionId = '';
      _docSessions = const <Session>[];
    });
    if (sectionId.isEmpty) return;
    try {
      final sessions = await ref
          .read(sessionsApiProvider)
          .getSectionSessions(sectionId);
      if (!mounted || _docSectionId != sectionId) return;
      setState(() {
        _docSessions = sessions.toList(growable: false)
          ..sort((a, b) => b.date.compareTo(a.date));
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _docSessions = const <Session>[]);
    }
  }

  Future<void> _exportCsv() async {
    if (_busy != null) return;
    setState(() => _busy = 'csv');
    try {
      final csv = await ref
          .read(dashboardApiProvider)
          .exportAttendanceCsv(_filters);
      if (!mounted) return;
      await shareCsvText(context, csv, 'polycheck-attendance-report.csv');
    } on ApiRequestError catch (error) {
      // Offline-first fallback: build the same CSV from the cached/queried
      // records for the active window.
      if (error.isNetworkFailure) {
        await _exportLocalCsv();
      } else if (mounted) {
        CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
      }
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _exportLocalCsv() async {
    try {
      final records = await ref
          .read(attendanceApiProvider)
          .getAttendanceRecords(startDate: _startDate, endDate: _endDate);
      final scopedSections = _sectionId.isNotEmpty
          ? _sections.where((section) => section.id == _sectionId)
          : _subjectId.isNotEmpty
          ? _sections.where((section) => section.subjectId == _subjectId)
          : _sections;
      final sectionIds = scopedSections.map((section) => section.id).toSet();
      final filtered = records
          .where((record) => sectionIds.contains(record.sectionId))
          .toList(growable: false);
      final subjectsById = <String, String>{
        for (final subject in _subjects) subject.id: subject.name,
      };
      final csv = buildAttendanceCsv(
        filtered,
        sectionsById: {
          for (final section in scopedSections) section.id: section,
        },
        subjectNames: {
          for (final section in scopedSections)
            section.id: subjectsById[section.subjectId] ?? '',
        },
      );
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Server export unavailable — sharing the on-device CSV.',
        tone: CampusToastTone.warning,
      );
      await shareCsvText(context, csv, 'polycheck-attendance-report.csv');
    } catch (error) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Unable to build the CSV: $error',
        tone: CampusToastTone.error,
      );
    }
  }

  Future<void> _downloadMasterList(String format) async {
    if (_docSectionId.isEmpty || _busy != null) return;
    setState(() => _busy = 'master-$format');
    try {
      final download = await ref
          .read(docsApiProvider)
          .masterList(_docSectionId, format: format);
      if (!mounted) return;
      await shareDownload(context, download);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _downloadClassRecord(String format) async {
    if (_docSectionId.isEmpty || _busy != null) return;
    setState(() => _busy = 'class-$format');
    try {
      final download = await ref
          .read(docsApiProvider)
          .classRecord(_docSectionId, format: format);
      if (!mounted) return;
      await shareDownload(context, download);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _downloadSession(String format) async {
    if (_docSessionId.isEmpty || _busy != null) return;
    setState(() => _busy = 'session-$format');
    try {
      final download = await ref
          .read(docsApiProvider)
          .sessionAttendance(_docSessionId, format: format);
      if (!mounted) return;
      await shareDownload(context, download);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final report = _report;
    final totals = report?.totals;
    final segments = totals == null
        ? const <DonutSegment>[]
        : buildDonutSegments(totals, tokens: tokens);
    final rate = totals == null
        ? null
        : attendanceRatePercent(
            present: totals.present,
            late: totals.late,
            absent: totals.absent,
            incomplete: totals.incomplete,
          );
    final summaries = [...?report?.summaries]
      ..sort((a, b) {
        final left =
            attendanceRatePercent(
              present: a.present,
              late: a.late,
              absent: a.absent,
              incomplete: a.incomplete,
            ) ??
            101;
        final right =
            attendanceRatePercent(
              present: b.present,
              late: b.late,
              absent: b.absent,
              incomplete: b.incomplete,
            ) ??
            101;
        return left.compareTo(right);
      });
    final sectionsById = <String, Section>{
      for (final section in _sections) section.id: section,
    };

    return FacultyScaffold(
      title: 'Reports',
      actions: [
        IconButton(
          tooltip: 'Export CSV',
          onPressed: _busy == null ? _exportCsv : null,
          icon: _busy == 'csv'
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.download_outlined),
        ),
      ],
      body: _loading
          ? const FacultyLoading(label: 'Building reports.')
          : _error != null && report == null
          ? FacultyError(message: _error!, onRetry: _load)
          : FacultyPageBody(
              refresh: _load,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () async {
                                  final picked = await showDatePicker(
                                    context: context,
                                    initialDate:
                                        parseCampusDate(_startDate) ??
                                        DateTime.now(),
                                    firstDate: DateTime(2020),
                                    lastDate: DateTime(2035),
                                  );
                                  if (picked == null) return;
                                  setState(
                                    () => _startDate = formatDate(picked),
                                  );
                                  await _load();
                                },
                                icon: const Icon(
                                  Icons.calendar_today_outlined,
                                  size: 14,
                                ),
                                label: Text('From $_startDate'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () async {
                                  final picked = await showDatePicker(
                                    context: context,
                                    initialDate:
                                        parseCampusDate(_endDate) ??
                                        DateTime.now(),
                                    firstDate: DateTime(2020),
                                    lastDate: DateTime(2035),
                                  );
                                  if (picked == null) return;
                                  setState(() => _endDate = formatDate(picked));
                                  await _load();
                                },
                                icon: const Icon(
                                  Icons.calendar_today_outlined,
                                  size: 14,
                                ),
                                label: Text('To $_endDate'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        FacultyDropdown<String>(
                          label: 'Subject',
                          hint: 'All subjects',
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
                          onChanged: (value) {
                            setState(() {
                              _subjectId = value ?? '';
                              _sectionId = '';
                            });
                            _load();
                          },
                        ),
                        const SizedBox(height: 10),
                        FacultyDropdown<String>(
                          label: 'Section',
                          hint: 'All sections',
                          value: _sectionId.isEmpty ? null : _sectionId,
                          items: [
                            for (final section in _sections.where(
                              (section) =>
                                  _subjectId.isEmpty ||
                                  section.subjectId == _subjectId,
                            ))
                              DropdownMenuItem<String>(
                                value: section.id,
                                child: Text(
                                  formatSectionHeading(
                                    section: section.section,
                                    course: section.course,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: (value) {
                            setState(() => _sectionId = value ?? '');
                            _load();
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (totals != null)
                    CampusCard(
                      child: Column(
                        children: [
                          AttendanceDonut(segments: segments),
                          const SizedBox(height: 8),
                          DonutLegend(segments: segments),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: FacultyRateBar(value: rate, height: 10),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                formatRatePercent(rate),
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${totals.totalSessions} session(s) · '
                            '${totals.totalRecords} record(s) · '
                            '${totals.pending} pending · ${totals.disputed} disputed',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 14),
                  FacultySectionTitle(
                    title: 'Section comparison (worst first)',
                  ),
                  if (summaries.isEmpty)
                    FacultyEmptyState(
                      icon: Icons.insights_outlined,
                      title: 'Nothing to compare yet',
                      message: 'Run a session to collect attendance records.',
                    )
                  else
                    for (final summary in summaries)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: CampusCard(
                          onTap: () => context.push(
                            '/faculty/sections/${summary.sectionId}',
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      sectionsById[summary.sectionId] == null
                                          ? summary.sectionId
                                          : formatSectionHeading(
                                              section:
                                                  sectionsById[summary
                                                          .sectionId]!
                                                      .section,
                                              course:
                                                  sectionsById[summary
                                                          .sectionId]!
                                                      .course,
                                            ),
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ),
                                  Text(
                                    formatRatePercent(
                                      attendanceRatePercent(
                                        present: summary.present,
                                        late: summary.late,
                                        absent: summary.absent,
                                        incomplete: summary.incomplete,
                                      ),
                                    ),
                                    style: Theme.of(context).textTheme.bodySmall
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                ],
                              ),
                              Text(
                                summary.subjectName,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: tokens.muted),
                              ),
                              const SizedBox(height: 5),
                              FacultyRateBar(
                                value: attendanceRatePercent(
                                  present: summary.present,
                                  late: summary.late,
                                  absent: summary.absent,
                                  incomplete: summary.incomplete,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  const SizedBox(height: 18),
                  FacultySectionTitle(title: 'Document downloads'),
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        FacultyDropdown<String>(
                          label: 'Section',
                          hint: 'Choose a section',
                          value: _docSectionId.isEmpty ? null : _docSectionId,
                          items: [
                            for (final section in _sections)
                              DropdownMenuItem<String>(
                                value: section.id,
                                child: Text(
                                  formatSectionHeading(
                                    section: section.section,
                                    course: section.course,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: (value) => _loadDocSessions(value ?? ''),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _docSectionId.isEmpty
                                    ? null
                                    : () => _downloadMasterList('pdf'),
                                icon: const Icon(
                                  Icons.picture_as_pdf_outlined,
                                  size: 16,
                                ),
                                label: const Text('Master list PDF'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _docSectionId.isEmpty
                                    ? null
                                    : () => _downloadMasterList('docx'),
                                icon: const Icon(
                                  Icons.description_outlined,
                                  size: 16,
                                ),
                                label: const Text('Master list DOCX'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _docSectionId.isEmpty
                                    ? null
                                    : () => _downloadClassRecord('pdf'),
                                icon: const Icon(
                                  Icons.table_chart_outlined,
                                  size: 16,
                                ),
                                label: const Text('Class record PDF'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _docSectionId.isEmpty
                                    ? null
                                    : () => _downloadClassRecord('docx'),
                                icon: const Icon(
                                  Icons.table_chart_outlined,
                                  size: 16,
                                ),
                                label: const Text('Class record DOCX'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        FacultyDropdown<String>(
                          label: 'Session',
                          hint: _docSectionId.isEmpty
                              ? 'Choose a section first'
                              : 'Choose a session',
                          value: _docSessionId.isEmpty ? null : _docSessionId,
                          enabled: _docSessions.isNotEmpty,
                          items: [
                            for (final session in _docSessions)
                              DropdownMenuItem<String>(
                                value: session.id,
                                child: Text(
                                  '${session.date} · '
                                  '${formatTime(session.startTime)}',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: (value) =>
                              setState(() => _docSessionId = value ?? ''),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _docSessionId.isEmpty
                                    ? null
                                    : () => _downloadSession('csv'),
                                icon: const Icon(
                                  Icons.grid_on_outlined,
                                  size: 16,
                                ),
                                label: const Text('Session CSV'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _docSessionId.isEmpty
                                    ? null
                                    : () => _downloadSession('pdf'),
                                icon: const Icon(
                                  Icons.picture_as_pdf_outlined,
                                  size: 16,
                                ),
                                label: const Text('Session PDF'),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 44),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
