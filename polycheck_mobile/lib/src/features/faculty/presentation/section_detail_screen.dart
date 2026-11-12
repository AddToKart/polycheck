import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import '../data/faculty_logic.dart';
import '../data/session_wizard.dart';
import 'widgets/faculty_shell.dart';
import 'widgets/section_import_sheet.dart';

const int _rosterPageSize = 10;

/// Section detail: roster, enrollment code, officers, enroll/remove, imports.
class SectionDetailScreen extends ConsumerStatefulWidget {
  const SectionDetailScreen({super.key, required this.sectionId});

  final String sectionId;

  @override
  ConsumerState<SectionDetailScreen> createState() =>
      _SectionDetailScreenState();
}

class _SectionDetailScreenState extends ConsumerState<SectionDetailScreen> {
  bool _loading = true;
  String? _error;
  Section? _section;
  Subject? _subject;
  List<SectionStudent> _students = const <SectionStudent>[];
  List<SectionRole> _roles = const <SectionRole>[];
  final TextEditingController _search = TextEditingController();
  int _page = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _section == null;
      _error = null;
    });
    try {
      final section = await ref
          .read(sectionsApiProvider)
          .getSection(widget.sectionId);
      final results = await Future.wait<Object?>(<Future<Object?>>[
        ref.read(subjectsApiProvider).getSubject(section.subjectId),
        ref.read(sectionsApiProvider).getSectionStudents(section.id),
        ref.read(sectionsApiProvider).getSectionRoles(section.id),
      ]);
      if (!mounted) return;
      setState(() {
        _section = section;
        _subject = results[0] as Subject?;
        _students = (results[1] as List<SectionStudent>?) ?? const [];
        _roles = (results[2] as List<SectionRole>?) ?? const [];
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
        _error = 'Unable to load the section: $error';
      });
    }
  }

  Future<void> _copyCode() async {
    final code = _section?.enrollmentCode;
    if (code == null || code.isEmpty) return;
    await copyToClipboard(context, code, label: 'Enrollment code copied.');
  }

  Future<void> _resetCode() async {
    final section = _section;
    if (section == null) return;
    final confirmed = await showFacultyConfirm(
      context,
      title: 'Reset enrollment code?',
      message:
          'The current code stops working immediately. Students who already '
          'enrolled stay enrolled.',
      confirmLabel: 'Reset code',
    );
    if (!confirmed) return;
    try {
      final result = await ref
          .read(sectionsApiProvider)
          .resetEnrollmentCode(section.id);
      if (!mounted) return;
      setState(() {
        _section = _section!.copyWith(enrollmentCode: result.enrollmentCode);
      });
      CampusToast.showIn(
        context,
        'New enrollment code: ${result.enrollmentCode}',
        tone: CampusToastTone.success,
      );
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    }
  }

  Future<void> _disableCode() async {
    final section = _section;
    if (section == null) return;
    final confirmed = await showFacultyConfirm(
      context,
      title: 'Disable enrollment code?',
      message:
          'Students will no longer be able to self-enroll with a code. You can '
          'reset the code to create a new one later.',
      confirmLabel: 'Disable',
      destructive: true,
    );
    if (!confirmed) return;
    try {
      await ref.read(sectionsApiProvider).disableEnrollmentCode(section.id);
      if (!mounted) return;
      setState(() {
        _section = _section!.copyWith(enrollmentCode: null);
      });
      CampusToast.showIn(
        context,
        'Enrollment code disabled.',
        tone: CampusToastTone.success,
      );
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    }
  }

  Future<void> _removeStudent(SectionStudent entry) async {
    final confirmed = await showFacultyConfirm(
      context,
      title: 'Remove ${entry.student.fullName}?',
      message:
          'This removes the student from this section. A removed student '
          'cannot re-enroll with the code until you add them back manually.',
      confirmLabel: 'Remove',
      destructive: true,
    );
    if (!confirmed) return;
    try {
      await ref
          .read(sectionsApiProvider)
          .removeStudentFromSection(widget.sectionId, entry.student.id);
      if (!mounted) return;
      CampusToast.showIn(
        context,
        '${entry.student.fullName} removed from the section.',
        tone: CampusToastTone.success,
      );
      await _load();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    }
  }

  Future<void> _openEnrollStudent() async {
    final enrolledIds = _students.map((row) => row.student.id).toSet();
    final candidates = await _loadCandidates();
    if (!mounted) return;
    if (candidates == null) return;
    final selected = await showModalBottomSheet<User>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: PupTheme.of(context).surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      builder: (sheetContext) => _EnrollStudentSheet(
        candidates: candidates
            .where((student) => !enrolledIds.contains(student.id))
            .toList(growable: false),
      ),
    );
    if (selected == null) return;
    try {
      await ref
          .read(sectionsApiProvider)
          .enrollStudent(
            EnrollStudentInput(
              sectionId: widget.sectionId,
              studentId: selected.studentId ?? selected.id,
              studentName: selected.fullName,
            ),
          );
      if (!mounted) return;
      CampusToast.showIn(
        context,
        '${selected.fullName} enrolled.',
        tone: CampusToastTone.success,
      );
      await _load();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    }
  }

  Future<List<User>?> _loadCandidates() async {
    try {
      return await ref.read(usersApiProvider).getStudents();
    } on ApiRequestError catch (error) {
      if (mounted) {
        CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
      }
      return null;
    }
  }

  Future<void> _openRoleDialog() async {
    if (_students.isEmpty) {
      CampusToast.showIn(
        context,
        'Enroll students before assigning an officer role.',
        tone: CampusToastTone.warning,
      );
      return;
    }
    final assignment =
        await showCampusDialog<({SectionRoleType role, User student})>(
          context,
          title: 'Assign section officer',
          actionBuilders: [
            (dialogContext) => TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
          ],
          child: _RoleAssignmentForm(
            roles: _roles,
            students: _students
                .map((row) => row.student)
                .toList(growable: false),
          ),
        );
    if (assignment == null) return;
    try {
      await ref
          .read(sectionsApiProvider)
          .assignSectionRole(
            widget.sectionId,
            assignment.student.id,
            assignment.role,
          );
      if (!mounted) return;
      CampusToast.showIn(
        context,
        '${assignment.student.fullName} assigned as '
        '${assignment.role == SectionRoleType.president ? 'President' : 'QAC'}.',
        tone: CampusToastTone.success,
      );
      await _load();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    }
  }

  Future<void> _removeRole(SectionRole role) async {
    try {
      await ref
          .read(sectionsApiProvider)
          .removeSectionRole(role.sectionId, role.studentId, role.role);
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Role removed.',
        tone: CampusToastTone.success,
      );
      await _load();
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    }
  }

  Future<void> _downloadMasterList() async {
    try {
      final download = await ref
          .read(docsApiProvider)
          .masterList(widget.sectionId);
      if (!mounted) return;
      await shareDownload(context, download);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    }
  }

  Future<void> _downloadClassRecord() async {
    try {
      final download = await ref
          .read(docsApiProvider)
          .classRecord(widget.sectionId);
      if (!mounted) return;
      await shareDownload(context, download);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final section = _section;
    final query = _search.text.trim().toLowerCase();
    final filtered = query.isEmpty
        ? _students
        : _students
              .where(
                (row) =>
                    row.student.fullName.toLowerCase().contains(query) ||
                    (row.student.studentId ?? '').toLowerCase().contains(query),
              )
              .toList(growable: false);
    final totalPages = filtered.isEmpty
        ? 1
        : ((filtered.length - 1) ~/ _rosterPageSize) + 1;
    final safePage = _page.clamp(1, totalPages);
    final pageRows = filtered
        .skip((safePage - 1) * _rosterPageSize)
        .take(_rosterPageSize)
        .toList(growable: false);
    final roleByStudent = <String, Set<SectionRoleType>>{};
    for (final role in _roles) {
      roleByStudent
          .putIfAbsent(role.studentId, () => <SectionRoleType>{})
          .add(role.role);
    }

    return FacultyScaffold(
      title: section == null
          ? 'Section'
          : formatSectionHeading(
              section: section.section,
              course: section.course,
            ),
      subtitle: _subject == null
          ? null
          : '${_subject!.name} · ${_subject!.code}',
      showDefaultActions: false,
      body: _loading
          ? const FacultyLoading(label: 'Loading section.')
          : _error != null && section == null
          ? FacultyError(message: _error!, onRetry: _load)
          : FacultyPageBody(
              refresh: _load,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SectionHeadingLabel(
                          section: section!.section,
                          course: section.course,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            FacultyPill(
                              label: '${section.studentCount} students',
                              icon: Icons.people_outline,
                            ),
                            if (section.room.trim().isNotEmpty)
                              FacultyPill(
                                label: section.room,
                                icon: Icons.meeting_room_outlined,
                              ),
                            if (section.semester.isNotEmpty)
                              FacultyPill(label: section.semester),
                            if (section.course != null &&
                                section.course!.trim().isNotEmpty)
                              FacultyPill(label: pupCourseName(section.course)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        for (final slot in scheduleSlotsForSection(section))
                          Text(
                            slotLabel(slot),
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        const SizedBox(height: 12),
                        _EnrollmentCodeRow(
                          code: section.enrollmentCode,
                          expiry: section.enrollmentCodeExpiry,
                          onCopy: _copyCode,
                          onReset: _resetCode,
                          onDisable: _disableCode,
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            OutlinedButton.icon(
                              onPressed: () => context.push(
                                '/faculty/sessions?sectionId='
                                '${Uri.encodeComponent(section.id)}',
                              ),
                              icon: const Icon(Icons.qr_code_2, size: 16),
                              label: const Text('Sessions'),
                              style: OutlinedButton.styleFrom(
                                minimumSize: const Size(0, 44),
                              ),
                            ),
                            OutlinedButton.icon(
                              onPressed: () => showSectionImportSheet(
                                context,
                                sectionId: section.id,
                                sectionLabel: formatSectionHeading(
                                  section: section.section,
                                  course: section.course,
                                ),
                                onCompleted: _load,
                              ),
                              icon: const Icon(Icons.upload_file, size: 16),
                              label: const Text('Import'),
                              style: OutlinedButton.styleFrom(
                                minimumSize: const Size(0, 44),
                              ),
                            ),
                            OutlinedButton.icon(
                              onPressed: _downloadMasterList,
                              icon: const Icon(
                                Icons.description_outlined,
                                size: 16,
                              ),
                              label: const Text('Master list'),
                              style: OutlinedButton.styleFrom(
                                minimumSize: const Size(0, 44),
                              ),
                            ),
                            OutlinedButton.icon(
                              onPressed: _downloadClassRecord,
                              icon: const Icon(
                                Icons.table_chart_outlined,
                                size: 16,
                              ),
                              label: const Text('Class record'),
                              style: OutlinedButton.styleFrom(
                                minimumSize: const Size(0, 44),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  CampusCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Section officers',
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ),
                            TextButton.icon(
                              onPressed: _openRoleDialog,
                              icon: const Icon(Icons.add, size: 16),
                              label: const Text('Assign'),
                            ),
                          ],
                        ),
                        if (_roles.isEmpty)
                          Text(
                            'No officers assigned. Presidents can create '
                            'sessions; QAC members can upload proof of class.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          )
                        else
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              for (final role in _roles)
                                InputChip(
                                  label: Text(
                                    '${role.role == SectionRoleType.president ? 'President' : 'QAC'} · '
                                    '${role.studentName}',
                                  ),
                                  onDeleted: () => _removeRole(role),
                                  deleteIcon: const Icon(Icons.close, size: 14),
                                  backgroundColor: tokens.campus,
                                  shape: const RoundedRectangleBorder(
                                    borderRadius: BorderRadius.zero,
                                  ),
                                ),
                            ],
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Roster (${filtered.length})',
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: _openEnrollStudent,
                        icon: const Icon(Icons.person_add_alt_1, size: 16),
                        label: const Text('Enroll'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  CampusTextField(
                    controller: _search,
                    hint: 'Search name or student number',
                    prefixIcon: Icons.search,
                    onChanged: (_) => setState(() => _page = 1),
                  ),
                  const SizedBox(height: 8),
                  if (pageRows.isEmpty)
                    FacultyEmptyState(
                      icon: Icons.people_outline,
                      title: _students.isEmpty
                          ? 'No students enrolled yet'
                          : 'No students match the search',
                      message: _students.isEmpty
                          ? 'Share the enrollment code or enroll students '
                                'manually.'
                          : null,
                    )
                  else
                    for (final entry in pageRows)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: CampusCard(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          onTap: () => context.push(
                            '/faculty/students/${entry.student.id}'
                            '?sectionId=${Uri.encodeComponent(widget.sectionId)}',
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      entry.student.fullName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                    Text(
                                      entry.student.studentId ?? '',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(color: tokens.muted),
                                    ),
                                  ],
                                ),
                              ),
                              for (final role
                                  in roleByStudent[entry.student.id] ??
                                      const <SectionRoleType>{})
                                Padding(
                                  padding: const EdgeInsets.only(left: 4),
                                  child: FacultyPill(
                                    label: role == SectionRoleType.president
                                        ? 'PRES'
                                        : 'QAC',
                                    background: tokens.gold,
                                    foreground: tokens.deepMaroon,
                                    border: tokens.gold,
                                  ),
                                ),
                              const SizedBox(width: 6),
                              Text(
                                'P${entry.attendance.present} '
                                'L${entry.attendance.late} '
                                'A${entry.attendance.absent}',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: tokens.muted),
                              ),
                              IconButton(
                                tooltip: 'Remove from section',
                                onPressed: () => _removeStudent(entry),
                                icon: Icon(
                                  Icons.person_remove_outlined,
                                  size: 18,
                                  color: tokens.muted,
                                ),
                              ),
                            ],
                          ),
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
                ],
              ),
            ),
    );
  }
}

