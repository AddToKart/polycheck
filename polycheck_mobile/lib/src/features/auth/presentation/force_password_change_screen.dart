import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/network/api_error.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/router/router_decision.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/utils/password_policy.dart';
import '../../../core/widgets/campus_button.dart';
import '../../../core/widgets/campus_dialog.dart';
import '../../../core/widgets/campus_loading.dart';
import '../../../core/widgets/campus_text_field.dart';
import 'widgets/auth_shell.dart';
import 'widgets/password_policy_checklist.dart';

/// Forced first-login password rotation (bulk-provisioned / admin-reset users).
class ForcePasswordChangeScreen extends ConsumerStatefulWidget {
  const ForcePasswordChangeScreen({super.key});

  @override
  ConsumerState<ForcePasswordChangeScreen> createState() =>
      _ForcePasswordChangeScreenState();
}

class _ForcePasswordChangeScreenState
    extends ConsumerState<ForcePasswordChangeScreen> {
  final TextEditingController _currentController = TextEditingController();
  final TextEditingController _newController = TextEditingController();
  final TextEditingController _confirmController = TextEditingController();

  String? _error;
  bool _submitting = false;
  bool _confirmTouched = false;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final user = session.user;
    if (user == null) {
      return const Scaffold(body: CampusLoading(label: 'Checking session.'));
    }

    final tokens = PupTheme.of(context);
    final textTheme = Theme.of(context).textTheme;
    final compliant = isPasswordPolicyCompliant(_newController.text);
    final matches = _confirmController.text == _newController.text;
    final canSubmit =
        compliant &&
        matches &&
        _confirmController.text.isNotEmpty &&
        !_submitting;

    return AuthShell(
      eyebrow: 'Temporary password',
      title: 'Choose a new password',
      subtitle:
          '${user.fullName}, your account was created or reset with a '
          'temporary password. Change it before continuing.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[
            AuthErrorBanner(message: _error!),
            const SizedBox(height: 14),
          ],
          CampusTextField(
            controller: _currentController,
            label: 'Current password',
            helperText:
                'Optional when you signed in with a temporary password.',
            obscure: true,
            prefixIcon: Icons.lock_outline,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.password],
          ),
          const SizedBox(height: 14),
          CampusTextField(
            controller: _newController,
            label: 'New password',
            obscure: true,
            prefixIcon: Icons.password,
            helperText:
                'At least 12 characters, mixed case, a number, and a '
                'special character.',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            onChanged: (_) => setState(() => _error = null),
          ),
          const SizedBox(height: 10),
          PasswordPolicyChecklist(password: _newController.text),
          const SizedBox(height: 14),
          CampusTextField(
            controller: _confirmController,
            label: 'Confirm new password',
            obscure: true,
            prefixIcon: Icons.verified_user_outlined,
            errorText:
                _confirmTouched &&
                    _confirmController.text.isNotEmpty &&
                    !matches
                ? 'The password confirmation does not match.'
                : null,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.newPassword],
            onChanged: (_) {
              _confirmTouched = true;
              setState(() => _error = null);
            },
            onSubmitted: (_) {
              if (canSubmit) _submit();
            },
          ),
          const SizedBox(height: 20),
          CampusButton(
            label: _submitting ? 'Saving...' : 'Change password',
            loading: _submitting,
            onPressed: canSubmit ? _submit : null,
          ),
          const SizedBox(height: 12),
          Text(
            'Rotating the password keeps this session and signs out every other '
            'device. Password changes are limited to 5 attempts every 15 minutes.',
            style: textTheme.bodySmall?.copyWith(
              color: tokens.muted,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: _submitting ? null : _confirmSignOut,
              child: const Text('Sign out instead'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final newPassword = _newController.text;
    final policyError = validatePasswordPolicy(newPassword);
    if (policyError != null) {
      setState(() => _error = policyError);
      return;
    }
    if (_confirmController.text != newPassword) {
      setState(() => _error = 'The password confirmation does not match.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final current = _currentController.text;
      final updated = await ref
          .read(sessionApiProvider)
          .changePassword(
            currentPassword: current.isEmpty ? null : current,
            newPassword: newPassword,
          );
      await ref.read(sessionProvider.notifier).refreshMe();
      if (!mounted) return;
      final role = resolveAppRole(
        updated,
        officerPresident: false,
        officerQac: false,
      );
      context.go(roleHome(role));
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        if (error.isUnauthorized) {
          _error = 'Current password is incorrect.';
        } else if (error.isNetworkFailure) {
          _error =
              'Cannot reach the Polycheck server. Check your connection and '
              'try again.';
        } else {
          _error = error.message.isEmpty
              ? 'Unable to change the password. Please try again.'
              : error.message;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Unable to change the password. Please try again.';
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _confirmSignOut() async {
    final confirmed = await showCampusDialog<bool>(
      context,
      title: 'Sign out?',
      description:
          'You can sign back in with the temporary password and finish the '
          'rotation later.',
      actionBuilders: [
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: const Text('Sign out'),
        ),
      ],
    );
    if (confirmed == true) {
      await ref.read(sessionProvider.notifier).logout();
    }
  }
}
