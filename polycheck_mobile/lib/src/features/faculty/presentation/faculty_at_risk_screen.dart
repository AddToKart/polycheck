import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import '../data/faculty_logic.dart';
import 'widgets/faculty_shell.dart';

/// Deterministic at-risk oversight + CHED CMO No. 40 referral workflow.
class FacultyAtRiskScreen extends ConsumerStatefulWidget {
  const FacultyAtRiskScreen({super.key});

  @override
  ConsumerState<FacultyAtRiskScreen> createState() =>
      _FacultyAtRiskScreenState();
}

class _FacultyAtRiskScreenState extends ConsumerState<FacultyAtRiskScreen> {
  bool _loading = true;
  String? _error;
  bool _referralsTab = false;
  String _search = '';
  List<StudentAtRisk> _rows = const <StudentAtRisk>[];
  List<AtRiskReferral> _referrals = const <AtRiskReferral>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    // Called from a pull-to-refresh, the initial frame, AND from the referral
    // flow after awaits — that last path can land post-unmount, where the
    // leading setState would throw (DD-F10).
    if (!mounted) return;
    setState(() {
      _loading = _rows.isEmpty;
      _error = null;
    });
    try {
      final results = await Future.wait<Object>(<Future<Object>>[
        ref.read(attendanceApiProvider).getAtRiskStudents(limit: 50),
        ref.read(attendanceApiProvider).getAtRiskReferrals(),
      ]);
      if (!mounted) return;
      setState(() {
        _rows = sortAtRiskRows(results[0] as List<StudentAtRisk>);
        _referrals = results[1] as List<AtRiskReferral>;
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
        _error = 'Unable to load at-risk students: $error';
      });
    }
  }

  bool get _canTransition {
    final session = ref.read(sessionProvider);
    return session.isSuperAdmin || session.isDepartmentHead;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final query = _search.trim().toLowerCase();
    final searched = query.isEmpty
        ? _rows
        : _rows
              .where(
                (row) =>
                    row.studentName.toLowerCase().contains(query) ||
                    (row.studentNumber ?? '').toLowerCase().contains(query) ||
                    row.sectionName.toLowerCase().contains(query),
              )
              .toList(growable: false);
    final groups = groupAtRiskBySection(searched);
    final belowCount = _rows
        .where((row) => row.status == AttendanceStandingStatus.belowThreshold)
        .length;
    final threshold = _rows.isEmpty ? 75 : _rows.first.thresholdPercent;

    return FacultyScaffold(
      title: 'At-risk students',
      subtitle:
          '$belowCount below the $threshold% threshold · ${_rows.length} tracked',
      body: _loading
          ? const FacultyLoading(label: 'Evaluating attendance.')
          : _error != null && _rows.isEmpty
          ? FacultyError(message: _error!, onRetry: _load)
          : FacultyPageBody(
              refresh: _load,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FacultyTabs(
                    labels: [
                      'Oversight list (${_rows.length})',
                      'Referrals (${_referrals.length})',
                    ],
                    selectedIndex: _referralsTab ? 1 : 0,
                    onSelected: (index) =>
                        setState(() => _referralsTab = index == 1),
                  ),
                  const SizedBox(height: 10),
                  if (!_referralsTab) ...[
                    CampusTextField(
                      hint: 'Search student, number, or section',
                      prefixIcon: Icons.search,
                      onChanged: (value) => setState(() => _search = value),
                    ),
                    const SizedBox(height: 10),
                    CampusCard(
                      child: Text(
                        'Rates count present + late over present + late + '
                        'absent + incomplete. Disputed, pending and excused '
                        'records are excluded. The list is deterministic — '
                        'teachers cannot hand-pick who is flagged.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (groups.isEmpty)
                      FacultyEmptyState(
                        icon: Icons.verified_outlined,
                        title: 'Everyone is on track',
                        message:
                            'No student is below the threshold or within two '
                            'absences of it.',
                      )
                    else
                      for (final group in groups) ...[
                        Padding(
                          padding: const EdgeInsets.only(top: 6, bottom: 4),
                          child: Text(
                            'Sec ${group.sectionName} · '
                            '${group.rows.first.subjectName}',
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: tokens.muted,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                        ),
                        for (final row in group.rows)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: _AtRiskCard(
                              row: row,
                              onOpenStudent: () => context.push(
                                '/faculty/students/${row.studentId}'
                                '?sectionId=${Uri.encodeComponent(row.sectionId)}',
                              ),
                              onReferral: canFileChedReferral(row)
                                  ? () => _fileReferral(row)
                                  : null,
                            ),
                          ),
                      ],
                  ] else
                    _referralsTabView(context, tokens),
                ],
              ),
            ),
    );
  }

  Widget _referralsTabView(BuildContext context, PupTokens tokens) {
    if (_referrals.isEmpty) {
      return FacultyEmptyState(
        icon: Icons.description_outlined,
        title: 'No CHED notices yet',
        message:
            'File a notice from the oversight list when a student is below '
            'the threshold or at risk.',
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final referral in _referrals)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: CampusCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          referral.studentName,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                      FacultyPill(
                        label:
                            referralStatusLabels[referral.status] ??
                            referral.status.wire,
                        background: referral.status == ReferralStatus.resolved
                            ? tokens.campus
                            : tokens.gold,
                        foreground: referral.status == ReferralStatus.resolved
                            ? tokens.onSurface
                            : tokens.deepMaroon,
                        border: referral.status == ReferralStatus.resolved
                            ? tokens.borderSubtle
                            : tokens.gold,
                      ),
                    ],
                  ),
                  Text(
                    '${referral.subjectName} · Sec ${referral.sectionName}',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                  Text(
                    'Filed ${formatDateTimeLabel(referral.createdAt)} by '
                    '${referral.generatedByName.isEmpty ? '—' : referral.generatedByName}',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                  if ((referral.note ?? '').trim().isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(referral.note!),
                    ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => _downloadNotice(referral),
                        icon: const Icon(
                          Icons.picture_as_pdf_outlined,
                          size: 16,
                        ),
                        label: const Text('CHED notice'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 44),
                        ),
                      ),
                      if (_canTransition &&
                          nextReferralStatus(referral.status) != null)
                        ElevatedButton(
                          onPressed: () => _advanceReferral(referral),
                          style: ElevatedButton.styleFrom(
                            minimumSize: const Size(0, 44),
                            shape: const RoundedRectangleBorder(
                              borderRadius: BorderRadius.zero,
                            ),
                          ),
                          child: Text(
                            'Mark '
                            '${referralStatusLabels[nextReferralStatus(referral.status)!]}',
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _fileReferral(StudentAtRisk row) async {
    final note = TextEditingController();
    final confirmed = await showCampusDialog<bool>(
      context,
      title: 'File CHED notice?',
      description:
          'CHED CMO No. 40 · Article V §21 notice of impending drop for '
          '${row.studentName} (${formatRatePercent(row.attendanceRate)} '
          'attendance). The slip is only issued while the deterministic engine '
          'flags the student.',
      child: CampusTextField(
        controller: note,
        label: 'Counselor note (optional)',
        hint: 'Context for the guidance office.',
        maxLines: 3,
        minLines: 2,
      ),
      actionBuilders: [
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: const Text('File notice'),
        ),
      ],
    );
    final noteText = note.text.trim();
    note.dispose();
    if (confirmed != true || !mounted) return;
    try {
      final referral = await ref
          .read(attendanceApiProvider)
          .generateAtRiskReferral(
            studentId: row.studentId,
            sectionId: row.sectionId,
            note: noteText.isEmpty ? null : noteText,
          );
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'CHED notice filed for ${row.studentName}.',
        tone: CampusToastTone.success,
      );
      await _downloadNotice(referral);
      await _load();
      if (!mounted) return;
      setState(() => _referralsTab = true);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        describeReferralError(error),
        tone: CampusToastTone.error,
      );
    } on Object catch (error) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Unable to file the CHED notice: $error',
        tone: CampusToastTone.error,
      );
    }
  }

  Future<void> _advanceReferral(AtRiskReferral referral) async {
    final next = nextReferralStatus(referral.status);
    if (next == null) return;
    final confirmed = await showFacultyConfirm(
      context,
      title: 'Mark ${referralStatusLabels[next]!.toLowerCase()}?',
      message:
          '${referral.studentName}\'s referral moves from '
          '${referralStatusLabels[referral.status]!.toLowerCase()} to '
          '${referralStatusLabels[next]!.toLowerCase()}. The generating teacher '
          'is notified.',
      confirmLabel: 'Update status',
    );
    if (!confirmed) return;
    try {
      await ref
          .read(attendanceApiProvider)
          .updateAtRiskReferral(referral.id, status: next);
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Referral updated to ${referralStatusLabels[next]}.',
        tone: CampusToastTone.success,
      );
      await _load();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } on Object catch (error) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Unable to update the referral: $error',
        tone: CampusToastTone.error,
      );
    }
  }

  Future<void> _downloadNotice(AtRiskReferral referral) async {
    try {
      final download = await ref
          .read(docsApiProvider)
          .atRiskNotice(referral.id);
      if (!mounted) return;
      await shareDownload(context, download);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } on Object catch (error) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Unable to download the CHED notice: $error',
        tone: CampusToastTone.error,
      );
    }
  }
}

