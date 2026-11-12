import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/offline_readiness.dart';

/// Pre-session offline preparation chip (web `OfflineReadinessChip.tsx`
/// parity — B-11). States:
/// * `checking` (loading/error) → hidden,
/// * `ready` → gold-on-maroon shield pill "READY FOR OFFLINE CLASS",
/// * `key missing` (schedule covered, teacher keys absent) → warning pill
///   "KEY MISSING — PREPARE ONLINE AGAIN" plus the prepare action (SW-6),
/// * otherwise → outline button that runs [offlinePreparationProvider],
///   toasts the outcome, and re-evaluates (state flips when every cache and
///   the trusted-clock offset are in place).
class OfflineReadinessChip extends ConsumerStatefulWidget {
  const OfflineReadinessChip({super.key});

  @override
  ConsumerState<OfflineReadinessChip> createState() =>
      _OfflineReadinessChipState();
}

class _OfflineReadinessChipState extends ConsumerState<OfflineReadinessChip> {
  bool _preparing = false;

  Future<void> _prepare() async {
    if (_preparing) return;
    setState(() => _preparing = true);
    try {
      final user = ref.read(sessionProvider).user;
      if (user == null) return;
      final result = await ref
          .read(offlinePreparationProvider)
          .prepareForOfflineClass(user);
      ref.invalidate(offlineReadinessProvider);
      await ref.read(offlineReadinessProvider.future);
      if (!mounted) return;
      if (result.isComplete) {
        CampusToast.showIn(
          context,
          'Offline data is ready — you can check in without internet.',
          tone: CampusToastTone.success,
        );
      } else {
        CampusToast.showIn(
          context,
          'Could not finish offline preparation: '
          '${result.firstFailure?.error.message ?? 'connection failed'}.',
          tone: CampusToastTone.warning,
        );
      }
    } catch (error) {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'Could not prepare offline data: $error',
        tone: CampusToastTone.error,
      );
    } finally {
      if (mounted) setState(() => _preparing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(offlineReadinessProvider);
    return snapshot.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (value) {
        if (value.isReady) {
          return const _ReadyPill(key: ValueKey('offline-ready'));
        }
        if (value.keyCoverageMissing) {
          return _KeyMissingChip(
            key: const ValueKey('offline-key-missing'),
            preparing: _preparing,
            onTap: _preparing ? null : _prepare,
          );
        }
        return _PrepareButton(
          key: const ValueKey('offline-readiness-prepare'),
          preparing: _preparing,
          onTap: _preparing ? null : _prepare,
        );
      },
    );
  }
}

class _ReadyPill extends StatelessWidget {
  const _ReadyPill({super.key});

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusBadge(
      label: 'READY FOR OFFLINE CLASS',
      background: tokens.maroon,
      foreground: tokens.gold,
      border: tokens.gold,
      icon: Icons.verified_user_outlined,
    );
  }
}

/// Honest readiness state introduced by SW-6: the schedule is cached but one
/// or more classes today/tomorrow have no teacher verification key, so an
/// offline scan would fail closed. Keep the prepare action one tap away.
class _KeyMissingChip extends StatelessWidget {
  const _KeyMissingChip({
    super.key,
    required this.preparing,
    required this.onTap,
  });

  final bool preparing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        CampusBadge(
          label: 'KEY MISSING — PREPARE ONLINE AGAIN',
          background: tokens.gold,
          foreground: tokens.deepMaroon,
          border: tokens.deepMaroon,
          icon: Icons.key_off_outlined,
        ),
        const SizedBox(height: 6),
        _PrepareButton(
          key: const ValueKey('offline-key-missing-prepare'),
          preparing: preparing,
          onTap: onTap,
        ),
      ],
    );
  }
}

class _PrepareButton extends StatelessWidget {
  const _PrepareButton({
    super.key,
    required this.preparing,
    required this.onTap,
  });

  final bool preparing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return OutlinedButton.icon(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: tokens.isDark ? tokens.gold : tokens.maroon,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        side: BorderSide(color: tokens.borderSubtle),
        minimumSize: const Size(44, 44),
      ),
      icon: preparing
          ? SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: tokens.maroon,
              ),
            )
          : const Icon(Icons.cloud_download_outlined, size: 16),
      label: Text(
        preparing ? 'Preparing offline data…' : 'Prepare for offline class',
      ),
    );
  }
}
