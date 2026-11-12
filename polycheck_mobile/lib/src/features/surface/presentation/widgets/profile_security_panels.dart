import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_models.dart';
import '../../../../core/api/api_providers.dart';
import '../../../../core/models/user.dart';
import '../../../../core/network/api_error.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/providers/device_now.dart';
import '../../../../core/providers/trusted_clock.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/campus_dialog.dart';
import '../../../../core/widgets/campus_text_field.dart';
import '../../../../core/widgets/campus_toast.dart';
import '../../data/device_binding_view.dart';
import '../../data/profile_validation.dart';

/// Self-service password rotation with inline policy validation.
class PasswordSecurityPanel extends ConsumerStatefulWidget {
  const PasswordSecurityPanel({
    super.key,
    required this.user,
    required this.onUpdated,
  });

  final User user;
  final ValueChanged<User> onUpdated;

  @override
  ConsumerState<PasswordSecurityPanel> createState() =>
      _PasswordSecurityPanelState();
}

class _PasswordSecurityPanelState extends ConsumerState<PasswordSecurityPanel> {
  final TextEditingController _current = TextEditingController();
  final TextEditingController _next = TextEditingController();
  final TextEditingController _confirm = TextEditingController();
  bool _saving = false;
  bool _attempted = false;
  String? _serverError;

  PasswordFormErrors get _errors => validatePasswordForm(
    currentPassword: _current.text,
    newPassword: _next.text,
    confirmation: _confirm.text,
  );

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_saving) return;
    setState(() {
      _attempted = true;
      _serverError = null;
    });
    if (!_errors.isEmpty) return;
    setState(() => _saving = true);
    try {
      final updated = await ref
          .read(sessionApiProvider)
          .changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      if (!mounted) return;
      widget.onUpdated(updated);
      _current.clear();
      _next.clear();
      _confirm.clear();
      setState(() {
        _attempted = false;
        _saving = false;
      });
      CampusToast.showIn(
        context,
        'Password changed. Other devices were signed out; this session stays '
        'signed in.',
        tone: CampusToastTone.success,
        duration: const Duration(seconds: 4),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _serverError = error is ApiRequestError
            ? error.message
            : 'Unable to change the password. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final errors = _errors;
    final canSubmit = !_saving && errors.isEmpty && _current.text.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Change your password',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: tokens.onSurface,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'At least 12 characters with uppercase, lowercase, a number, and a '
          'symbol. Other signed-in devices are signed out.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
        const SizedBox(height: 14),
        CampusTextField(
          controller: _current,
          label: 'Current password',
          obscure: true,
          autofillHints: const [AutofillHints.password],
          textInputAction: TextInputAction.next,
          onChanged: (_) => setState(() {}),
          errorText: _attempted ? errors.currentPassword : null,
        ),
        const SizedBox(height: 10),
        CampusTextField(
          controller: _next,
          label: 'New password',
          obscure: true,
          autofillHints: const [AutofillHints.newPassword],
          textInputAction: TextInputAction.next,
          onChanged: (_) => setState(() {}),
          errorText: _next.text.isEmpty ? null : errors.newPassword,
        ),
        const SizedBox(height: 10),
        CampusTextField(
          controller: _confirm,
          label: 'Confirm new password',
          obscure: true,
          autofillHints: const [AutofillHints.newPassword],
          textInputAction: TextInputAction.done,
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) => unawaited(_submit()),
          errorText: _confirm.text.isEmpty ? null : errors.confirmation,
        ),
        if (_serverError != null) ...[
          const SizedBox(height: 10),
          Semantics(
            liveRegion: true,
            child: Text(
              _serverError!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.isDark ? tokens.gold : tokens.maroon,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        CampusButton(
          label: 'Change password',
          icon: Icons.check,
          loading: _saving,
          onPressed: canSubmit ? () => unawaited(_submit()) : null,
        ),
      ],
    );
  }
}

/// Secondary contact channels (`PATCH /users/me/contacts`).
class ContactsPanel extends ConsumerStatefulWidget {
  const ContactsPanel({super.key, required this.user, required this.onUpdated});

