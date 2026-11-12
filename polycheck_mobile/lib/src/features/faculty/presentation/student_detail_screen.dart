import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../../core/polycheck_core.dart';
import '../data/faculty_logic.dart';
import 'widgets/faculty_id_card.dart';
import 'widgets/faculty_shell.dart';

const int _sessionPageSize = 5;

/// Faculty student detail: ID card, per-session attendance cycle, and the
/// account-governance actions (delegated reset, device release, removal).
class FacultyStudentDetailScreen extends ConsumerStatefulWidget {
  const FacultyStudentDetailScreen({
    super.key,
    required this.studentId,
    this.sectionId,
  });

  final String studentId;
  final String? sectionId;

  @override
  ConsumerState<FacultyStudentDetailScreen> createState() =>
      _FacultyStudentDetailScreenState();
}

class _FacultyStudentDetailScreenState
    extends ConsumerState<FacultyStudentDetailScreen> {
  bool _loading = true;
  String? _error;
  User? _student;
  Section? _section;
  List<Session> _sessions = const <Session>[];
  List<AttendanceRecord> _records = const <AttendanceRecord>[];
  int _page = 1;
  String? _busy;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = _student == null;
      _error = null;
    });
    try {
      final usersApi = ref.read(usersApiProvider);
      final sectionsApi = ref.read(sectionsApiProvider);
      final student = await usersApi.getStudent(widget.studentId);
      Section? section;
      if (widget.sectionId != null && widget.sectionId!.isNotEmpty) {
        section = await sectionsApi.getSection(widget.sectionId!);
      } else if (student.enrolledSectionIds.isNotEmpty) {
        final sections = await sectionsApi.getSections();
        final match = sections.where(
          (candidate) => student.enrolledSectionIds.contains(candidate.id),
        );
        if (match.isNotEmpty) section = match.first;
      }
      var sessions = const <Session>[];
      var records = const <AttendanceRecord>[];
      if (section != null) {
        final results = await Future.wait<Object>(<Future<Object>>[
          ref.read(sessionsApiProvider).getSectionSessions(section.id),
          ref
              .read(attendanceApiProvider)
              .getStudentAttendanceForSection(student.id, section.id),
        ]);
        sessions = (results[0] as List<Session>).toList(growable: false)
          ..sort((a, b) => b.date.compareTo(a.date));
        records = results[1] as List<AttendanceRecord>;
      }
      if (!mounted) return;
      setState(() {
        _student = student;
        _section = section;
        _sessions = sessions;
        _records = records;
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
        _error = 'Unable to load the student: $error';
      });
    }
  }

  Future<void> _reloadAttendance() async {
    final section = _section;
    final student = _student;
    if (section == null || student == null) return;
    try {
      final records = await ref
          .read(attendanceApiProvider)
          .getStudentAttendanceForSection(student.id, section.id);
      if (!mounted) return;
      setState(() => _records = records);
    } catch (_) {
      // The optimistic row stays; the next refresh reconciles.
    }
  }

  AttendanceRecord? _recordFor(String sessionId) {
    for (final record in _records) {
      if (record.sessionId == sessionId) return record;
    }
    return null;
  }

  Future<void> _cycle(Session session) async {
    final student = _student;
    final section = _section;
    if (student == null || section == null || _busy != null) return;
    final record = _recordFor(session.id);
    final next = nextAttendanceStatus(
      record?.status ?? AttendanceStatus.pending,
    );
    setState(() => _busy = session.id);
    try {
      if (record != null) {
        final optimistic = record.copyWith(status: next, manuallySet: true);
        setState(() {
          _records = [
            for (final existing in _records)
              if (existing.id == record.id) optimistic else existing,
          ];
        });
        await ref
            .read(attendanceApiProvider)
            .updateAttendanceStatus(record.id, next);
      } else {
        final now = DateTime.now().toUtc().toIso8601String();
        await ref
            .read(attendanceApiProvider)
            .addAttendanceRecord(
              AttendanceRecord(
                id: const Uuid().v4(),
                sessionId: session.id,
                sectionId: section.id,
                studentId: student.id,
                studentName: student.fullName,
                timestamp: now,
                status: next,
                coordinates: const AttendanceCoordinates(
                  latitude: null,
                  longitude: null,
                ),
                isSynced: true,
                syncedAt: now,
                manuallySet: true,
              ),
            );
      }
      if (!mounted) return;
      CampusToast.showIn(
        context,
        '${session.date} → ${attendanceStatusLabels[next]}',
        tone: CampusToastTone.info,
      );
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } finally {
      if (mounted) setState(() => _busy = null);
      await _reloadAttendance();
    }
  }

  Future<void> _resetPassword() async {
    final student = _student;
    final section = _section;
    if (student == null || section == null || _busy != null) return;
    final confirmed = await showFacultyConfirm(
      context,
      title: 'Reset ${student.fullName}\'s password?',
      message:
          'A one-time temporary password is generated and the student must '
          'change it on next sign-in. Existing sessions are revoked.',
      confirmLabel: 'Reset password',
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = 'reset');
    try {
      final result = await ref
          .read(usersApiProvider)
          .teacherResetStudentPassword(student.id, section.id);
      if (!mounted) return;
      await showCampusDialog<void>(
        context,
        title: 'Temporary password',
        description:
            'Share this once with ${student.fullName}. It cannot be retrieved '
            'again.',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SelectableText(
              result.temporaryPassword,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 18,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => copyToClipboard(
                context,
                result.temporaryPassword,
                label: 'Credential copied.',
              ),
              icon: const Icon(Icons.copy_all_outlined, size: 16),
              label: const Text('Copy password'),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
            ),
          ],
        ),
        actionBuilders: [
          (dialogContext) => TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Done'),
          ),
        ],
      );
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _emergencyRelease() async {
    final student = _student;
    final section = _section;
    if (student == null || section == null || _busy != null) return;
    final input =
        await showCampusBottomSheet<
          ({EmergencyDeviceReleaseReason reason, String? note})
        >(
          context,
          title: 'Emergency device release',
          child: _ReleaseForm(student: student),
        );
    if (input == null || !mounted) return;
    final confirmed = await showFacultyConfirm(
      context,
      title: 'Release ${student.fullName}\'s device?',
      message:
          'This clears the active-device binding and any login cooldown, and '
          'revokes current sessions. Reason: ${input.reason.wire}.',
      confirmLabel: 'Release device',
      destructive: true,
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = 'release');
    try {
      final result = await ref
          .read(usersApiProvider)
          .emergencyReleaseDevice(
            student.id,
            EmergencyDeviceReleaseInput(
              sectionId: section.id,
              reason: input.reason,
              note: input.note,
            ),
          );
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Device released. Binding removed: '
        '${result.hadBinding == true ? 'yes' : 'no'}; '
        'cooldown cleared: ${result.hadCooldown == true ? 'yes' : 'no'}.',
        tone: CampusToastTone.success,
        duration: const Duration(seconds: 5),
      );
      await _load();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _removeFromSection() async {
    final student = _student;
    final section = _section;
    if (student == null || section == null || _busy != null) return;
    final confirmed = await showFacultyConfirm(
      context,
      title: 'Remove ${student.fullName} from the section?',
      message:
          'The student is removed from '
          '${formatSectionHeading(section: section.section, course: section.course)}. '
          'A removed student cannot re-enroll with the code until you add them '
          'back manually.',
      confirmLabel: 'Remove student',
      destructive: true,
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = 'remove');
    try {
      await ref
          .read(sectionsApiProvider)
          .removeStudentFromSection(section.id, student.id);
      if (!mounted) return;
      CampusToast.showIn(
        context,
        '${student.fullName} removed.',
        tone: CampusToastTone.success,
      );
      context.pop();
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
    final student = _student;
    final section = _section;
    final totalPages = _sessions.isEmpty
        ? 1
        : ((_sessions.length - 1) ~/ _sessionPageSize) + 1;
    final safePage = _page.clamp(1, totalPages);
    final pageSessions = _sessions
        .skip((safePage - 1) * _sessionPageSize)
        .take(_sessionPageSize)
        .toList(growable: false);

    return FacultyScaffold(
      title: student?.fullName ?? 'Student',
      subtitle: student?.studentId,
      showDefaultActions: false,
      body: _loading
          ? const FacultyLoading(label: 'Loading student.')
          : _error != null && student == null
          ? FacultyError(message: _error!, onRetry: _load)
          : student == null
          ? const FacultyEmptyState(title: 'Student not found')
          : FacultyPageBody(
              refresh: _load,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FacultyIdCard(
                    student: student,
                    sectionLabel: section == null
                        ? null
                        : formatSectionHeading(
                            section: section.section,
                            course: section.course,
                          ),
                  ),
                  const SizedBox(height: 12),
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          student.fullName,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${student.program ?? '—'} · Year ${student.yearLevel ?? '—'}',
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                        ),
                        if (section != null) ...[
                          const SizedBox(height: 6),
                          InkWell(
                            onTap: () =>
                                context.push('/faculty/sections/${section.id}'),
                            child: Text(
                              '${formatSectionHeading(section: section.section, course: section.course)} · ${section.room} →',
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: tokens.isDark
                                        ? tokens.gold
                                        : tokens.maroon,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            if ((student.contactEmail ?? '').isNotEmpty)
                              FacultyPill(
                                label: student.contactEmail!,
                                icon: Icons.mail_outline,
                              ),
                            if ((student.contactPhone ?? '').isNotEmpty)
                              FacultyPill(
                                label: student.contactPhone!,
                                icon: Icons.call_outlined,
                              ),
                            FacultyPill(
                              label: student.isActive ? 'Active' : 'Disabled',
                              icon: student.isActive
                                  ? Icons.check_circle_outline
                                  : Icons.block,
                            ),
                            if ((student.boundDeviceId ?? '').isNotEmpty)
                              FacultyPill(
                                label:
                                    'Bound …${_last4(student.boundDeviceId!)}',
                                icon: Icons.smartphone_outlined,
                              ),
                            if (student.deviceCooldownUntil != null)
                              FacultyPill(
                                label:
                                    'Cooldown until ${formatDateTimeLabel(student.deviceCooldownUntil)}',
                                icon: Icons.timer_outlined,
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (section != null) ...[
                    const SizedBox(height: 12),
                    FacultySectionTitle(title: 'Attendance per session'),
                    if (pageSessions.isEmpty)
                      FacultyEmptyState(
                        icon: Icons.event_note_outlined,
                        title: 'No sessions yet',
                        message:
                            'Create a session for this section to record '
                            'attendance.',
                      )
                    else
                      for (final session in pageSessions)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: _SessionAttendanceRow(
                            session: session,
                            record: _recordFor(session.id),
                            busy: _busy == session.id,
                            onCycle: () => _cycle(session),
                          ),
                        ),
                    if (totalPages > 1)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            tooltip: 'Previous page',
                            onPressed: safePage == 1
                                ? null
                                : () => setState(() => _page = safePage - 1),
                            icon: const Icon(Icons.chevron_left),
                          ),
                          Text('Page $safePage of $totalPages'),
                          IconButton(
                            tooltip: 'Next page',
                            onPressed: safePage == totalPages
                                ? null
                                : () => setState(() => _page = safePage + 1),
                            icon: const Icon(Icons.chevron_right),
                          ),
                        ],
                      ),
                    const SizedBox(height: 16),
                    FacultySectionTitle(title: 'Account governance'),
                    CampusCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Delegated actions are audited and follow the '
                            'institution governance settings.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: _busy == null ? _resetPassword : null,
                            icon: const Icon(Icons.password_outlined, size: 16),
                            label: const Text('Reset temporary password'),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(0, 44),
                            ),
                          ),
                          const SizedBox(height: 8),
                          OutlinedButton.icon(
                            onPressed: _busy == null ? _emergencyRelease : null,
                            icon: const Icon(
                              Icons.phonelink_erase_outlined,
                              size: 16,
                            ),
                            label: const Text('Emergency device release'),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(0, 44),
                            ),
                          ),
                          const SizedBox(height: 8),
                          OutlinedButton.icon(
                            onPressed: _busy == null
                                ? _removeFromSection
                                : null,
                            icon: const Icon(
                              Icons.person_remove_outlined,
                              size: 16,
                            ),
                            label: const Text('Remove from section'),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(0, 44),
                              foregroundColor: Theme.of(
                                context,
                              ).colorScheme.error,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    const SizedBox(height: 12),
                    CampusCard(
                      child: Text(
                        'Open this student from a section roster to see '
                        'session attendance and governance actions.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  String _last4(String value) =>
      value.length <= 4 ? value : value.substring(value.length - 4);
}

class _SessionAttendanceRow extends StatelessWidget {
  const _SessionAttendanceRow({
    required this.session,
    required this.record,
    required this.busy,
    required this.onCycle,
  });

  final Session session;
  final AttendanceRecord? record;
  final bool busy;
  final VoidCallback onCycle;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final status = record?.status ?? AttendanceStatus.pending;
    return CampusCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${session.date} · ${formatTime(session.startTime)} – ${formatTime(session.endTime)}',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  record == null
                      ? 'No record yet · tap to add'
                      : '${attendanceStatusLabels[status]}'
                            '${record!.manuallySet ? ' · manual' : ''}',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
          ),
          CampusStatusBadge(status: status, dense: true),
          const SizedBox(width: 4),
          IconButton(
            tooltip: 'Cycle attendance status',
            onPressed: busy ? null : onCycle,
            icon: busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    Icons.published_with_changes,
                    size: 18,
                    color: tokens.isDark ? tokens.gold : tokens.maroon,
                  ),
          ),
        ],
      ),
    );
  }
}

