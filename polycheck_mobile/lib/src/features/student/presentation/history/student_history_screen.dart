import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_dispute_options.dart';
import '../../data/student_excuses.dart';
import '../../data/student_providers.dart';
import '../common/student_app_bar_actions.dart';
import 'student_dispute_dialog.dart';
import 'student_excuse_dialog.dart';

enum _DatePreset {
  all('All time'),
  last7('Last 7 days'),
  last30('Last 30 days');

  const _DatePreset(this.label);

  final String label;

  int? get days => switch (this) {
    _DatePreset.all => null,
    _DatePreset.last7 => 7,
    _DatePreset.last30 => 30,
  };
}

class StudentHistoryScreen extends ConsumerStatefulWidget {
  const StudentHistoryScreen({super.key});

  @override
  ConsumerState<StudentHistoryScreen> createState() =>
      _StudentHistoryScreenState();
}

class _StudentHistoryScreenState extends ConsumerState<StudentHistoryScreen> {
  AttendanceStatus? _status;
  _DatePreset _preset = _DatePreset.all;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final attendanceAsync = ref.watch(myAttendanceProvider);
    final sectionsAsync = ref.watch(studentSectionsProvider);
    final subjectsAsync = ref.watch(studentSubjectsProvider);
    final records = attendanceAsync.value ?? const <AttendanceRecord>[];
    final sections = sectionsAsync.value ?? const <Section>[];
    final subjects = subjectsAsync.value ?? const <String, Subject>{};
    final sectionsById = <String, Section>{
      for (final section in sections) section.id: section,
    };
    final filtered = _filterRecords(records);