class _EnrollmentCodeRow extends StatelessWidget {
  const _EnrollmentCodeRow({
    required this.code,
    required this.expiry,
    required this.onCopy,
    required this.onReset,
    required this.onDisable,
  });

  final String? code;
  final String? expiry;
  final VoidCallback onCopy;
  final VoidCallback onReset;
  final VoidCallback onDisable;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final active = code != null && code!.isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: tokens.campus,
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Row(
        children: [
          Icon(
            Icons.key_outlined,
            size: 18,
            color: active ? tokens.maroon : tokens.muted,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  active ? code! : 'Enrollment code disabled',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: active ? 2 : 0,
                    fontFamily: 'monospace',
                  ),
                ),
                if (active && expiry != null && expiry!.isNotEmpty)
                  Text(
                    'Expires ${formatDateTimeLabel(expiry)}',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Copy enrollment code',
            onPressed: active ? onCopy : null,
            icon: const Icon(Icons.copy_all_outlined, size: 18),
          ),
          IconButton(
            tooltip: 'Reset enrollment code',
            onPressed: onReset,
            icon: const Icon(Icons.refresh, size: 18),
          ),
          IconButton(
            tooltip: 'Disable enrollment code',
            onPressed: active ? onDisable : null,
            icon: const Icon(Icons.block, size: 18),
          ),
        ],
      ),
    );
  }
}

