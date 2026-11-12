import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_models.dart';
import '../../../../core/api/api_providers.dart';
import '../../../../core/models/user.dart';
import '../../../../core/providers/session_provider.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/campus_card.dart';
import '../../../../core/widgets/campus_loading.dart';

/// App-level RA 10173 consent gate (mirrors the web `PrivacyConsentGate`).
///
/// Students must accept the current published notice before attendance
/// submission is meaningful. The gate sits above every authenticated route and
/// disappears as soon as the accepted version matches the server's notice.
class PrivacyConsentGate extends ConsumerStatefulWidget {
  const PrivacyConsentGate({super.key});

  @override
  ConsumerState<PrivacyConsentGate> createState() => _PrivacyConsentGateState();
}

class _PrivacyConsentGateState extends ConsumerState<PrivacyConsentGate> {
  String? _userId;
  PrivacyNotice? _notice;
  String? _error;
  bool _loading = false;
  bool _submitting = false;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider.select((state) => state.user));
    if (user == null ||
        user.role != UserRole.student ||
        user.mustChangePassword) {
      _userId = null;
      return const SizedBox.shrink();
    }

    if (_userId != user.id) {
      _userId = user.id;
      _notice = null;
      _error = null;
      _loading = false;
      Future<void>.microtask(_loadNotice);
    }

    final requiresConsent = _notice != null
        ? user.privacyConsentVersion != _notice!.version
        : user.privacyConsentedAt == null;
    if (!requiresConsent) return const SizedBox.shrink();

    return Positioned.fill(
      child: Material(
        color: Colors.black.withValues(alpha: 0.8),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 540),
                child: CampusCard(
                  padding: EdgeInsets.zero,
                  child: _gateBody(context, user),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _gateBody(BuildContext context, User user) {
    final tokens = PupTheme.of(context);
    final textTheme = Theme.of(context).textTheme;
    final notice = _notice;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(height: 4, color: tokens.gold),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'PRIVACY CONSENT',
                style: textTheme.labelSmall?.copyWith(
                  color: tokens.isDark ? tokens.gold : tokens.maroon,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.6,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Attendance uses location evidence',
                style: textTheme.headlineSmall?.copyWith(
                  color: tokens.onSurface,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                notice?.summary ??
                    'The current privacy notice must be loaded before '
                        'attendance check-in can be used.',
                style: textTheme.bodyMedium?.copyWith(
                  color: tokens.muted,
                  height: 1.5,
                ),
              ),
              if (_loading) ...[
                const SizedBox(height: 14),
                const CampusLoading(
                  label: 'Loading privacy notice.',
                  compact: true,
                ),
              ],
              if (notice != null) ...[
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: () => _showNoticeLink(notice),
                    child: const Text('Read the complete privacy notice'),
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 10),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    _error!,
                    style: textTheme.bodySmall?.copyWith(
                      color: tokens.isDark ? tokens.gold : tokens.maroon,
                      fontWeight: FontWeight.w600,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 18),
              if (notice != null)
                CampusButton(
                  label: _submitting
                      ? 'Recording consent.'
                      : 'I understand and consent',
                  loading: _submitting,
                  onPressed: _submitting ? null : () => _accept(notice),
                ),
              const SizedBox(height: 10),
              CampusButton(
                label: 'Retry',
                variant: CampusButtonVariant.outline,
                loading: _loading,
                onPressed: _loading || _submitting ? null : _loadNotice,
              ),
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: _submitting ? null : _signOut,
                  child: const Text('Sign out instead'),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'If you decline, QR attendance submission remains disabled. '
                '${user.fullName}, your response is recorded against the '
                'current notice version.',
                style: textTheme.bodySmall?.copyWith(
                  color: tokens.muted,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _loadNotice() async {
    if (_loading) return;
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final notice = await ref.read(sessionApiProvider).getPrivacyNotice();
      if (!mounted) return;
      setState(() => _notice = notice);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error =
            'Connect to the internet to review and accept the privacy notice.';
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _accept(PrivacyNotice notice) async {
    if (_submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(sessionApiProvider).acceptPrivacyConsent(notice.version);
      await ref.read(sessionProvider.notifier).refreshMe();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Unable to record privacy consent. Please try again.';
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _signOut() async {
    await ref.read(sessionProvider.notifier).logout();
  }

  Future<void> _showNoticeLink(PrivacyNotice notice) async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Privacy notice'),
          content: SelectableText(notice.url),
          actions: [
            TextButton(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: notice.url));
                if (dialogContext.mounted) Navigator.of(dialogContext).pop();
              },
              child: const Text('Copy link'),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }
}
