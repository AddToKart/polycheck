import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/polycheck_core.dart';
import 'faculty_shell.dart';

/// How the archive pop-up was closed.
enum ArchiveOutcome { closed, restored, deleted }

/// Whole days, hours, minutes and seconds left; never negative.
({int days, int hours, int minutes, int seconds}) countdownParts(
  Duration left,
) {
  final seconds = left.isNegative ? 0 : left.inSeconds;
  return (
    days: seconds ~/ 86400,
    hours: (seconds % 86400) ~/ 3600,
    minutes: (seconds % 3600) ~/ 60,
    seconds: seconds % 60,
  );
}

const List<String> _months = <String>[
  'January', 'February', 'March', 'April', 'May', 'June', 'July', //
  'August', 'September', 'October', 'November', 'December',
];

/// A calendar date in Philippine time, such as `February 26, 2027`.
String campusLongDate(DateTime utc) {
  final local = utc.toUtc().add(const Duration(hours: 8));
  return '${_months[local.month - 1]} ${local.day}, ${local.year}';
}

String _count(int value, String one) => '$value $one${value == 1 ? '' : 's'}';

/// What a professor sees on opening an archived subject: when its evidence will
/// be erased, a way to keep copies, and the two ways out.
Future<ArchiveOutcome> showArchivedSubjectDialog(
  BuildContext context, {
  required Subject subject,
}) async {
  final outcome = await showDialog<ArchiveOutcome>(
    context: context,
    builder: (_) => ArchivedSubjectDialog(subject: subject),
  );
  return outcome ?? ArchiveOutcome.closed;
}

class ArchivedSubjectDialog extends ConsumerStatefulWidget {
  const ArchivedSubjectDialog({super.key, required this.subject});

  final Subject subject;

  @override
  ConsumerState<ArchivedSubjectDialog> createState() =>
      _ArchivedSubjectDialogState();
}

