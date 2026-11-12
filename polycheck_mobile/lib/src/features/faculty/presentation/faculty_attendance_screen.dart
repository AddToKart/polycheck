import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import '../data/faculty_logic.dart';
import 'widgets/attendance_donut.dart';
import 'widgets/faculty_shell.dart';

/// Attendance overview: filters, donut, section rows, CSV export.
class FacultyAttendanceScreen extends ConsumerStatefulWidget {
  const FacultyAttendanceScreen({super.key});

  @override
  ConsumerState<FacultyAttendanceScreen> createState() =>
      _FacultyAttendanceScreenState();
}

class _FacultyAttendanceScreenState
    extends ConsumerState<FacultyAttendanceScreen> {
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
  bool _exporting = false;

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
      final sectionsApi = ref.read(sectionsApiProvider);
      final results = await Future.wait<Object?>(<Future<Object?>>[
        ref.read(subjectsApiProvider).getSubjects(),
        sectionsApi.getSections(),
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
        _error = 'Unable to load the attendance report: $error';
      });
    }
  }

  Future<void> _pickDate({required bool isStart}) async {
    final current = parseCampusDate(isStart ? _startDate : _endDate);
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = formatDate(picked);
      } else {
        _endDate = formatDate(picked);
      }
    });
    await _load();
  }

  Future<void> _exportCsv() async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      final csv = await ref
          .read(dashboardApiProvider)
          .exportAttendanceCsv(_filters);
      if (!mounted) return;
      await shareCsvText(context, csv, 'polycheck-attendance.csv');
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final report = _report;
    final totals = report?.totals;
    final sectionsById = <String, Section>{
      for (final section in _sections) section.id: section,
    };
    final subjectSections = _subjectId.isEmpty
        ? _sections
        : _sections
              .where((section) => section.subjectId == _subjectId)
              .toList(growable: false);
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

    return FacultyScaffold(
      title: 'Attendance',
      subtitle: report == null
          ? null
          : '${report.range.startDate} → ${report.range.endDate}',
      actions: [
        IconButton(
          tooltip: 'Export CSV',
          onPressed: _exporting ? null : _exportCsv,
          icon: _exporting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.download_outlined),
        ),
      ],
      body: _loading
          ? const FacultyLoading(label: 'Loading attendance.')
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
                              if (_sectionId.isNotEmpty &&
                                  !_sections.any(
                                    (section) =>
                                        section.id == _sectionId &&
                                        (_subjectId.isEmpty ||
                                            section.subjectId == _subjectId),
                                  )) {
                                _sectionId = '';
                              }
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
                            for (final section in subjectSections)
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
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => _pickDate(isStart: true),
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
                                onPressed: () => _pickDate(isStart: false),
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
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (totals != null) ...[
                    CampusCard(
                      child: Column(
                        children: [
                          AttendanceDonut(segments: segments),
                          const SizedBox(height: 8),
                          DonutLegend(segments: segments),
                          const SizedBox(height: 12),
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
                            'Attendance rate = present + late over counted '
                            'records (${countedSessionRecords(present: totals.present, late: totals.late, absent: totals.absent, incomplete: totals.incomplete)}).',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    FacultyStatGrid(
                      children: [
                        FacultyStatCard(
                          label: 'Present',
                          value: '${totals.present}',
                          icon: Icons.check_circle_outline,
                        ),
                        FacultyStatCard(
                          label: 'Late',
                          value: '${totals.late}',
                          icon: Icons.schedule,
                        ),
                        FacultyStatCard(
                          label: 'Absent',
                          value: '${totals.absent}',
                          icon: Icons.cancel_outlined,
                        ),
                        FacultyStatCard(
                          label: 'Incomplete',
                          value: '${totals.incomplete}',
                          icon: Icons.timelapse,
                        ),
                        FacultyStatCard(
                          label: 'Excused',
                          value: '${totals.excused}',
                          icon: Icons.event_available_outlined,
                        ),
                        FacultyStatCard(
                          label: 'Sessions',
                          value: '${totals.totalSessions}',
                          icon: Icons.event_note_outlined,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],
                  FacultySectionTitle(
                    title: 'Per section (${report?.summaries.length ?? 0})',
                  ),
                  if ((report?.summaries ?? const []).isEmpty)
                    FacultyEmptyState(
                      icon: Icons.fact_check_outlined,
                      title: 'No attendance in this window',
                      message:
                          'Change the date range or filters, or run a session '
                          'to start collecting records.',
                    )
                  else
                    for (final summary in report!.summaries)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: _SectionReportRow(
                          summary: summary,
                          section: sectionsById[summary.sectionId],
                          onTap: () => context.push(
                            '/faculty/sections/${summary.sectionId}',
                          ),
                        ),
                      ),
                ],
              ),
            ),
    );
  }
}

class _SectionReportRow extends StatelessWidget {
  const _SectionReportRow({
    required this.summary,
    required this.section,
    required this.onTap,
  });

  final AttendanceReportSummary summary;
  final Section? section;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final rate = attendanceRatePercent(
      present: summary.present,
      late: summary.late,
      absent: summary.absent,
      incomplete: summary.incomplete,
    );
    return CampusCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  section == null
                      ? summary.sectionId
                      : formatSectionHeading(
                          section: section!.section,
                          course: section!.course,
                        ),
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                '${summary.totalSessions} sessions',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
            ],
          ),
          Text(
            summary.subjectName,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(child: FacultyRateBar(value: rate)),
              const SizedBox(width: 10),
              Text(
                formatRatePercent(rate),
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              FacultyPill(label: 'P ${summary.present}'),
              FacultyPill(label: 'L ${summary.late}'),
              FacultyPill(label: 'A ${summary.absent}'),
              if (summary.incomplete > 0)
                FacultyPill(label: 'INC ${summary.incomplete}'),
              if (summary.excused > 0)
                FacultyPill(label: 'E ${summary.excused}'),
              if (summary.disputed > 0)
                FacultyPill(label: 'D ${summary.disputed}'),
            ],
          ),
        ],
      ),
    );
  }
}
