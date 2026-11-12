import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/polycheck_core.dart';
import '../data/faculty_logic.dart';
import 'widgets/faculty_shell.dart';

/// Statuses the override row may send, mirroring the backend
/// `ResolveDisputeDto.newStatus` allowlist (`disputes.controller.ts`).
///
/// `excused` is in the shared `AttendanceStatus` union but NOT in the DTO
/// allowlist, so offering it produced a 400 mid-review (DD-F6). The three
/// reviewable outcomes are exactly present / late / absent.
const List<AttendanceStatus> disputeOverrideStatuses = <AttendanceStatus>[
  AttendanceStatus.present,
  AttendanceStatus.late,
  AttendanceStatus.absent,
];

/// Teacher dispute rail: pending/resolved tabs, section filter, telemetry
/// drawer with the deterministic recommendation, Accept / Reject / Override.
class FacultyDisputesScreen extends ConsumerStatefulWidget {
  const FacultyDisputesScreen({super.key});

  @override
  ConsumerState<FacultyDisputesScreen> createState() =>
      _FacultyDisputesScreenState();
}

class _FacultyDisputesScreenState extends ConsumerState<FacultyDisputesScreen> {
  bool _loading = true;
  String? _error;
  bool _resolvedTab = false;
  String _sectionFilter = '';
  List<AttendanceRecord> _records = const <AttendanceRecord>[];
  List<Section> _sections = const <Section>[];
  List<Session> _sessions = const <Session>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = _records.isEmpty;
      _error = null;
    });
    try {
      final results = await Future.wait<Object>(<Future<Object>>[
        ref.read(disputesApiProvider).getDisputedRecords(),
        ref.read(sectionsApiProvider).getSections(),
        ref.read(sessionsApiProvider).getSessions(),
      ]);
      if (!mounted) return;
      setState(() {
        _records = results[0] as List<AttendanceRecord>;
        _sections = results[1] as List<Section>;
        _sessions = results[2] as List<Session>;
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
        _error = 'Unable to load disputes: $error';
      });
    }
  }

  String _sessionLabel(String sessionId) {
    for (final session in _sessions) {
      if (session.id != sessionId) continue;
      final section = _sections.where(
        (candidate) => candidate.id == session.sectionId,
      );
      final heading = section.isEmpty
          ? 'Sec ${session.sectionId}'
          : formatSectionHeading(
              section: section.first.section,
              course: section.first.course,
            );
      return '${session.subjectName} · $heading · ${session.date}';
    }
    return sessionId;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final pending = _records
        .where((record) => !record.disputeResolved)
        .toList(growable: false);
    final resolved = _records
        .where((record) => record.disputeResolved)
        .toList(growable: false);
    final tabRows = _resolvedTab ? resolved : pending;
    final scoped = _sectionFilter.isEmpty
        ? tabRows
        : tabRows
              .where((record) => record.sectionId == _sectionFilter)
              .toList(growable: false);
    final sectionsById = <String, Section>{
      for (final section in _sections) section.id: section,
    };
    final sessionLabels = <String, String>{
      for (final record in scoped)
        record.sessionId: _sessionLabel(record.sessionId),
    };
    final groups = groupDisputes(
      scoped,
      sectionsById: sectionsById,
      sessionLabels: sessionLabels,
    );

    return FacultyScaffold(
      title: 'Disputes',
      subtitle: '${pending.length} pending · ${resolved.length} resolved',
      body: _loading
          ? const FacultyLoading(label: 'Loading disputes.')
          : _error != null && _records.isEmpty
          ? FacultyError(message: _error!, onRetry: _load)
          : FacultyPageBody(
              refresh: _load,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FacultyTabs(
                    labels: [
                      'Pending (${pending.length})',
                      'Resolved (${resolved.length})',
                    ],
                    selectedIndex: _resolvedTab ? 1 : 0,
                    onSelected: (index) =>
                        setState(() => _resolvedTab = index == 1),
                  ),
                  const SizedBox(height: 10),
                  FacultyDropdown<String>(
                    label: 'Section',
                    hint: 'All sections',
                    value: _sectionFilter.isEmpty ? null : _sectionFilter,
                    items: [
                      for (final section in _sections)
                        DropdownMenuItem<String>(
                          value: section.id,
                          child: Text(
                            '${formatSectionHeading(section: section.section, course: section.course)} · ${section.room}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: (value) =>
                        setState(() => _sectionFilter = value ?? ''),
                  ),
                  const SizedBox(height: 10),
                  if (groups.isEmpty)
                    FacultyEmptyState(
                      icon: Icons.gavel_outlined,
                      title: _resolvedTab
                          ? 'No resolved disputes yet'
                          : 'No pending disputes',
                      message:
                          'Every flagged record is reviewed. New disputes '
                          'appear here in real time after a scan syncs.',
                    )
                  else
                    for (final group in groups) ...[
                      Padding(
                        padding: const EdgeInsets.only(top: 6, bottom: 6),
                        child: Text(
                          group.subjectName,
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                color: tokens.muted,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.4,
                              ),
                        ),
                      ),
                      for (
                        var index = 0;
                        index < group.records.length;
                        index += 1
                      ) ...[
                        if (index == 0 ||
                            group.records[index].sessionId !=
                                group.records[index - 1].sessionId)
                          Padding(
                            padding: const EdgeInsets.only(top: 4, bottom: 4),
                            child: Text(
                              _sessionLabel(group.records[index].sessionId),
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: tokens.muted,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: _DisputeCard(
                            record: group.records[index],
                            sessionLabel: _sessionLabel(
                              group.records[index].sessionId,
                            ),
                            reasonLabel: disputeReasonLabel(
                              group.records[index].disputeReason,
                            ),
                            reasonIcon: disputeReasonIcon(
                              group.records[index].disputeReason,
                            ),
                            onTap: () => _openDetail(group.records[index]),
                          ),
                        ),
                      ],
                    ],
                ],
              ),
            ),
    );
  }

  Future<void> _openDetail(AttendanceRecord record) async {
    final resolved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: PupTheme.of(context).surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      builder: (sheetContext) => SizedBox(
        height: MediaQuery.sizeOf(sheetContext).height * 0.88,
        child: _DisputeDetailSheet(
          record: record,
          sessionLabel: _sessionLabel(record.sessionId),
        ),
      ),
    );
    if (resolved == true) await _load();
  }
}

