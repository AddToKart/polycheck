import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../../../core/utils/proof_window.dart';
import '../../data/student_images.dart';

/// Takes or picks photos and returns them already compressed. A provider so
/// widget tests can stand in for the camera and gallery.
typedef ProofPhotoPicker =
    Future<List<StudentImageEvidence>> Function(ImageSource source, int limit);

final proofPhotoPickerProvider = Provider<ProofPhotoPicker>(
  (ref) => pickProofPhotos,
);

/// Take or choose up to four class photos, check them, then upload them to one
/// session.
class ProofUploader extends ConsumerStatefulWidget {
  const ProofUploader({
    super.key,
    required this.sectionId,
    required this.sessionId,
    required this.alreadyUploaded,
    required this.onUploaded,
  });

  final String sectionId;
  final String sessionId;

  /// Photos this officer has already added to the session.
  final int alreadyUploaded;
  final VoidCallback onUploaded;

  @override
  ConsumerState<ProofUploader> createState() => _ProofUploaderState();
}

class _ProofUploaderState extends ConsumerState<ProofUploader> {
  final TextEditingController _note = TextEditingController();
  final List<StudentImageEvidence> _picked = <StudentImageEvidence>[];
  bool _preparing = false;
  bool _uploading = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  int get _remaining {
    final left = proofPhotosPerSession - widget.alreadyUploaded;
    return left < 0 ? 0 : left;
  }

  int get _room {
    final left = _remaining - _picked.length;
    return left < 0 ? 0 : left;
  }

  Future<void> _add(ImageSource source) async {
    if (_room == 0) return;
    setState(() {
      _preparing = true;
      _error = null;
    });
    try {
      final photos = await ref.read(proofPhotoPickerProvider)(source, _room);
      if (!mounted) return;
      setState(() => _picked.addAll(photos.take(_room)));
    } on StudentImageException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } on Object {
      if (mounted) setState(() => _error = 'The photo could not be added.');
    } finally {
      if (mounted) setState(() => _preparing = false);
    }
  }

  Future<void> _upload() async {
    setState(() {
      _uploading = true;
      _error = null;
    });
    var sent = 0;
    final note = _note.text.trim();
    try {
      // One at a time: whatever already went through stays uploaded.
      for (final photo in List<StudentImageEvidence>.of(_picked)) {
        await ref
            .read(proofsApiProvider)
            .uploadProofOfClass(
              sectionId: widget.sectionId,
              sessionId: widget.sessionId,
              photoData: photo.dataUrl,
              description: note.isEmpty ? null : note,
            );
        sent += 1;
        if (mounted) setState(() => _picked.remove(photo));
      }
      _note.clear();
      if (mounted) {
        CampusToast.showIn(
          context,
          '$sent photo${sent == 1 ? '' : 's'} uploaded.',
          tone: CampusToastTone.success,
        );
      }
    } on Object catch (error) {
      if (!mounted) return;
      final reason = error is ApiRequestError && error.message.trim().isNotEmpty
          ? error.message.trim()
          : 'The photo could not be uploaded. Check your connection.';
      setState(() => _error = '${sent > 0 ? '$sent uploaded. ' : ''}$reason');
    } finally {
      if (mounted) setState(() => _uploading = false);
      if (sent > 0) widget.onUploaded();
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final muted = Theme.of(
      context,
    ).textTheme.bodySmall?.copyWith(color: tokens.muted);
    final busy = _preparing || _uploading;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          _remaining == 0
              ? 'You have added all $proofPhotosPerSession photos for this '
                    'session.'
              : 'You can add $_remaining more photo'
                    '${_remaining == 1 ? '' : 's'} to this session. Photos are '
                    'made smaller automatically.',
          style: muted,
        ),
        if (_remaining > 0) ...<Widget>[
          const SizedBox(height: 8),
          Row(
            children: <Widget>[
              Expanded(
                child: CampusButton(
                  label: 'Take photo',
                  icon: Icons.photo_camera_outlined,
                  variant: CampusButtonVariant.outline,
                  onPressed: busy || _room == 0
                      ? null
                      : () => _add(ImageSource.camera),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CampusButton(
                  label: 'Gallery',
                  icon: Icons.photo_library_outlined,
                  variant: CampusButtonVariant.outline,
                  onPressed: busy || _room == 0
                      ? null
                      : () => _add(ImageSource.gallery),
                ),
              ),
            ],
          ),
        ],
        if (_preparing) ...<Widget>[
          const SizedBox(height: 8),
          Text('Preparing the photo…', style: muted),
        ],
        if (_picked.isNotEmpty) ...<Widget>[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              for (var index = 0; index < _picked.length; index++)
                Stack(
                  children: <Widget>[
                    Image.memory(
                      _picked[index].bytes,
                      width: 96,
                      height: 96,
                      fit: BoxFit.cover,
                    ),
                    Positioned(
                      top: 0,
                      right: 0,
                      child: IconButton(
                        tooltip: 'Remove photo ${index + 1}',
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.black54,
                          foregroundColor: Colors.white,
                        ),
                        icon: const Icon(Icons.close, size: 16),
                        onPressed: _uploading
                            ? null
                            : () => setState(() => _picked.removeAt(index)),
                      ),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 10),
          CampusTextField(
            label: 'Note',
            hint: 'Optional note about these photos',
            controller: _note,
            maxLines: 2,
          ),
          const SizedBox(height: 10),
          CampusButton(
            key: const ValueKey('upload-proof-photos'),
            label: _uploading
                ? 'Uploading…'
                : 'Upload ${_picked.length} photo'
                      '${_picked.length == 1 ? '' : 's'}',
            icon: Icons.cloud_upload_outlined,
            loading: _uploading,
            onPressed: busy ? null : _upload,
          ),
        ],
        if (_error != null) ...<Widget>[
          const SizedBox(height: 8),
          Text(
            _error!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: tokens.isDark ? tokens.gold : tokens.maroon,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }
}
