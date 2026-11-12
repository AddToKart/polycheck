import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_providers.dart';
import '../../../../core/models/api.dart';
import '../../../../core/models/dashboard.dart';
import '../../../../core/models/user.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/widgets/campus_bottom_sheet.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/campus_card.dart';
import '../../../../core/widgets/campus_loading.dart';
import '../../../../core/widgets/campus_text_field.dart';
import '../../../../core/widgets/campus_toast.dart';
import '../../application/admin_users_api.dart';
import '../../domain/admin_users.dart';
import 'credential_result_dialog.dart';

Future<void> showCreateAccountSheet(
  BuildContext context, {
  required UserRole role,
  required VoidCallback onChanged,
  String? defaultDepartment,
}) {
  return showCampusBottomSheet<void>(
    context,
    title: role == UserRole.teacher ? 'Create teacher' : 'Create student',
    child: CreateAccountSheet(
      role: role,
      onChanged: onChanged,
      defaultDepartment: defaultDepartment,
    ),
  );
}

class CreateAccountSheet extends ConsumerStatefulWidget {
  const CreateAccountSheet({
    super.key,
    required this.role,
    required this.onChanged,
    this.defaultDepartment,
  });

  final UserRole role;
  final VoidCallback onChanged;
  final String? defaultDepartment;

  @override
  ConsumerState<CreateAccountSheet> createState() => _CreateAccountSheetState();
}

class _CreateAccountSheetState extends ConsumerState<CreateAccountSheet> {
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _studentId = TextEditingController();
  final _program = TextEditingController();
  final _yearLevel = TextEditingController(text: '1');
  late final TextEditingController _department = TextEditingController(
    text: widget.defaultDepartment ?? '',
  );
  bool _busy = false;
  String? _error;

  bool get _isTeacher => widget.role == UserRole.teacher;