class _ReleaseForm extends StatefulWidget {
  const _ReleaseForm({required this.student});

  final User student;

  @override
  State<_ReleaseForm> createState() => _ReleaseFormState();
}

class _ReleaseFormState extends State<_ReleaseForm> {
  EmergencyDeviceReleaseReason _reason =
      EmergencyDeviceReleaseReason.deadBattery;
  final TextEditingController _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${widget.student.fullName} · ${widget.student.studentId ?? ''}',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
        const SizedBox(height: 10),
        FacultyDropdown<EmergencyDeviceReleaseReason>(
          label: 'Reason',
          hint: 'Choose a reason',
          value: _reason,
          items: const [
            DropdownMenuItem(
              value: EmergencyDeviceReleaseReason.deadBattery,
              child: Text('Dead battery'),
            ),
            DropdownMenuItem(
              value: EmergencyDeviceReleaseReason.lostOrDamaged,
              child: Text('Lost or damaged device'),
            ),
            DropdownMenuItem(
              value: EmergencyDeviceReleaseReason.borrowedDevice,
              child: Text('Borrowed device'),
            ),
            DropdownMenuItem(
              value: EmergencyDeviceReleaseReason.other,
              child: Text('Other'),
            ),
          ],
          onChanged: (value) {
            if (value == null) return;
            setState(() => _reason = value);
          },
        ),
        const SizedBox(height: 10),
        CampusTextField(
          controller: _note,
          label: 'Note (optional)',
          hint: 'Details for the audit log.',
          maxLines: 3,
          minLines: 2,
        ),
        const SizedBox(height: 12),
        CampusButton(
          label: 'Continue',
          onPressed: () => Navigator.of(context).pop((
            reason: _reason,
            note: _note.text.trim().isEmpty ? null : _note.text.trim(),
          )),
        ),
      ],
    );
  }
}