class _ArchivedSubjectDialogState extends ConsumerState<ArchivedSubjectDialog> {
  final TextEditingController _code = TextEditingController();
  Timer? _ticker;
  SubjectLifecycle? _lifecycle;
  String? _error;
  String? _busy;
  bool _confirmingDelete = false;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(
      const Duration(seconds: 1),
      (_) => setState(() {}),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _code.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final lifecycle = await ref
          .read(subjectsApiProvider)
          .getLifecycle(widget.subject.id);
      if (mounted) setState(() => _lifecycle = lifecycle);
    } on ApiRequestError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) {
        setState(() => _error = 'Could not read the archive details: $error');
      }
    }
  }

  /// Runs one action at a time; a failure stays under the buttons.
  Future<void> _run(
    String action,
    Future<void> Function() task, {
    ArchiveOutcome? then,
  }) async {
    if (_busy != null) return;
    setState(() {
      _busy = action;
      _error = null;
    });
    try {
      await task();
      if (!mounted) return;
      if (then != null) {
        Navigator.of(context).pop(then);
        return;
      }
    } on ApiRequestError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) setState(() => _error = 'That did not work: $error');
    }
    if (mounted) setState(() => _busy = null);
  }

  Future<void> _share(Future<DocumentDownload> Function() fetch) async {
    final download = await fetch();
    if (mounted) await shareDownload(context, download);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final text = Theme.of(context).textTheme;
    final subject = widget.subject;
    final lifecycle = _lifecycle;
    final busy = _busy != null;
    final subjects = ref.read(subjectsApiProvider);
    final docs = ref.read(docsApiProvider);
    final codeMatches =
        _code.text.trim().toLowerCase() == subject.code.trim().toLowerCase();

    return PopScope(
      canPop: !busy,
      child: Dialog(
        backgroundColor: tokens.surface,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.inventory_2_outlined,
                    color: tokens.isDark ? tokens.gold : tokens.maroon,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'This subject is archived',
                      style: text.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close',
                    onPressed: busy
                        ? null
                        : () =>
                              Navigator.of(context).pop(ArchiveOutcome.closed),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              Text(
                '${subject.name} (${subject.code}) is hidden and read-only. '
                'Nothing in it can be changed unless you restore it.',
                style: text.bodySmall?.copyWith(color: tokens.muted),
              ),
              const SizedBox(height: 14),
              if (lifecycle == null && _error == null)
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: Center(child: CircularProgressIndicator()),
                ),
              if (lifecycle != null) ...[
                _Countdown(
                  lifecycle: lifecycle,
                  now: ref.watch(trustedClockProvider).now(),
                ),
                const SizedBox(height: 10),
                Text(
                  [
                    _count(lifecycle.counts.sections, 'section'),
                    _count(lifecycle.counts.sessions, 'class meeting'),
                    _count(
                      lifecycle.counts.attendanceRecords,
                      'attendance record',
                    ),
                    _count(lifecycle.counts.classPhotos, 'class photo'),
                  ].join(' · '),
                  style: text.bodySmall?.copyWith(color: tokens.muted),
                ),
                const SizedBox(height: 14),
                if (_confirmingDelete) ...[
                  Text(
                    'Delete this subject for good?',
                    style: text.titleSmall?.copyWith(
                      color: Theme.of(context).colorScheme.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'This deletes its sections, class meetings, photos and all '
                    'attendance records right now. It cannot be undone. Export '
                    'the attendance records first if anyone may need them.',
                    style: text.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  CampusTextField(
                    key: const ValueKey<String>('confirm-subject-code'),
                    controller: _code,
                    label: 'Type ${subject.code} to confirm',
                    textCapitalization: TextCapitalization.characters,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 10),
                  CampusButton(
                    key: const ValueKey<String>('confirm-delete-subject'),
                    label: 'Delete permanently',
                    variant: CampusButtonVariant.destructive,
                    loading: _busy == 'delete',
                    onPressed: codeMatches && !busy
                        ? () => _run(
                            'delete',
                            () => subjects.deletePermanently(
                              subject.id,
                              _code.text.trim(),
                            ),
                            then: ArchiveOutcome.deleted,
                          )
                        : null,
                  ),
                  const SizedBox(height: 8),
                  CampusButton(
                    label: 'Keep it',
                    variant: CampusButtonVariant.outline,
                    onPressed: busy
                        ? null
                        : () => setState(() {
                            _confirmingDelete = false;
                            _code.clear();
                          }),
                  ),
                ] else ...[
                  CampusButton(
                    label: 'Export attendance',
                    icon: Icons.download_outlined,
                    loading: _busy == 'export',
                    onPressed: busy
                        ? null
                        : () => _run(
                            'export',
                            () => _share(
                              () => docs.subjectAttendance(subject.id),
                            ),
                          ),
                  ),
                  if (lifecycle.counts.classPhotos > 0) ...[
                    const SizedBox(height: 8),
                    CampusButton(
                      label: 'Class photos PDF',
                      icon: Icons.photo_library_outlined,
                      variant: CampusButtonVariant.outline,
                      loading: _busy == 'photos',
                      onPressed: busy
                          ? null
                          : () => _run(
                              'photos',
                              () => _share(
                                () => docs.proofPhotos(subjectId: subject.id),
                              ),
                            ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  CampusButton(
                    key: const ValueKey<String>('restore-subject'),
                    label: 'Restore subject',
                    icon: Icons.restore,
                    variant: CampusButtonVariant.outline,
                    loading: _busy == 'restore',
                    onPressed: busy
                        ? null
                        : () => _run(
                            'restore',
                            () => subjects.restore(subject.id),
                            then: ArchiveOutcome.restored,
                          ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Restoring cancels the deletion.',
                      textAlign: TextAlign.center,
                      style: text.labelSmall?.copyWith(color: tokens.muted),
                    ),
                  ),
                  TextButton.icon(
                    key: const ValueKey<String>('start-delete-subject'),
                    onPressed: busy
                        ? null
                        : () => setState(() => _confirmingDelete = true),
                    style: TextButton.styleFrom(
                      foregroundColor: Theme.of(context).colorScheme.error,
                    ),
                    icon: const Icon(Icons.delete_forever_outlined, size: 18),
                    label: const Text('Delete permanently…'),
                  ),
                ],
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                FormProblems(title: 'That did not work', problems: [_error!]),
                if (lifecycle == null)
                  CampusButton(label: 'Try again', onPressed: _load),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Countdown extends StatelessWidget {
  const _Countdown({required this.lifecycle, required this.now});

  final SubjectLifecycle lifecycle;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final text = Theme.of(context).textTheme;
    final erased = lifecycle.evidencePurgedAt;
    if (erased != null) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: tokens.campus,
          border: Border(left: BorderSide(color: tokens.maroon, width: 4)),
        ),
        child: Text(
          'Its class photos, excuse photos, location data and scan logs were '
          'erased on ${campusLongDate(erased)}. Attendance results are kept.',
          style: text.bodySmall,
        ),
      );
    }
    final due = lifecycle.evidencePurgeAt;
    if (due == null) return const SizedBox.shrink();
    final left = countdownParts(due.difference(now));
    String two(int value) => value.toString().padLeft(2, '0');
    // Maroon with golden figures in light mode, golden with maroon in dark.
    final background = tokens.isDark ? tokens.gold : tokens.maroon;
    final figure = tokens.isDark ? tokens.deepMaroon : tokens.gold;
    final body = tokens.isDark ? tokens.deepMaroon : Colors.white;
    return Container(
      padding: const EdgeInsets.all(14),
      color: background,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'EVIDENCE IS PERMANENTLY ERASED IN',
            style: text.labelSmall?.copyWith(
              color: body,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${left.days}d ${two(left.hours)}h ${two(left.minutes)}m '
            '${two(left.seconds)}s',
            key: const ValueKey<String>('archive-countdown'),
            style: text.headlineSmall?.copyWith(
              color: figure,
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'On ${campusLongDate(due)}, $archiveEvidenceRetentionDays days '
            'after archiving, its class photos, excuse photos, location data '
            'and scan logs are deleted. Attendance results are kept. Download '
            'the photo PDF before then.',
            style: text.bodySmall?.copyWith(color: body, height: 1.4),
          ),
        ],
      ),
    );
  }
}
