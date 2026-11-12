import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/polycheck_core.dart';
import '../data/faculty_logic.dart';
import 'widgets/faculty_shell.dart';

enum _ExcuseTab { pending, approved, rejected }

/// Teacher excuse queue with evidence preview and approve/reject decisions.
class FacultyExcusesScreen extends ConsumerStatefulWidget {
  const FacultyExcusesScreen({super.key});

  @override
  ConsumerState<FacultyExcusesScreen> createState() =>
      _FacultyExcusesScreenState();
}

class _FacultyExcusesScreenState extends ConsumerState<FacultyExcusesScreen> {
  bool _loading = true;
  String? _error;
  _ExcuseTab _tab = _ExcuseTab.pending;
  String _sectionFilter = '';
  List<AttendanceRecord> _records = const <AttendanceRecord>[];
  List<Section> _sections = const <Section>[];

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
        ref.read(attendanceApiProvider).listExcuses(),
        ref.read(sectionsApiProvider).getSections(),
      ]);
      if (!mounted) return;
      setState(() {
        _records = results[0] as List<AttendanceRecord>;
        _sections = results[1] as List<Section>;
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
        _error = 'Unable to load excuses: $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final sectionsById = <String, Section>{
      for (final section in _sections) section.id: section,
    };
    final filtered = _records
        .where((record) {
          if (_sectionFilter.isNotEmpty && record.sectionId != _sectionFilter) {
            return false;
          }
          return switch (_tab) {
            _ExcuseTab.pending =>
              record.excuseStatus == ExcuseStatus.requested ||
                  (record.excuseStatus == null && record.excuseReason != null),
            _ExcuseTab.approved => record.excuseStatus == ExcuseStatus.approved,
            _ExcuseTab.rejected => record.excuseStatus == ExcuseStatus.rejected,
          };
        })
        .toList(growable: false);

    return FacultyScaffold(
      title: 'Excuses',
      subtitle: '${_records.length} request(s)',
      body: _loading
          ? const FacultyLoading(label: 'Loading excuse requests.')
          : _error != null && _records.isEmpty
          ? FacultyError(message: _error!, onRetry: _load)
          : FacultyPageBody(
              refresh: _load,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FacultyTabs(
                    labels: const ['Pending', 'Approved', 'Rejected'],
                    selectedIndex: _tab.index,
                    onSelected: (index) =>
                        setState(() => _tab = _ExcuseTab.values[index]),
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
                            formatSectionHeading(
                              section: section.section,
                              course: section.course,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: (value) =>
                        setState(() => _sectionFilter = value ?? ''),
                  ),
                  const SizedBox(height: 10),
                  if (filtered.isEmpty)
                    FacultyEmptyState(
                      icon: Icons.event_note_outlined,
                      title: switch (_tab) {
                        _ExcuseTab.pending => 'No pending excuses',
                        _ExcuseTab.approved => 'No approved excuses',
                        _ExcuseTab.rejected => 'No rejected excuses',
                      },
                      message:
                          'Students can request an excuse for absent or late '
                          'records; decisions notify them immediately.',
                    )
                  else
                    for (final record in filtered)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: CampusCard(
                          onTap: () => _openDetail(record, sectionsById),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.event_note_outlined,
                                size: 18,
                                color:
                                    record.excuseStatus == ExcuseStatus.approved
                                    ? tokens.maroon
                                    : tokens.muted,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      record.studentName,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                    Text(
                                      _sectionLabel(
                                        record.sectionId,
                                        sectionsById,
                                      ),
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(color: tokens.muted),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${excuseReasonLabel(record.excuseReason)} · '
                                      '${record.status.wire.toUpperCase()} record',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: tokens.isDark
                                                ? tokens.gold
                                                : tokens.maroon,
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                    if ((record.excuseDescription ?? '')
                                        .trim()
                                        .isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        record.excuseDescription!,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall
                                            ?.copyWith(color: tokens.muted),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              FacultyPill(
                                label:
                                    excuseStatusLabels[record.excuseStatus] ??
                                    'Pending',
                                background:
                                    record.excuseStatus == ExcuseStatus.approved
                                    ? tokens.gold
                                    : tokens.campus,
                                foreground:
                                    record.excuseStatus == ExcuseStatus.approved
                                    ? tokens.deepMaroon
                                    : tokens.onSurface,
                                border:
                                    record.excuseStatus == ExcuseStatus.approved
                                    ? tokens.gold
                                    : tokens.borderSubtle,
                              ),
                            ],
                          ),
                        ),
                      ),
                ],
              ),
            ),
    );
  }

  String _sectionLabel(String sectionId, Map<String, Section> byId) {
    final section = byId[sectionId];
    if (section == null) return sectionId;
    return '${formatSectionHeading(section: section.section, course: section.course)} · ${section.room}';
  }

  Future<void> _openDetail(
    AttendanceRecord record,
    Map<String, Section> sectionsById,
  ) async {
    final decided = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: PupTheme.of(context).surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      builder: (sheetContext) => SizedBox(
        height: MediaQuery.sizeOf(sheetContext).height * 0.88,
        child: _ExcuseDetailSheet(
          record: record,
          sectionLabel: _sectionLabel(record.sectionId, sectionsById),
        ),
      ),
    );
    if (decided == true) await _load();
  }
}