  @override
  void dispose() {
    _fullName.dispose();
    _email.dispose();
    _studentId.dispose();
    _program.dispose();
    _yearLevel.dispose();
    _department.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final validation = _isTeacher
        ? validateCreateTeacherForm(
            fullName: _fullName.text,
            email: _email.text,
          )
        : validateCreateStudentForm(
            fullName: _fullName.text,
            studentId: _studentId.text,
            email: _email.text,
            program: _program.text,
            yearLevel: _yearLevel.text,
            department: _department.text,
          );
    if (validation != null) {
      setState(() => _error = validation);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = ref.read(usersApiProvider);
      final String? password;
      final User created;
      if (_isTeacher) {
        final result = await api.createTeacher(
          CreateTeacherInput(
            fullName: _fullName.text.trim(),
            email: _email.text.trim(),
            department: _department.text.trim().isEmpty
                ? null
                : _department.text.trim(),
          ),
        );
        created = result.user;
        password = result.temporaryPassword;
      } else {
        final result = await api.createStudent(
          CreateStudentInput(
            fullName: _fullName.text.trim(),
            studentId: _studentId.text.trim().toUpperCase(),
            email: _email.text.trim().isEmpty ? null : _email.text.trim(),
            program: _program.text.trim(),
            yearLevel: int.parse(_yearLevel.text.trim()),
            department: _department.text.trim(),
          ),
        );
        created = result.user;
        password = result.temporaryPassword;
      }
      if (!mounted) return;
      final navigatorContext = Navigator.of(
        context,
        rootNavigator: true,
      ).context;
      if (!navigatorContext.mounted) return;
      widget.onChanged();
      Navigator.of(context).pop();
      if (password != null && password.isNotEmpty) {
        await showCredentialResultDialog(
          navigatorContext,
          accountName: created.fullName,
          identifier: created.studentId ?? created.email ?? '',
          temporaryPassword: password,
        );
      } else {
        CampusToast.showIn(
          navigatorContext,
          '${userRoleLabel(created.role)} account created.',
          tone: CampusToastTone.success,
        );
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = adminUsersErrorMessage(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (_error != null) ...<Widget>[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: tokens.maroon,
              border: Border.all(color: tokens.maroon),
            ),
            child: Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        CampusTextField(
          controller: _fullName,
          label: 'Full name',
          textCapitalization: TextCapitalization.words,
          enabled: !_busy,
        ),
        if (!_isTeacher) ...<Widget>[
          const SizedBox(height: 12),
          CampusTextField(
            controller: _studentId,
            label: 'Student ID',
            hint: '2024-12345-MN-0',
            textCapitalization: TextCapitalization.characters,
            enabled: !_busy,
          ),
        ],
        const SizedBox(height: 12),
        CampusTextField(
          controller: _email,
          label: _isTeacher ? 'PUP email' : 'PUP email (optional)',
          keyboardType: TextInputType.emailAddress,
          enabled: !_busy,
        ),
        if (!_isTeacher) ...<Widget>[
          const SizedBox(height: 12),
          CampusTextField(
            controller: _program,
            label: 'Program',
            textCapitalization: TextCapitalization.characters,
            enabled: !_busy,
          ),
          const SizedBox(height: 12),
          CampusTextField(
            controller: _yearLevel,
            label: 'Year level',
            keyboardType: TextInputType.number,
            enabled: !_busy,
          ),
        ],
        const SizedBox(height: 12),
        CampusTextField(
          controller: _department,
          label: 'Department',
          textCapitalization: TextCapitalization.characters,
          enabled: !_busy,
        ),
        const SizedBox(height: 10),
        Text(
          'A secure temporary password is generated automatically and shown '
          'once. Share it in person; the account must change it on first '
          'sign-in.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
        const SizedBox(height: 16),
        CampusButton(
          label: _busy
              ? 'Creating…'
              : 'Create ${_isTeacher ? 'teacher' : 'student'}',
          icon: Icons.person_add_alt_outlined,
          loading: _busy,
          onPressed: _busy ? null : _submit,
        ),
      ],
    );
  }
}

Future<void> showAddAdminSheet(
  BuildContext context, {
  required VoidCallback onChanged,
  String? defaultDepartment,
}) {
  return showCampusBottomSheet<void>(
    context,
    title: 'Add super administrator',
    child: AddAdminSheet(
      onChanged: onChanged,
      defaultDepartment: defaultDepartment,
    ),
  );
}

enum AdminMode { promote, create }

class AddAdminSheet extends ConsumerStatefulWidget {
  const AddAdminSheet({
    super.key,
    required this.onChanged,
    this.defaultDepartment,
  });

  final VoidCallback onChanged;
  final String? defaultDepartment;

  @override
  ConsumerState<AddAdminSheet> createState() => _AddAdminSheetState();
}

class _AddAdminSheetState extends ConsumerState<AddAdminSheet> {
  AdminMode _mode = AdminMode.promote;
  final _search = TextEditingController();
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  late final TextEditingController _department = TextEditingController(
    text: widget.defaultDepartment ?? '',
  );
  final _password = TextEditingController();
  List<User>? _teachers;
  String? _teachersError;
  User? _selected;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTeachers();
  }

  @override
  void dispose() {
    _search.dispose();
    _fullName.dispose();
    _email.dispose();
    _department.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _loadTeachers() async {
    try {
      final teachers = await ref.read(usersApiProvider).getTeachers();
      if (!mounted) return;
      setState(() => _teachers = teachers);
    } catch (error) {
      if (!mounted) return;
      setState(() => _teachersError = adminUsersErrorMessage(error));
    }
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_mode == AdminMode.promote) {
        final selected = _selected;
        if (selected == null) {
          setState(() {
            _busy = false;
            _error = 'Select the teacher account to promote.';
          });
          return;
        }
        await ref
            .read(usersApiProvider)
            .createAdmin(CreateAdminInput(userId: selected.id));
        if (!mounted) return;
        final navigatorContext = Navigator.of(
          context,
          rootNavigator: true,
        ).context;
        if (!navigatorContext.mounted) return;
        widget.onChanged();
        Navigator.of(context).pop();
        CampusToast.showIn(
          navigatorContext,
          '${selected.fullName} now has institution-wide access.',
          tone: CampusToastTone.success,
        );
        return;
      }

      final validation = validateCreateAdminForm(
        fullName: _fullName.text,
        email: _email.text,
        department: _department.text,
        password: _password.text,
      );
      if (validation != null) {
        setState(() {
          _busy = false;
          _error = validation;
        });
        return;
      }
      await ref
          .read(usersApiProvider)
          .createAdmin(
            CreateAdminInput(
              fullName: _fullName.text.trim(),
              email: _email.text.trim(),
              department: _department.text.trim(),
              password: _password.text,
            ),
          );
      if (!mounted) return;
      final navigatorContext = Navigator.of(
        context,
        rootNavigator: true,
      ).context;
      if (!navigatorContext.mounted) return;
      widget.onChanged();
      Navigator.of(context).pop();
      await showCredentialResultDialog(
        navigatorContext,
        accountName: _fullName.text.trim(),
        identifier: _email.text.trim(),
        temporaryPassword: _password.text,
        title: 'Super administrator created',
        note:
            'The account can sign in immediately with this password. Share it '
            'in person and ask the administrator to rotate it after signing '
            'in.',
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = adminUsersErrorMessage(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final teachers = _teachers;
    final query = _search.text.trim().toLowerCase();
    final filtered = teachers
        ?.where(
          (teacher) =>
              query.isEmpty ||
              teacher.fullName.toLowerCase().contains(query) ||
              (teacher.email ?? '').toLowerCase().contains(query),
        )
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          'Institution-scope administrators can promote an existing teacher '
          'or create a fresh protected account. Every change is audited.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
        const SizedBox(height: 12),
        SegmentedButton<AdminMode>(
          segments: const <ButtonSegment<AdminMode>>[
            ButtonSegment<AdminMode>(
              value: AdminMode.promote,
              label: Text('Promote teacher'),
              icon: Icon(Icons.upgrade, size: 16),
            ),
            ButtonSegment<AdminMode>(
              value: AdminMode.create,
              label: Text('Create fresh'),
              icon: Icon(Icons.person_add_alt_outlined, size: 16),
            ),
          ],
          selected: <AdminMode>{_mode},
          onSelectionChanged: _busy
              ? null
              : (selection) => setState(() => _mode = selection.first),
          style: ButtonStyle(
            shape: const WidgetStatePropertyAll(
              RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            ),
            side: WidgetStatePropertyAll(
              BorderSide(color: tokens.borderSubtle),
            ),
          ),
        ),
        if (_error != null) ...<Widget>[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: tokens.maroon,
              border: Border.all(color: tokens.maroon),
            ),
            child: Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        if (_mode == AdminMode.promote) ...<Widget>[
          CampusTextField(
            controller: _search,
            label: 'Search teachers',
            prefixIcon: Icons.search,
            enabled: !_busy,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 10),
          if (_teachersError != null)
            Text(
              _teachersError!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.maroon,
                fontWeight: FontWeight.w600,
              ),
            )
          else if (teachers == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: CampusLoading(label: 'Loading teachers…', compact: true),
            )
          else if (filtered == null || filtered.isEmpty)
            Text(
              'No teacher matches that search.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final teacher = filtered[index];
                  final selected = teacher.id == _selected?.id;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: CampusCard(
                      onTap: _busy
                          ? null
                          : () => setState(() => _selected = teacher),
                      borderColor: selected ? tokens.gold : null,
                      color: selected
                          ? tokens.gold.withValues(alpha: 0.12)
                          : null,
                      padding: const EdgeInsets.all(10),
                      child: Row(
                        children: <Widget>[
                          Icon(
                            selected
                                ? Icons.check_circle
                                : Icons.person_outline,
                            size: 18,
                            color: selected ? tokens.maroon : tokens.muted,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(
                                  teacher.fullName,
                                  style: Theme.of(context).textTheme.bodyMedium
                                      ?.copyWith(fontWeight: FontWeight.w600),
                                ),
                                Text(
                                  teacher.email ?? teacher.department ?? '',
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(color: tokens.muted),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
        ] else ...<Widget>[
          CampusTextField(
            controller: _fullName,
            label: 'Full name',
            textCapitalization: TextCapitalization.words,
            enabled: !_busy,
          ),
          const SizedBox(height: 12),
          CampusTextField(
            controller: _email,
            label: 'PUP email',
            keyboardType: TextInputType.emailAddress,
            enabled: !_busy,
          ),
          const SizedBox(height: 12),
          CampusTextField(
            controller: _department,
            label: 'Department',
            textCapitalization: TextCapitalization.characters,
            enabled: !_busy,
          ),
          const SizedBox(height: 12),
          CampusTextField(
            controller: _password,
            label: 'Temporary password',
            obscure: true,
            helperText:
                '12+ characters with uppercase, lowercase, a number, and a '
                'symbol.',
            enabled: !_busy,
          ),
        ],
        const SizedBox(height: 16),
        CampusButton(
          label: _busy
              ? 'Saving…'
              : (_mode == AdminMode.promote
                    ? 'Promote to super admin'
                    : 'Create super admin'),
          icon: Icons.admin_panel_settings_outlined,
          loading: _busy,
          onPressed: _busy ? null : _submit,
        ),
      ],
    );
  }
}