class _AtRiskCard extends StatelessWidget {
  const _AtRiskCard({
    required this.row,
    required this.onOpenStudent,
    this.onReferral,
  });

  final StudentAtRisk row;
  final VoidCallback onOpenStudent;
  final VoidCallback? onReferral;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final below = row.status == AttendanceStandingStatus.belowThreshold;
    final atRisk = row.status == AttendanceStandingStatus.atRisk;
    return CampusCard(
      onTap: onOpenStudent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  row.studentName,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              FacultyPill(
                label: atRiskStatusLabels[row.status] ?? row.status.wire,
                background: below
                    ? tokens.maroon
                    : atRisk
                    ? tokens.gold
                    : tokens.campus,
                foreground: below
                    ? Colors.white
                    : atRisk
                    ? tokens.deepMaroon
                    : tokens.onSurface,
                border: below
                    ? tokens.maroon
                    : atRisk
                    ? tokens.gold
                    : tokens.borderSubtle,
              ),
            ],
          ),
          Text(
            '${row.studentNumber ?? ''} · ${row.professorName}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: FacultyRateBar(
                  value: row.attendanceRate,
                  height: 8,
                  color: below
                      ? tokens.maroon
                      : atRisk
                      ? tokens.gold
                      : (tokens.isDark ? tokens.gold : tokens.maroon),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                formatRatePercent(row.attendanceRate),
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              'threshold ${row.thresholdPercent}%',
              if (row.absencesBeforeBelowThreshold != null &&
                  row.absencesBeforeBelowThreshold! > 0)
                '${row.absencesBeforeBelowThreshold} absence(s) of slack',
              if (row.lastAbsenceDate != null &&
                  row.lastAbsenceDate!.isNotEmpty)
                'last absence ${row.lastAbsenceDate}',
            ].join(' · '),
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
          if (onReferral != null) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: onReferral,
              icon: const Icon(Icons.description_outlined, size: 16),
              label: const Text('File CHED notice'),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
            ),
          ],
        ],
      ),
    );
  }
}
