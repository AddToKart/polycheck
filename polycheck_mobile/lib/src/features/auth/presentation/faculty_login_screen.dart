import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_error.dart';
import '../../../core/providers/maintenance_provider.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/router/router_decision.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/widgets/campus_button.dart';
import '../../../core/widgets/campus_text_field.dart';
import 'widgets/auth_shell.dart';

/// Faculty / staff sign-in (email + password). Staff keep multi-device access.
class FacultyLoginScreen extends ConsumerStatefulWidget {
  const FacultyLoginScreen({super.key, this.redirect, this.reason});

  final String? redirect;
  final String? reason;

  @override
  ConsumerState<FacultyLoginScreen> createState() => _FacultyLoginScreenState();
}

class _FacultyLoginScreenState extends ConsumerState<FacultyLoginScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  String? _emailError;
  String? _passwordError;
  String? _error;
  bool _submitting = false;

  bool get _showsExpiredNotice =>
      widget.reason == 'expired' || ref.read(sessionProvider).expiredAt != null;

  @override
  void initState() {
    super.initState();
    if (widget.reason == 'expired') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(sessionProvider.notifier).clearExpiredReason();
      });
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final maintenance = ref.watch(maintenanceProvider);
    final tokens = PupTheme.of(context);
    final textTheme = Theme.of(context).textTheme;

    return AuthShell(
      eyebrow: 'Faculty & staff access',
      title: 'Sign in',
      subtitle:
          'Use your institutional email. Staff accounts may stay signed in on '
          'the web dashboard and mobile app at the same time.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_showsExpiredNotice) ...[
            const AuthInfoBanner(
              message:
                  'Your session was replaced or revoked. Sign in again to '
                  'continue.',
              icon: Icons.lock_clock_outlined,
            ),
            const SizedBox(height: 14),
          ],
          if (maintenance.enabled) ...[
            AuthInfoBanner(
              message:
                  'Polycheck is under scheduled maintenance. Only exempt '
                  'administrators can sign in right now.',
              icon: Icons.build_outlined,
            ),
            const SizedBox(height: 14),
          ],
          if (_error != null) ...[
            AuthErrorBanner(message: _error!),
            const SizedBox(height: 14),
          ],
          CampusTextField(
            controller: _emailController,
            label: 'Institutional email',
            hint: 'name@pup.edu.ph',
            prefixIcon: Icons.alternate_email,
            errorText: _emailError,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.username],
            onChanged: (_) {
              if (_emailError != null) setState(() => _emailError = null);
            },
          ),
          const SizedBox(height: 14),
          CampusTextField(
            controller: _passwordController,
            label: 'Password',
            obscure: true,
            prefixIcon: Icons.lock_outline,
            errorText: _passwordError,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            onChanged: (_) {
              if (_passwordError != null) setState(() => _passwordError = null);
            },
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 20),
          CampusButton(
            label: _submitting ? 'Verifying...' : 'Sign in',
            loading: _submitting,
            onPressed: _submitting ? null : _submit,
          ),
          const SizedBox(height: 14),
          Text(
            'Need an account? Faculty and staff accounts are provisioned by '
            'the campus registrar or a super admin.',
            style: textTheme.bodySmall?.copyWith(
              color: tokens.muted,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }

  bool _validate() {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final emailError = email.isEmpty
        ? 'Enter your institutional email.'
        : (!email.contains('@') || !email.contains('.')
              ? 'Enter a valid email address.'
              : null);
    final passwordError = password.isEmpty ? 'Enter your password.' : null;
    setState(() {
      _emailError = emailError;
      _passwordError = passwordError;
      _error = null;
    });
    return emailError == null && passwordError == null;
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (!_validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final user = await ref
          .read(sessionProvider.notifier)
          .loginFaculty(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
      if (!mounted) return;
      if (user.mustChangePassword) return;
      final role = resolveAppRole(
        user,
        officerPresident: false,
        officerQac: false,
      );
      final destination =
          resolvePostLoginDestination(
            redirect: widget.redirect,
            role: role,
            user: user,
          ) ??
          roleHome(role);
      context.go(destination);
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        if (error.isUnauthorized) {
          _error = 'Invalid email or password.';
        } else if (error.isNetworkFailure) {
          _error =
              'Cannot reach the Polycheck server. Check your connection and '
              'try again.';
        } else {
          _error = error.message.isEmpty
              ? 'Unable to sign in. Please try again.'
              : error.message;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error =
            'Unable to sign in. Please check your connection and try again.';
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
