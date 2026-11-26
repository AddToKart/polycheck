import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/api/session_api.dart';
import '../../../core/network/api_error.dart';
import '../../../core/router/routes/app_routes.dart';
import '../../../core/theme/brand_theme.dart';
import '../../../core/widgets/campus_button.dart';
import '../../../core/widgets/campus_text_field.dart';
import 'widgets/auth_shell.dart';

/// Student number format shared with the backend (`2024-00001-MN-0`).
final RegExp _studentNumberPattern = RegExp(r'^\d{4}-\d{5}-[A-Za-z]{2}-\d$');

enum _Phase { form, sent, unavailable }

/// Starts a self-service password reset.
///
/// The app only *requests* the email; choosing the new password happens on the
/// web page the emailed link opens, after which the student signs in here
/// again. A student with no bound email is pointed at their instructor, who
/// can issue a temporary password.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final TextEditingController _studentIdController = TextEditingController();
  _Phase _phase = _Phase.form;
  String? _fieldError;
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _studentIdController.dispose();
    super.dispose();
  }

  String get _normalizedStudentId =>
      _studentIdController.text.replaceAll(RegExp(r'\s+'), '').toUpperCase();

  Future<void> _submit() async {
    if (_submitting) return;
    final studentId = _normalizedStudentId;
    if (!_studentNumberPattern.hasMatch(studentId)) {
      setState(() {
        _fieldError =
            'Enter your student number exactly as shown on your ID, for '
            'example 2024-00001-MN-0.';
        _error = null;
      });
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _fieldError = null;
      _error = null;
    });
    try {
      final delivery = await ref
          .read(sessionApiProvider)
          .requestPasswordReset(studentId);
      if (!mounted) return;
      setState(() {
        _phase = delivery == PasswordResetDelivery.email
            ? _Phase.sent
            : _Phase.unavailable;
      });
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.status == 429
            ? 'Too many requests from this connection. Please wait a few '
                  'minutes and try again.'
            : 'Cannot reach the Polycheck server. Check your connection and '
                  'try again.';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error =
            'Cannot reach the Polycheck server. Check your connection and try '
            'again.';
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _backToForm() => setState(() {
    _phase = _Phase.form;
    _error = null;
  });

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      eyebrow: 'Password help',
      title: switch (_phase) {
        _Phase.form => 'Forgot your password?',
        _Phase.sent => 'Check your email',
        _Phase.unavailable => 'No email on file',
      },
      subtitle: _phase == _Phase.form
          ? 'Enter your student number. If you added an email to your profile, '
                'we will send a link there to choose a new password.'
          : null,
      showBack: false,
      child: switch (_phase) {
        _Phase.form => _buildForm(context),
        _Phase.sent => _buildSent(context),
        _Phase.unavailable => _buildUnavailable(context),
      },
    );
  }

  Widget _buildForm(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_error != null) ...[
          AuthErrorBanner(message: _error!),
          const SizedBox(height: 14),
        ],
        CampusTextField(
          controller: _studentIdController,
          label: 'Student number',
          hint: '2024-00123-MN-0',
          prefixIcon: Icons.badge_outlined,
          errorText: _fieldError,
          keyboardType: TextInputType.text,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.username],
          onChanged: (_) {
            if (_fieldError != null) setState(() => _fieldError = null);
          },
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: 20),
        CampusButton(
          label: _submitting ? 'Checking...' : 'Send reset link',
          loading: _submitting,
          onPressed: _submitting ? null : _submit,
        ),
        const SizedBox(height: 8),
        _backToSignIn(),
      ],
    );
  }

  Widget _buildSent(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final style = Theme.of(
      context,
    ).textTheme.bodyMedium?.copyWith(color: tokens.muted, height: 1.45);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AuthInfoBanner(
          message: 'We sent a reset link to the email on your profile.',
          icon: Icons.mark_email_read_outlined,
        ),
        const SizedBox(height: 14),
        Text(
          'It can take a few minutes, so check your spam or promotions folder '
          'too. The link works once and expires in about an hour. Open it in '
          'your browser to choose a new password.',
          style: style,
        ),
        const SizedBox(height: 10),
        Text(
          'After that, come back here and sign in with the new password.',
          style: style,
        ),
        const SizedBox(height: 20),
        CampusButton(
          label: 'Try another number',
          variant: CampusButtonVariant.outline,
          onPressed: _backToForm,
        ),
        const SizedBox(height: 8),
        _backToSignIn(),
      ],
    );
  }

  Widget _buildUnavailable(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final style = Theme.of(
      context,
    ).textTheme.bodyMedium?.copyWith(color: tokens.muted, height: 1.45);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AuthInfoBanner(
          message:
              'We could not find an email address added to this student '
              'account, so we could not send a reset link.',
          icon: Icons.mail_lock_outlined,
        ),
        const SizedBox(height: 14),
        Text(
          'Ask your instructor to reset your password. They can give you a '
          'temporary password in Polycheck, and you will choose your own '
          'right after you sign in.',
          style: style,
        ),
        const SizedBox(height: 10),
        Text(
          'Once you are back in, add your email under Profile so you can '
          'reset your password yourself next time.',
          style: style,
        ),
        const SizedBox(height: 20),
        CampusButton(
          label: 'Try another number',
          variant: CampusButtonVariant.outline,
          onPressed: _backToForm,
        ),
        const SizedBox(height: 8),
        _backToSignIn(),
      ],
    );
  }

  Widget _backToSignIn() => TextButton(
    onPressed: () => context.go(AppRoutes.studentLogin),
    child: const Text('Back to sign in'),
  );
}