class _DisputeCard extends StatelessWidget {
  const _DisputeCard({
    required this.record,
    required this.sessionLabel,
    required this.reasonLabel,
    required this.reasonIcon,
    required this.onTap,
  });

  final AttendanceRecord record;
  final String sessionLabel;
  final String reasonLabel;
  final IconData reasonIcon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      onTap: onTap,
      semanticLabel:
          'Dispute from ${record.studentName}: $reasonLabel. ${record.disputeResolved ? 'Resolved' : 'Pending'}',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(reasonIcon, size: 18, color: tokens.maroon),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  record.studentName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  sessionLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
                const SizedBox(height: 4),
                Text(
                  reasonLabel,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.isDark ? tokens.gold : tokens.maroon,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if ((record.disputeDescription ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    record.disputeDescription!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              CampusStatusBadge(status: record.status, dense: true),
              const SizedBox(height: 6),
              Text(
                formatDateTimeLabel(record.timestamp),
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DisputeDetailSheet extends ConsumerStatefulWidget {
  const _DisputeDetailSheet({required this.record, required this.sessionLabel});

  final AttendanceRecord record;
  final String sessionLabel;

  @override
  ConsumerState<_DisputeDetailSheet> createState() =>
      _DisputeDetailSheetState();
}

class _DisputeDetailSheetState extends ConsumerState<_DisputeDetailSheet> {
  RecordTimeline? _timeline;
  List<ScanAttemptView> _attempts = const <ScanAttemptView>[];
  bool _loading = true;
  String? _error;
  String? _resolving;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadTelemetry());
  }

  Future<void> _loadTelemetry() async {
    final attendance = ref.read(attendanceApiProvider);
    try {
      final results = await Future.wait<Object?>(<Future<Object?>>[
        attendance.getRecordTimeline(widget.record.id),
        attendance.getScanAttempts(sessionId: widget.record.sessionId),
      ]);
      if (!mounted) return;
      setState(() {
        _timeline = results[0] as RecordTimeline?;
        _attempts =
            (results[1] as List<ScanAttemptView>?)
                ?.where(
                  (attempt) => attempt.studentId == widget.record.studentId,
                )
                .toList(growable: false) ??
            const <ScanAttemptView>[];
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Telemetry unavailable: $error';
      });
    }
  }

  Future<void> _resolve(
    DisputeResolution resolution, {
    AttendanceStatus? newStatus,
  }) async {
    final record = widget.record;
    final label = switch (resolution) {
      DisputeResolution.accept => 'Accept as Present',
      DisputeResolution.reject => 'Reject as Absent',
      DisputeResolution.override =>
        'Override to ${attendanceStatusLabels[newStatus] ?? 'status'}',
    };
    final confirmed = await showFacultyConfirm(
      context,
      title: '$label?',
      message:
          '${record.studentName}\'s record is currently '
          '${attendanceStatusLabels[record.status] ?? record.status.wire}. '
          'The decision is audited and visible to the student.',
      confirmLabel: label,
      destructive: resolution == DisputeResolution.reject,
    );
    if (!confirmed || !mounted) return;
    setState(() => _resolving = label);
    try {
      await ref
          .read(disputesApiProvider)
          .resolveDispute(
            record.id,
            resolution: resolution,
            newStatus: newStatus,
          );
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Dispute resolved for ${record.studentName}.',
        tone: CampusToastTone.success,
      );
      Navigator.of(context).pop(true);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _resolving = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final record = widget.record;
    final recommendation = _timeline?.recommendation;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      record.disputeResolved
                          ? 'Dispute archive'
                          : 'Review dispute',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      widget.sessionLabel,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Close',
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
        ),
        Divider(height: 1, color: tokens.borderSubtle),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                CampusCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        record.studentName,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        record.studentId,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          CampusStatusBadge(status: record.status),
                          const SizedBox(width: 8),
                          FacultyPill(
                            label: disputeReasonLabel(record.disputeReason),
                            icon: disputeReasonIcon(record.disputeReason),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        formatDateTimeLabel(record.timestamp),
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                      if ((record.disputeDescription ?? '').trim().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(record.disputeDescription!),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: CampusLoading(
                      label: 'Loading telemetry.',
                      compact: true,
                    ),
                  )
                else if (_error != null)
                  Text(_error!, style: Theme.of(context).textTheme.bodySmall)
                else ...[
                  FacultySectionTitle(title: 'Blackbox timeline'),
                  if (_timeline == null)
                    Text(
                      'No timeline available for this record.',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                    )
                  else ...[
                    if (recommendation != null)
                      CampusCard(
                        borderColor: tokens.gold,
                        child: Row(
                          children: [
                            Icon(
                              switch (recommendation.verdict) {
                                DisputeRecommendationVerdict.accept =>
                                  Icons.check_circle_outline,
                                DisputeRecommendationVerdict.review =>
                                  Icons.visibility_outlined,
                                DisputeRecommendationVerdict.reject =>
                                  Icons.cancel_outlined,
                              },
                              size: 18,
                              color: tokens.gold,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Recommendation: '
                                    '${disputeRecommendationLabels[recommendation.verdict] ?? recommendation.verdict.wire}',
                                    style: Theme.of(context).textTheme.bodySmall
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                  Text(
                                    recommendation.rationale,
                                    style: Theme.of(context).textTheme.bodySmall
                                        ?.copyWith(color: tokens.muted),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 8),
                    for (final event in _timeline!.events) ...[
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 78,
                            child: Text(
                              formatDateTimeLabel(event.at),
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(color: tokens.muted, fontSize: 10),
                            ),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  event.label,
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(fontWeight: FontWeight.w600),
                                ),
                                if (event.detail != null)
                                  Text(
                                    _describeDetail(event.detail!),
                                    style: Theme.of(context).textTheme.bodySmall
                                        ?.copyWith(
                                          color: tokens.muted,
                                          fontSize: 11,
                                        ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                    ],
                  ],
                  if (_attempts.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    FacultySectionTitle(
                      title: 'Scan attempts (${_attempts.length})',
                    ),
                    for (final attempt in _attempts.take(6))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: CampusCard(
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${formatDateTimeLabel(attempt.timestamp)} · '
                                '${attempt.outcome.wire.toUpperCase()}'
                                '${attempt.checkpoint == null ? '' : ' · ${attempt.checkpoint}'}',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                              Text(
                                [
                                  if (attempt.distanceMeters != null)
                                    '${attempt.distanceMeters!.round()} m from centre',
                                  if (attempt.accuracyMeters != null)
                                    '±${attempt.accuracyMeters!.round()} m accuracy',
                                  if (attempt.mocked != null)
                                    attempt.mocked!
                                        ? 'MOCKED GPS'
                                        : 'GPS genuine',
                                  if (attempt.geofenceRadiusMeters != null)
                                    'radius ${attempt.geofenceRadiusMeters!.round()} m',
                                  if (attempt.denialReason != null)
                                    attempt.denialReason!,
                                ].join(' · '),
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: tokens.muted),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ],
                if (!record.disputeResolved) ...[
                  const SizedBox(height: 12),
                  CampusButton(
                    label: 'Accept as Present',
                    icon: Icons.check,
                    loading: _resolving != null,
                    onPressed: _resolving == null
                        ? () => _resolve(DisputeResolution.accept)
                        : null,
                  ),
                  const SizedBox(height: 8),
                  CampusButton(
                    label: 'Reject as Absent',
                    variant: CampusButtonVariant.destructive,
                    icon: Icons.close,
                    loading: _resolving != null,
                    onPressed: _resolving == null
                        ? () => _resolve(DisputeResolution.reject)
                        : null,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Override to',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: tokens.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final status in disputeOverrideStatuses)
                        OutlinedButton(
                          onPressed: _resolving == null
                              ? () => _resolve(
                                  DisputeResolution.override,
                                  newStatus: status,
                                )
                              : null,
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(0, 44),
                          ),
                          child: Text(attendanceStatusLabels[status]!),
                        ),
                    ],
                  ),
                ] else ...[
                  const SizedBox(height: 12),
                  Text(
                    'This dispute is resolved and kept in the archive.',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _describeDetail(RecordTimelineEventDetail detail) {
    return [
      if (detail.distanceMeters != null)
        'distance ${detail.distanceMeters!.round()} m',
      if (detail.radiusMeters != null)
        'radius ${detail.radiusMeters!.round()} m',
      if (detail.insideGeofence != null)
        detail.insideGeofence! ? 'inside geofence' : 'outside geofence',
      if (detail.mocked != null) detail.mocked! ? 'mocked GPS' : 'GPS genuine',
      if (detail.pinVerified != null)
        detail.pinVerified! ? 'PIN verified' : 'PIN failed',
      if (detail.channel != null) 'channel ${detail.channel}',
      if (detail.receiptId != null) 'receipt ${detail.receiptId}',
    ].join(' · ');
  }
}
