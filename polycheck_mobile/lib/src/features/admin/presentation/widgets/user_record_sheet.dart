import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_providers.dart';
import '../../../../core/models/dashboard.dart';
import '../../../../core/models/user.dart';
import '../../../../core/providers/session_provider.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/utils/designations.dart';
import '../../../../core/widgets/campus_badge.dart';
import '../../../../core/widgets/campus_bottom_sheet.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/campus_card.dart';
import '../../../../core/widgets/campus_dialog.dart';
import '../../../../core/widgets/campus_text_field.dart';
import '../../../../core/widgets/campus_toast.dart';
import '../../application/admin_users_api.dart';
import '../../domain/admin_access.dart';
import '../../domain/admin_users.dart';
import 'admin_common.dart';
import 'credential_result_dialog.dart';

Future<void> showUserRecordSheet(
  BuildContext context, {
  required User account,
  required VoidCallback onChanged,
}) {
  return showCampusBottomSheet<void>(
    context,
    title: 'Account details',
    child: UserRecordSheet(account: account, onChanged: onChanged),
  );
}

class UserRecordSheet extends ConsumerStatefulWidget {
  const UserRecordSheet({
    super.key,
    required this.account,
    required this.onChanged,
  });

  final User account;
  final VoidCallback onChanged;

  @override
  ConsumerState<UserRecordSheet> createState() => _UserRecordSheetState();
}