    return Scaffold(
      appBar: CampusHeader(
        title: 'Attendance history',
        subtitle: 'Review and report a record',
        actions: StudentAppBarActions.build(context),
      ),
      body: RefreshIndicator(
        color: tokens.maroon,
        onRefresh: () async {
          ref.invalidate(myAttendanceProvider);
          ref.invalidate(studentSectionsProvider);
          ref.invalidate(studentSubjectsProvider);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: <Widget>[
            Text(
              'STATUS',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: tokens.muted,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.4,
              ),
            ),
            const SizedBox(height: 6),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: <Widget>[
                  _FilterChip(
                    label: 'All',
                    selected: _status == null,
                    onTap: () => setState(() => _status = null),
                  ),
                  for (final status in <AttendanceStatus>[
                    AttendanceStatus.present,
                    AttendanceStatus.late,
                    AttendanceStatus.incomplete,
                    AttendanceStatus.absent,
                    AttendanceStatus.excused,
                    AttendanceStatus.disputed,
                  ])
                    _FilterChip(
                      label: attendanceStatusLabels[status]!,
                      selected: _status == status,
                      onTap: () => setState(() => _status = status),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'DATE RANGE',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: tokens.muted,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.4,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: <Widget>[
                for (final preset in _DatePreset.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: _FilterChip(
                      label: preset.label,
                      selected: _preset == preset,
                      onTap: () => setState(() => _preset = preset),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (attendanceAsync.isLoading && records.isEmpty)
              const CampusLoading(label: 'Loading attendance…')
            else if (filtered.isEmpty)
              CampusCard(
                child: CampusEmptyState(
                  icon: Icons.search_off,
                  title: 'No records in this view',
                  message: _status != null || _preset != _DatePreset.all
                      ? 'No records match the selected filters.'
                      : 'Your attendance records will appear after your first check-in.',
                ),
              )
            else
              for (final record in filtered) ...<Widget>[
                _HistoryCard(
                  record: record,
                  section: sectionsById[record.sectionId],
                  subject: _subjectFor(record, sectionsById, subjects),
                  onTap: () => _showRecordActions(
                    context,
                    ref,
                    record,
                    _subjectFor(record, sectionsById, subjects),
                    sectionsById[record.sectionId],
                  ),
                ),
                const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }

  List<AttendanceRecord> _filterRecords(List<AttendanceRecord> records) {
    final cutoffDays = _preset.days;
    final cutoff = cutoffDays == null
        ? null
        : DateTime.now().toUtc().subtract(Duration(days: cutoffDays));
    final filtered = <AttendanceRecord>[];
    for (final record in records) {
      if (_status != null && record.status != _status) continue;
      if (cutoff != null) {
        final at = DateTime.tryParse(record.timestamp);
        if (at != null && at.toUtc().isBefore(cutoff)) continue;
      }
      filtered.add(record);
    }
    filtered.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return filtered;
  }

  String _subjectFor(
    AttendanceRecord record,
    Map<String, Section> sectionsById,
    Map<String, Subject> subjects,
  ) {
    final section = sectionsById[record.sectionId];
    if (section == null) return record.sectionId;
    final subject = subjects[section.subjectId];
    final name = subject?.name.trim() ?? '';
    return name.isNotEmpty ? name : section.section;
  }

  Future<void> _showRecordActions(
    BuildContext context,
    WidgetRef ref,
    AttendanceRecord record,
    String subjectName,
    Section? section,
  ) async {
    final tokens = PupTheme.of(context);
    await showCampusBottomSheet<void>(
      context,
      title: subjectName,
      child: Builder(
        builder: (sheetContext) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Row(
                children: <Widget>[
                  if (record.isSynced)
                    CampusStatusBadge(status: record.status)
                  else
                    Text(
                      'Saved on device · awaiting confirmation',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: tokens.isDark ? tokens.gold : tokens.maroon,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  const Spacer(),
                  Text(
                    _formatRecordTime(record.timestamp),
                    style: Theme.of(
                      context,
                    ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (section != null)
                Text(
                  formatSectionHeading(
                    section: section.section,
                    course: section.course,
                  ),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              if (record.excuseStatus != null) ...<Widget>[
                const SizedBox(height: 8),
                Text(
                  'Excuse ${excuseStatusLabel(record.excuseStatus)}'
                  '${record.excuseReason != null ? ' · ${excuseReasonLabel(record.excuseReason)}' : ''}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              if (record.excuseReviewNote?.trim().isNotEmpty ==
                  true) ...<Widget>[
                const SizedBox(height: 4),
                Text(
                  'Review note: ${record.excuseReviewNote}',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
              if (record.disputeDescription?.trim().isNotEmpty ==
                  true) ...<Widget>[
                const SizedBox(height: 6),
                Text(
                  'Reported: ${record.disputeDescription}',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
              const SizedBox(height: 16),
              if (isExcuseEligible(record)) ...<Widget>[
                CampusButton(
                  label: record.excuseStatus == ExcuseStatus.rejected
                      ? 'Request excuse again'
                      : 'Request excuse',
                  icon: Icons.assignment_turned_in_outlined,
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    _openExcuseDialog(context, ref, record);
                  },
                ),
                const SizedBox(height: 8),
              ],
              CampusButton(
                label: record.status == AttendanceStatus.disputed
                    ? 'Dispute already sent'
                    : 'Report issue',
                icon: Icons.flag_outlined,
                variant: CampusButtonVariant.outline,
                onPressed:
                    record.isSynced &&
                        record.status != AttendanceStatus.disputed
                    ? () {
                        Navigator.of(sheetContext).pop();
                        _openDisputeDialog(context, ref, record);
                      }
                    : null,
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _openDisputeDialog(
    BuildContext context,
    WidgetRef ref,
    AttendanceRecord record,
  ) async {
    await showDialog<bool>(
      context: context,
      builder: (_) => StudentDisputeDialog(
        onSubmit: (reason, description) async {
          try {
            await ref
                .read(disputesApiProvider)
                .submitDispute(
                  recordId: record.id,
                  reason: reason,
                  description: description,
                );
            ref.invalidate(myAttendanceProvider);
            if (context.mounted) {
              CampusToast.showIn(
                context,
                'Issue reported. Your instructor can now review it.',
                tone: CampusToastTone.success,
              );
            }
            return null;
          } on ApiRequestError catch (error) {
            return describeDisputeSubmitError(error);
          } on Object {
            return disputeSubmitFallbackMessage;
          }
        },
      ),
    );
  }

  Future<void> _openExcuseDialog(
    BuildContext context,
    WidgetRef ref,
    AttendanceRecord record,
  ) async {
    await showDialog<bool>(
      context: context,
      builder: (_) => StudentExcuseDialog(
        onSubmit: (reason, description, evidenceData) async {
          try {
            await ref
                .read(attendanceApiProvider)
                .requestExcuse(
                  record.id,
                  reason: reason,
                  description: description,
                  evidenceData: evidenceData,
                );
            ref.invalidate(myAttendanceProvider);
            if (context.mounted) {
              CampusToast.showIn(
                context,
                'Excuse requested. Your instructor will review it.',
                tone: CampusToastTone.success,
              );
            }
            return null;
          } on ApiRequestError catch (error) {
            return error.message.trim().isEmpty
                ? 'Unable to request an excuse. Try again.'
                : error.message.trim();
          } on Object {
            return 'Unable to request an excuse. Try again.';
          }
        },
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Semantics(
      selected: selected,
      button: true,
      label: label,
      child: Padding(
        padding: const EdgeInsets.only(right: 8),
        child: Material(
          color: selected
              ? (tokens.isDark ? tokens.gold : tokens.maroon)
              : tokens.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.zero,
            side: BorderSide(
              color: selected
                  ? (tokens.isDark ? tokens.gold : tokens.maroon)
                  : tokens.borderSubtle,
            ),
          ),
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              child: Text(
                label.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: selected
                      ? (tokens.isDark ? tokens.deepMaroon : Colors.white)
                      : tokens.onSurface,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({
    required this.record,
    required this.subject,
    required this.onTap,
    this.section,
  });

  final AttendanceRecord record;
  final String subject;
  final Section? section;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final style = attendanceStatusStyle(record.status, isDark: tokens.isDark);
    return CampusCard(
      onTap: onTap,
      semanticLabel: 'Open $subject attendance record',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: tokens.maroon.withValues(
                alpha: tokens.isDark ? 0.22 : 0.05,
              ),
              border: Border.all(color: tokens.borderSubtle),
            ),
            child: Icon(
              style.icon,
              size: 19,
              color: tokens.isDark ? tokens.gold : tokens.maroon,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  subject,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  section == null
                      ? record.sectionId
                      : formatSectionHeading(
                          section: section!.section,
                          course: section!.course,
                        ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                ),
                const SizedBox(height: 2),
                Text(
                  _formatRecordTime(record.timestamp),
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: tokens.muted),
                ),
                if (record.excuseStatus != null) ...<Widget>[
                  const SizedBox(height: 5),
                  Text(
                    'EXCUSE ${excuseStatusLabel(record.excuseStatus).toUpperCase()}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: tokens.isDark ? tokens.gold : tokens.maroon,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 6),
          if (record.isSynced)
            CampusStatusBadge(status: record.status, dense: true)
          else
            Text(
              'Pending sync',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: tokens.isDark ? tokens.gold : tokens.maroon,
                fontWeight: FontWeight.w700,
              ),
            ),
        ],
      ),
    );
  }
}

String _formatRecordTime(String raw) {
  final parsed = DateTime.tryParse(raw)?.toLocal();
  if (parsed == null) return raw;
  final month = getMonthName(parsed.month - 1);
  final shortMonth = month.length >= 3 ? month.substring(0, 3) : month;
  final time = formatTime(
    '${parsed.hour.toString().padLeft(2, '0')}:'
    '${parsed.minute.toString().padLeft(2, '0')}',
  );
  return '$shortMonth ${parsed.day}, ${parsed.year} · $time';
}
