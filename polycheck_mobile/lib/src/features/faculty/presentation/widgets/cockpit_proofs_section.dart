import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/polycheck_core.dart';
import '../../../../core/widgets/proof_photo_grid.dart';

final cockpitProofsProvider = FutureProvider.autoDispose
    .family<List<ProofOfClass>, String>(
      (ref, sessionId) =>
          ref.read(proofsApiProvider).getProofsOfClass(sessionId),
    );

/// The class photos QAC officers added to this session, for the professor.
class CockpitProofsSection extends ConsumerWidget {
  const CockpitProofsSection({super.key, required this.sessionId});

  final String sessionId;

  Future<void> _delete(
    BuildContext context,
    WidgetRef ref,
    ProofOfClass proof,
  ) async {
    final confirmed = await showCampusDialog<bool>(
      context,
      title: 'Delete this photo?',
      description:
          'The photo from ${proof.uploadedByStudentName} will be removed. This '
          'cannot be undone.',
      actionBuilders: [
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        (dialogContext) => TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: const Text('Delete'),
        ),
      ],
    );
    if (confirmed != true) return;
    try {
      await ref.read(proofsApiProvider).deleteProofOfClass(proof.id);
      ref.invalidate(cockpitProofsProvider(sessionId));
    } on ApiRequestError catch (error) {
      if (context.mounted) {
        CampusToast.showIn(context, error.message, tone: CampusToastTone.error);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = BrandTheme.of(context);
    final proofs = ref.watch(cockpitProofsProvider(sessionId));
    final muted = Theme.of(
      context,
    ).textTheme.bodySmall?.copyWith(color: tokens.muted);
    return CampusCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Class photos'
                  '${proofs.value == null ? '' : ' (${proofs.value!.length})'}',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              IconButton(
                tooltip: 'Refresh photos',
                icon: const Icon(Icons.refresh, size: 18),
                onPressed: () =>
                    ref.invalidate(cockpitProofsProvider(sessionId)),
              ),
            ],
          ),
          proofs.when(
            data: (items) => items.isEmpty
                ? Text(
                    'No photos yet. Your QAC officers add them during class.',
                    style: muted,
                  )
                : ProofPhotoGrid(
                    proofs: items,
                    onDelete: (proof) => _delete(context, ref, proof),
                  ),
            loading: () => Text('Loading photos…', style: muted),
            error: (_, _) => Text(
              'The photos could not be loaded. Tap refresh to try again.',
              style: muted,
            ),
          ),
        ],
      ),
    );
  }
}