class _UserRecordSheetState extends ConsumerState<UserRecordSheet> {
  late final Map<EditableUserField, TextEditingController> _controllers = {
    for (final field in EditableUserField.values)
      field: TextEditingController(
        text: editableValuesForUser(widget.account)[field] ?? '',
      ),
  };
  late CapabilityChoice _resetChoice = capabilityChoiceFrom(
    widget.account.canResetStudentPasswords,
  );
  late CapabilityChoice _unbindChoice = capabilityChoiceFrom(
    widget.account.canEmergencyUnbindDevices,
  );
  late bool _isItCoordinator = widget.account.isItCoordinator;
  late bool _isDepartmentHead = widget.account.isDepartmentHead;
  late bool _isUserRegistrar = widget.account.isUserRegistrar;

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final target = widget.account;
    final values = <EditableUserField, String>{
      for (final entry in _controllers.entries) entry.key: entry.value.text,
    };
    final validation = validateUserUpdate(target, values);
    if (validation != null) {
      setState(() => _error = validation);
      return;
    }
    final isTeacher = target.role == UserRole.teacher;
    final payload = buildUserUpdatePayload(
      target,
      values,
      resetChoice: isTeacher ? _resetChoice : null,
      unbindChoice: isTeacher ? _unbindChoice : null,
      isItCoordinator: isTeacher ? _isItCoordinator : null,
      isDepartmentHead: isTeacher ? _isDepartmentHead : null,
      isUserRegistrar: isTeacher ? _isUserRegistrar : null,
    );
    if (!hasUserChanges(payload)) {
      CampusToast.showIn(context, 'No changes to save.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(adminUsersApiProvider).patchUser(target.id, payload);
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
        'Account updated.',
        tone: CampusToastTone.success,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = adminUsersErrorMessage(error);
      });
    }
  }

  Future<void> _resetPassword() async {
    final confirmed = await showCampusDialog<bool>(
      context,
      title: 'Reset password',
      description:
          'Generate a new temporary password for ${widget.account.fullName}? '
          'Existing sessions will be revoked and the password is shown once.',
      actionBuilders: <CampusDialogActionBuilder>[
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        (dialogContext) => CampusButton(
          label: 'Generate',
          expand: false,
          height: 44,
          onPressed: () => Navigator.of(dialogContext).pop(true),
        ),
      ],
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(usersApiProvider)
          .resetUserPassword(widget.account.id);
      if (!mounted) return;
      setState(() => _busy = false);
      final password = result.temporaryPassword;
      if (password != null && password.isNotEmpty) {
        await showCredentialResultDialog(
          context,
          accountName: widget.account.fullName,
          identifier: widget.account.studentId ?? widget.account.email ?? '',
          temporaryPassword: password,
        );
      }
      widget.onChanged();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = adminUsersErrorMessage(error);
      });
    }
  }

  Future<void> _toggleStatus() async {
    final target = widget.account;
    final nextActive = !target.isActive;
    final confirmed = await showCampusDialog<bool>(
      context,
      title: nextActive ? 'Enable account' : 'Disable account',
      description: nextActive
          ? 'Restore sign-in access for ${target.fullName}?'
          : 'Disable ${target.fullName}? They will be signed out and cannot '
                'sign in until re-enabled.',
      actionBuilders: <CampusDialogActionBuilder>[
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        (dialogContext) => CampusButton(
          label: nextActive ? 'Enable' : 'Disable',
          variant: nextActive
              ? CampusButtonVariant.primary
              : CampusButtonVariant.destructive,
          expand: false,
          height: 44,
          onPressed: () => Navigator.of(dialogContext).pop(true),
        ),
      ],
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(usersApiProvider).setUserStatus(target.id, nextActive);
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
        nextActive ? 'Account enabled.' : 'Account disabled.',
        tone: CampusToastTone.success,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = adminUsersErrorMessage(error);
      });
    }
  }

  Future<void> _changeRole() async {
    final nextRole = assignableRoleFor(widget.account);
    if (nextRole == null) return;
    final copy = roleChangeCopy(widget.account, nextRole);
    final confirmed = await showCampusDialog<bool>(
      context,
      title: copy.title,
      description: copy.consequence,
      actionBuilders: <CampusDialogActionBuilder>[
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        (dialogContext) => CampusButton(
          label: copy.confirmLabel,
          expand: false,
          height: 44,
          onPressed: () => Navigator.of(dialogContext).pop(true),
        ),
      ],
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(usersApiProvider)
          .changeUserRole(widget.account.id, nextRole);
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
        'Role updated.',
        tone: CampusToastTone.success,
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
    final target = widget.account;
    final actor = ref.watch(sessionProvider).user;
    final access = adminAccessFor(actor);
    final registrar =
        actor?.role == UserRole.teacher && canAccessUserAdmin(actor);
    final fields = editableFieldsForRole(target.role).toSet();
    final manageable = canManageUser(target);
    final isTeacher = target.role == UserRole.teacher;
    final nextRole = assignableRoleFor(target);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Row(
          children: <Widget>[
            CircleAvatar(
              radius: 22,
              backgroundColor: tokens.maroon,
              child: Text(
                accountInitials(target.fullName),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    target.fullName,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    target.studentId ?? target.email ?? 'No identifier',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                ],
              ),
            ),
            CampusBadge(
              label: userRoleLabel(target.role),
              background: tokens.campus,
              foreground: tokens.onSurface,
              border: tokens.borderSubtle,
              dense: true,
            ),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: <Widget>[
            AdminStatusChip(
              label: target.isActive ? 'Active' : 'Disabled',
              active: target.isActive,
            ),
            if (target.mustChangePassword)
              AdminStatusChip(
                label: 'Password rotation pending',
                active: false,
                positive: false,
              ),
            if (target.canResetStudentPasswords != null)
              AdminStatusChip(
                label: target.canResetStudentPasswords!
                    ? 'Password reset override: allow'
                    : 'Password reset override: deny',
                active: false,
                positive: false,
              ),
            for (final designation in activeDesignations(target))
              AdminStatusChip(label: designation.label, active: true),
          ],
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
        if (!manageable) ...<Widget>[
          const SizedBox(height: 12),
          CampusCard(
            color: tokens.campus,
            child: Text(
              'Super administrator accounts are protected. Manage them '
              'through provisioning, not this console.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ),
        ],
        if (manageable) ...<Widget>[
          const SizedBox(height: 16),
          CampusTextField(
            controller: _controllers[EditableUserField.fullName],
            label: 'Full name',
            textCapitalization: TextCapitalization.words,
            enabled: !_busy,
          ),
          if (fields.contains(EditableUserField.email)) ...<Widget>[
            const SizedBox(height: 12),
            CampusTextField(
              controller: _controllers[EditableUserField.email],
              label: 'PUP email',
              keyboardType: TextInputType.emailAddress,
              enabled: !_busy && !registrar,
              helperText: registrar ? 'Registrars cannot change emails.' : null,
            ),
          ],
          if (fields.contains(EditableUserField.department) && !registrar) ...[
            const SizedBox(height: 12),
            CampusTextField(
              controller: _controllers[EditableUserField.department],
              label: 'Department',
              textCapitalization: TextCapitalization.characters,
              enabled: !_busy,
            ),
          ],
          if (fields.contains(EditableUserField.program)) ...<Widget>[
            const SizedBox(height: 12),
            CampusTextField(
              controller: _controllers[EditableUserField.program],
              label: 'Program',
              textCapitalization: TextCapitalization.characters,
              enabled: !_busy,
            ),
          ],
          if (fields.contains(EditableUserField.yearLevel)) ...<Widget>[
            const SizedBox(height: 12),
            CampusTextField(
              controller: _controllers[EditableUserField.yearLevel],
              label: 'Year level',
              keyboardType: TextInputType.number,
              enabled: !_busy,
            ),
          ],
          if (isTeacher && !registrar) ...<Widget>[
            const SizedBox(height: 16),
            const AdminSectionLabel('Delegated capabilities'),
            const SizedBox(height: 8),
            _CapabilityPicker(
              label: 'Student password resets',
              value: _resetChoice,
              onChanged: (value) => setState(() => _resetChoice = value),
            ),
            const SizedBox(height: 10),
            _CapabilityPicker(
              label: 'Emergency device release',
              value: _unbindChoice,
              onChanged: (value) => setState(() => _unbindChoice = value),
            ),
            Text(
              'Follow the institution default unless this teacher needs a '
              'stricter setting. A per-teacher override can restrict but '
              'never enable a disabled institution capability.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ],
          if (isTeacher && access.canManageDesignations) ...<Widget>[
            const SizedBox(height: 16),
            const AdminSectionLabel('Administrative designations'),
            const SizedBox(height: 4),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              value: _isItCoordinator,
              title: const Text('IT Coordinator'),
              subtitle: const Text(
                'Server status, issue triage, and maintenance controls.',
              ),
              onChanged: _busy
                  ? null
                  : (value) => setState(() => _isItCoordinator = value),
            ),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              value: _isDepartmentHead,
              title: const Text('Department Head'),
              subtitle: const Text(
                'Department-wide reports, excuses, and at-risk oversight.',
              ),
              onChanged: _busy
                  ? null
                  : (value) => setState(() => _isDepartmentHead = value),
            ),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              value: _isUserRegistrar,
              title: const Text('Registrar'),
              subtitle: const Text(
                'Department-scoped account creation, resets, and roster '
                'imports.',
              ),
              onChanged: _busy
                  ? null
                  : (value) => setState(() => _isUserRegistrar = value),
            ),
          ],
          if (target.contactEmail != null || target.contactPhone != null) ...[
            const SizedBox(height: 12),
            const AdminSectionLabel('Emergency contacts'),
            const SizedBox(height: 4),
            Text(
              target.contactEmail ?? 'No contact email',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            Text(
              target.contactPhone ?? 'No contact phone',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (target.role == UserRole.student &&
              (target.boundDeviceId != null ||
                  target.deviceCooldownUntil != null)) ...[
            const SizedBox(height: 12),
            const AdminSectionLabel('Device binding'),
            const SizedBox(height: 4),
            Text(
              target.boundDeviceId == null
                  ? 'No bound device'
                  : 'Bound: ${target.boundDeviceId}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (target.deviceCooldownUntil != null)
              Text(
                'Cooldown until '
                '${formatCooldown(target.deviceCooldownUntil!)}',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
          ],
          const SizedBox(height: 18),
          Row(
            children: <Widget>[
              Expanded(
                child: CampusButton(
                  label: 'Reset password',
                  icon: Icons.key_outlined,
                  variant: CampusButtonVariant.outline,
                  onPressed: _busy ? null : _resetPassword,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CampusButton(
                  label: target.isActive ? 'Disable' : 'Enable',
                  icon: target.isActive
                      ? Icons.block_outlined
                      : Icons.check_circle_outline,
                  variant: CampusButtonVariant.outline,
                  onPressed: _busy ? null : _toggleStatus,
                ),
              ),
            ],
          ),
          if (access.canManageDesignations && nextRole != null) ...<Widget>[
            const SizedBox(height: 8),
            CampusButton(
              label:
                  'Change role to ${userRoleLabel(nextRole == AssignableRole.teacher ? UserRole.teacher : UserRole.student)}',
              icon: Icons.swap_horiz,
              variant: CampusButtonVariant.outline,
              onPressed: _busy ? null : _changeRole,
            ),
          ],
          const SizedBox(height: 14),
          CampusButton(
            label: _busy ? 'Saving…' : 'Save changes',
            loading: _busy,
            onPressed: _busy ? null : _save,
          ),
        ],
      ],
    );
  }

  String formatCooldown(String iso) {
    final date = DateTime.tryParse(iso);
    if (date == null) return iso;
    final local = date.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-'
        '${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }
}

class _CapabilityPicker extends StatelessWidget {
  const _CapabilityPicker({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final CapabilityChoice value;
  final ValueChanged<CapabilityChoice> onChanged;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        SegmentedButton<CapabilityChoice>(
          segments: <ButtonSegment<CapabilityChoice>>[
            for (final choice in CapabilityChoice.values)
              ButtonSegment<CapabilityChoice>(
                value: choice,
                label: Text(choice.label),
              ),
          ],
          selected: <CapabilityChoice>{value},
          onSelectionChanged: (selection) => onChanged(selection.first),
          style: ButtonStyle(
            shape: const WidgetStatePropertyAll(
              RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            ),
            side: WidgetStatePropertyAll(
              BorderSide(color: tokens.borderSubtle),
            ),
            textStyle: WidgetStatePropertyAll(
              Theme.of(context).textTheme.labelMedium,
            ),
          ),
        ),
      ],
    );
  }
}