class _ExcuseDetailSheet extends ConsumerStatefulWidget {
  const _ExcuseDetailSheet({required this.record, required this.sectionLabel});

  final AttendanceRecord record;
  final String sectionLabel;

  @override
  ConsumerState<_ExcuseDetailSheet> createState() => _ExcuseDetailSheetState();
}

class _ExcuseDetailSheetState extends ConsumerState<_ExcuseDetailSheet> {
  final TextEditingController _note = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _decide(ExcuseDecision decision) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref
          .read(attendanceApiProvider)
          .decideExcuse(
            widget.record.id,
            decision: decision,
            note: _note.text.trim().isEmpty ? null : _note.text.trim(),
          );
      if (!mounted) return;
      CampusToast.showIn(
        context,
        decision == ExcuseDecision.approve
            ? 'Excuse approved for ${widget.record.studentName}.'
            : 'Excuse rejected for ${widget.record.studentName}.',
        tone: CampusToastTone.success,
      );
      Navigator.of(context).pop(true);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final record = widget.record;
    final pending =
        record.excuseStatus == ExcuseStatus.requested ||
        (record.excuseStatus == null && record.excuseReason != null);
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
                      pending ? 'Review excuse' : 'Excuse record',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      '${record.studentName} · ${widget.sectionLabel}',
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
            padding: EdgeInsets.fromLTRB(
              16,
              16,
              16,
              16 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                CampusCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CampusStatusBadge(status: record.status),
                          const SizedBox(width: 8),
                          FacultyPill(
                            label: excuseReasonLabel(record.excuseReason),
                          ),
                          const SizedBox(width: 8),
                          FacultyPill(
                            label:
                                excuseStatusLabels[record.excuseStatus] ??
                                'Pending',
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Session record: ${formatDateTimeLabel(record.timestamp)}',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                      if ((record.excuseDescription ?? '').trim().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(record.excuseDescription!),
                        ),
                      if (record.excuseReviewedBy != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            'Reviewed ${formatDateTimeLabel(record.excuseReviewedAt)}'
                            '${record.excuseReviewNote == null ? '' : ' · ${record.excuseReviewNote}'}',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FacultySectionTitle(title: 'Evidence'),
                _ExcuseEvidence(path: record.excuseEvidencePath),
                if (pending) ...[
                  const SizedBox(height: 14),
                  CampusTextField(
                    controller: _note,
                    label: 'Decision note (optional)',
                    hint: 'Explain the decision for the student.',
                    maxLines: 3,
                    minLines: 2,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _error!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  CampusButton(
                    label: 'Approve excuse',
                    icon: Icons.check,
                    loading: _submitting,
                    onPressed: _submitting
                        ? null
                        : () => _decide(ExcuseDecision.approve),
                  ),
                  const SizedBox(height: 8),
                  CampusButton(
                    label: 'Reject excuse',
                    variant: CampusButtonVariant.destructive,
                    icon: Icons.close,
                    loading: _submitting,
                    onPressed: _submitting
                        ? null
                        : () => _decide(ExcuseDecision.reject),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ExcuseEvidence extends ConsumerStatefulWidget {
  const _ExcuseEvidence({required this.path});

  final String? path;

  @override
  ConsumerState<_ExcuseEvidence> createState() => _ExcuseEvidenceState();
}

class _ExcuseEvidenceState extends ConsumerState<_ExcuseEvidence> {
  Future<Uint8List?>? _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Uint8List?> _load() async {
    final raw = widget.path?.trim();
    if (raw == null || raw.isEmpty || raw.startsWith('s3://')) return null;
    final String target;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      target = raw;
    } else {
      final base = Uri.tryParse(ApiConfig.baseUrl);
      if (base == null) return null;
      target = base
          .replace(
            path: raw.startsWith('/') ? raw : '/$raw',
            query: null,
            fragment: null,
          )
          .toString();
    }
    final response = await ref
        .read(dioProvider)
        .get<List<int>>(
          target,
          options: Options(responseType: ResponseType.bytes),
        );
    final data = response.data;
    return data == null ? null : Uint8List.fromList(data);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    if (widget.path == null || widget.path!.trim().isEmpty) {
      return Text(
        'No evidence attached.',
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
      );
    }
    if (widget.path!.startsWith('s3://')) {
      return Text(
        'Evidence is stored in object storage and cannot be previewed here.',
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
      );
    }
    return FutureBuilder<Uint8List?>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: CampusLoading(label: 'Loading evidence.', compact: true),
          );
        }
        final bytes = snapshot.data;
        if (bytes == null || bytes.isEmpty) {
          return Text(
            'Evidence is attached but cannot be previewed.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          );
        }
        return ClipRRect(
          borderRadius: BorderRadius.zero,
          child: Image.memory(
            bytes,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) => Text(
              'Evidence is attached but cannot be previewed.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ),
        );
      },
    );
  }
}