class _EnrollStudentSheet extends StatefulWidget {
  const _EnrollStudentSheet({required this.candidates});

  final List<User> candidates;

  @override
  State<_EnrollStudentSheet> createState() => _EnrollStudentSheetState();
}

class _EnrollStudentSheetState extends State<_EnrollStudentSheet> {
  final TextEditingController _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final query = _search.text.trim().toLowerCase();
    final rows = query.isEmpty
        ? widget.candidates
        : widget.candidates
              .where(
                (student) =>
                    student.fullName.toLowerCase().contains(query) ||
                    (student.studentId ?? '').toLowerCase().contains(query),
              )
              .toList(growable: false);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.7,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Enroll a student',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  CampusTextField(
                    controller: _search,
                    hint: 'Search all students by name or student number',
                    prefixIcon: Icons.search,
                    onChanged: (_) => setState(() {}),
                  ),
                ],
              ),
            ),
            Expanded(
              child: rows.isEmpty
                  ? Center(
                      child: Text(
                        widget.candidates.isEmpty
                            ? 'Every student is already enrolled.'
                            : 'No students match the search.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                    )
                  : ListView.separated(
                      itemCount: rows.length,
                      separatorBuilder: (context, index) =>
                          Divider(height: 1, color: tokens.borderSubtle),
                      itemBuilder: (context, index) {
                        final student = rows[index];
                        return ListTile(
                          title: Text(student.fullName),
                          subtitle: Text(student.studentId ?? ''),
                          trailing: const Icon(Icons.add, size: 18),
                          onTap: () => Navigator.of(context).pop(student),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleAssignmentForm extends StatefulWidget {
  const _RoleAssignmentForm({required this.roles, required this.students});

  final List<SectionRole> roles;
  final List<User> students;

  @override
  State<_RoleAssignmentForm> createState() => _RoleAssignmentFormState();
}

class _RoleAssignmentFormState extends State<_RoleAssignmentForm> {
  SectionRoleType _role = SectionRoleType.president;
  String? _studentId;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FacultyDropdown<SectionRoleType>(
          label: 'Role',
          hint: 'Choose role',
          value: _role,
          items: const [
            DropdownMenuItem<SectionRoleType>(
              value: SectionRoleType.president,
              child: Text('President'),
            ),
            DropdownMenuItem<SectionRoleType>(
              value: SectionRoleType.qac,
              child: Text('QAC — Quality Assurance Coordinator'),
            ),
          ],
          onChanged: (value) {
            if (value == null) return;
            setState(() => _role = value);
          },
        ),
        const SizedBox(height: 12),
        FacultyDropdown<String>(
          label: 'Student',
          hint: 'Choose a student',
          value: _studentId,
          items: [
            for (final student in widget.students)
              DropdownMenuItem<String>(
                value: student.id,
                child: Text(
                  '${student.fullName} (${student.studentId ?? '—'})',
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
          onChanged: (value) => setState(() => _studentId = value),
        ),
        const SizedBox(height: 12),
        Text(
          'One student may hold both roles when the section is small.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: PupTheme.of(context).muted),
        ),
        const SizedBox(height: 16),
        CampusButton(
          label: 'Assign role',
          onPressed: _studentId == null
              ? null
              : () {
                  final student = widget.students.firstWhere(
                    (candidate) => candidate.id == _studentId,
                  );
                  Navigator.of(context).pop((role: _role, student: student));
                },
        ),
      ],
    );
  }
}