  final User user;
  final ValueChanged<User> onUpdated;

  @override
  ConsumerState<ContactsPanel> createState() => _ContactsPanelState();
}

class _ContactsPanelState extends ConsumerState<ContactsPanel> {
  late final TextEditingController _email = TextEditingController(
    text: widget.user.contactEmail ?? '',
  );
  late final TextEditingController _phone = TextEditingController(
    text: widget.user.contactPhone ?? '',
  );
  bool _saving = false;
  String? _error;

  bool get _dirty =>
      _email.text.trim() != (widget.user.contactEmail ?? '') ||
      _phone.text.trim() != (widget.user.contactPhone ?? '');

  @override
  void didUpdateWidget(ContactsPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.contactEmail != widget.user.contactEmail ||
        oldWidget.user.contactPhone != widget.user.contactPhone) {
      _email.text = widget.user.contactEmail ?? '';
      _phone.text = widget.user.contactPhone ?? '';
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await ref
          .read(usersApiProvider)
          .updateContacts(
            UpdateContactsInput(
              contactEmail: _email.text.trim(),
              contactPhone: _phone.text.trim(),
            ),
          );
      if (!mounted) return;
      widget.onUpdated(updated);
      setState(() => _saving = false);
      CampusToast.showIn(
        context,
        'Contact details saved.',
        tone: CampusToastTone.success,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error is ApiRequestError
            ? error.message
            : 'Unable to save contact details.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Secondary contacts',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: tokens.onSurface,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Used for account recovery and emergency contact. Clear a field and '
          'save to remove it; your sign-in identity never changes here.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
        const SizedBox(height: 14),
        CampusTextField(
          controller: _email,
          label: 'Personal email',
          hint: 'you@example.com',
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 10),
        CampusTextField(
          controller: _phone,
          label: 'Emergency mobile number',
          hint: '+63 917 123 4567',
          keyboardType: TextInputType.phone,
          autofillHints: const [AutofillHints.telephoneNumber],
          onChanged: (_) => setState(() {}),
        ),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Semantics(
            liveRegion: true,
            child: Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.isDark ? tokens.gold : tokens.maroon,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: CampusButton(
                label: 'Save contacts',
                icon: Icons.save_outlined,
                variant: CampusButtonVariant.outline,
                loading: _saving,
                onPressed: _dirty && !_saving ? () => unawaited(_save()) : null,
              ),
            ),
            if (_dirty) ...[
              const SizedBox(width: 10),
              Text(
                'UNSAVED',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.isDark ? tokens.gold : tokens.maroon,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

/// Student device binding + cooldown panel.
class DeviceBindingPanel extends ConsumerStatefulWidget {
  const DeviceBindingPanel({
    super.key,
    required this.user,
    required this.onUpdated,
  });

  final User user;
  final ValueChanged<User> onUpdated;

  @override
  ConsumerState<DeviceBindingPanel> createState() => _DeviceBindingPanelState();
}

class _DeviceBindingPanelState extends ConsumerState<DeviceBindingPanel> {
  Timer? _ticker;
  String? _currentDeviceId;
  bool _unregistering = false;
  bool _unregistered = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_loadDeviceId());
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _loadDeviceId() async {
    try {
      final deviceId = await ref.read(deviceIdentityProvider).getOrCreate();
      if (mounted) setState(() => _currentDeviceId = deviceId);
    } catch (_) {
      // The chip falls back to "unknown"; unregister still works with the
      // server-side bound id.
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _unregister() async {
    final confirmed = await showCampusDialog<bool>(
      context,
      title: 'Unregister this device?',
      description:
          'Unregistering locks mobile sign-ins for the institution cooldown '
          'window (default 2 hours). This device is signed out on the server; '
          'ask your instructor for an emergency device release if you need '
          'access sooner.',
      actionBuilders: [
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: const Text('Unregister'),
        ),
      ],
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _unregistering = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(usersApiProvider)
          .unregisterDevice(widget.user.boundDeviceId ?? '');
      if (!mounted) return;
      widget.onUpdated(result.user);
      setState(() {
        _unregistering = false;
        _unregistered = true;
      });
      CampusToast.showIn(
        context,
        result.message.isEmpty ? 'Device unregistered.' : result.message,
        tone: CampusToastTone.success,
        duration: const Duration(seconds: 4),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _unregistering = false;
        _error = error is ApiRequestError
            ? error.message
            : 'Unable to unregister this device.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final clock = ref.watch(trustedClockProvider);
    final deviceNow = ref.watch(deviceNowProvider);
    final now = clock.now(deviceNow: deviceNow);
    final cooldown = deviceCooldownStatus(
      now: now,
      cooldownUntil: widget.user.deviceCooldownUntil,
      cooldownDeviceId: widget.user.cooldownDeviceId,
      currentDeviceId: _currentDeviceId,
    );
    final bound = widget.user.boundDeviceId;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Bound mobile device',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: tokens.onSurface,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            _DeviceChip(
              label: bound == null || bound.isEmpty ? 'UNBOUND' : 'BOUND',
              background: bound == null || bound.isEmpty
                  ? tokens.campus
                  : (tokens.isDark
                        ? tokens.gold.withValues(alpha: 0.16)
                        : tokens.gold.withValues(alpha: 0.28)),
              foreground: bound == null || bound.isEmpty
                  ? tokens.muted
                  : (tokens.isDark ? tokens.gold : tokens.deepMaroon),
              border: bound == null || bound.isEmpty
                  ? tokens.borderSubtle
                  : tokens.gold,
            ),
            if (cooldown.exempt)
              _DeviceChip(
                label: 'COOLDOWN-EXEMPT',
                background: tokens.campus,
                foreground: tokens.muted,
                border: tokens.borderSubtle,
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (bound != null && bound.isNotEmpty) ...[
          Text(
            boundDeviceLabel(bound),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: tokens.onSurface,
              fontFamily: 'monospace',
            ),
          ),
          Text(
            widget.user.deviceBoundAt == null
                ? 'Bound recently'
                : 'Bound ${_formatDate(widget.user.deviceBoundAt!)}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
        ] else
          Text(
            'No device is bound. Sign in on the Polycheck mobile app to bind '
            'this account to a device.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted),
          ),
        if (cooldown.active) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: tokens.isDark
                  ? tokens.gold.withValues(alpha: 0.10)
                  : tokens.gold.withValues(alpha: 0.2),
              border: Border.all(color: tokens.gold),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.lock_clock_outlined,
                  size: 15,
                  color: tokens.isDark ? tokens.gold : tokens.deepMaroon,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Mobile sign-ins locked \u00b7 ${cooldown.countdown} left',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: tokens.isDark ? tokens.gold : tokens.deepMaroon,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        if (_unregistered) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: tokens.campus,
              border: Border.all(color: tokens.borderSubtle),
            ),
            child: Text(
              'Device unregistered. Sessions were revoked on the server; '
              'you will be asked to sign in again on the next protected '
              'request. The cooldown above is enforced on the server.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.4),
            ),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 10),
          Semantics(
            liveRegion: true,
            child: Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.isDark ? tokens.gold : tokens.maroon,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        Text(
          'Unregister when switching to a new phone. Mobile sessions end '
          'immediately and new sign-ins stay locked for the cooldown window. '
          'Your instructor can release you sooner.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.4),
        ),
        const SizedBox(height: 10),
        CampusButton(
          label: 'Unregister this device',
          icon: Icons.phonelink_erase,
          variant: CampusButtonVariant.outline,
          loading: _unregistering,
          onPressed: bound == null || bound.isEmpty || _unregistering
              ? null
              : () => unawaited(_unregister()),
        ),
      ],
    );
  }

  String _formatDate(String iso) {
    final date = DateTime.tryParse(iso)?.toLocal();
    if (date == null) return 'recently';
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-'
        '${date.day.toString().padLeft(2, '0')}';
  }
}

class _DeviceChip extends StatelessWidget {
  const _DeviceChip({
    required this.label,
    required this.background,
    required this.foreground,
    required this.border,
  });

  final String label;
  final Color background;
  final Color foreground;
  final Color border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: foreground,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
          fontSize: 9,
        ),
      ),
    );
  }
}
