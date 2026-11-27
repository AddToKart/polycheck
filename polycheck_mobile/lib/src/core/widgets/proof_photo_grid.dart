import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../models/section_role.dart';
import '../theme/brand_theme.dart';

/// A stored class photo's bytes. Photos are private, so they are fetched with
/// the signed-in session rather than loaded from a plain address.
final proofImageProvider = FutureProvider.autoDispose.family<Uint8List, String>(
  (ref, proofId) => ref.read(proofsApiProvider).getProofFile(proofId),
);

String _takenAt(String value) {
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return value;
  // Campus time, whatever the phone's own time zone is.
  final campus = parsed.toUtc().add(const Duration(hours: 8));
  String two(int number) => number.toString().padLeft(2, '0');
  return '${campus.year}-${two(campus.month)}-${two(campus.day)} '
      '${two(campus.hour)}:${two(campus.minute)}';
}

class _ProofImage extends ConsumerWidget {
  const _ProofImage({required this.proof, required this.fit});

  final ProofOfClass proof;
  final BoxFit fit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = BrandTheme.of(context);
    Widget placeholder(IconData icon) => ColoredBox(
      color: tokens.campus,
      child: Center(child: Icon(icon, color: tokens.muted)),
    );
    final data = proof.photoData;
    if (data.startsWith('data:')) {
      final comma = data.indexOf(',');
      if (comma > 0) {
        return Image.memory(base64Decode(data.substring(comma + 1)), fit: fit);
      }
    }
    return ref
        .watch(proofImageProvider(proof.id))
        .when(
          data: (bytes) => Image.memory(
            bytes,
            fit: fit,
            semanticLabel: 'Class photo from ${proof.uploadedByStudentName}',
            errorBuilder: (_, _, _) => placeholder(Icons.broken_image_outlined),
          ),
          loading: () => placeholder(Icons.hourglass_empty),
          error: (_, _) => placeholder(Icons.broken_image_outlined),
        );
  }
}

/// Class photos as thumbnails; tapping one opens it full screen.
class ProofPhotoGrid extends StatelessWidget {
  const ProofPhotoGrid({super.key, required this.proofs, this.onDelete});

  final List<ProofOfClass> proofs;

  /// Given only to the professor, who may delete photos.
  final void Function(ProofOfClass proof)? onDelete;

  void _open(BuildContext context, ProofOfClass proof) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: SafeArea(
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(left: 16),
                      child: Text(
                        '${proof.uploadedByStudentName} · '
                        '${_takenAt(proof.uploadedAt)}',
                        style: const TextStyle(color: Colors.white),
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close photo',
                    onPressed: () => Navigator.of(dialogContext).pop(),
                    icon: const Icon(Icons.close, color: Colors.white),
                  ),
                ],
              ),
              Expanded(
                child: InteractiveViewer(
                  child: Center(
                    child: _ProofImage(proof: proof, fit: BoxFit.contain),
                  ),
                ),
              ),
              if (proof.description?.trim().isNotEmpty == true)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    proof.description!,
                    style: const TextStyle(color: Colors.white),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 480 ? 3 : 2;
        final width = (constraints.maxWidth - 8 * (columns - 1)) / columns;
        return Wrap(
          spacing: 8,
          runSpacing: 10,
          children: [
            for (final proof in proofs)
              SizedBox(
                width: width,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      button: true,
                      label:
                          'View the photo from ${proof.uploadedByStudentName}',
                      child: GestureDetector(
                        key: ValueKey('proof-photo-${proof.id}'),
                        onTap: () => _open(context, proof),
                        child: AspectRatio(
                          aspectRatio: 4 / 3,
                          child: _ProofImage(proof: proof, fit: BoxFit.cover),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${proof.uploadedByStudentName}\n'
                            '${_takenAt(proof.uploadedAt)}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ),
                        if (onDelete != null)
                          IconButton(
                            tooltip: 'Delete photo',
                            icon: const Icon(Icons.delete_outline, size: 20),
                            onPressed: () => onDelete!(proof),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}
