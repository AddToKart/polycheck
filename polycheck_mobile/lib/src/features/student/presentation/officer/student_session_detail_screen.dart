import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../data/student_images.dart';
import '../../data/student_models.dart';
import '../../data/student_providers.dart';

class StudentSessionDetailScreen extends ConsumerStatefulWidget {
  const StudentSessionDetailScreen({
    super.key,
    required this.sectionId,
    required this.sessionId,
  });

  final String sectionId;
  final String sessionId;

  @override
  ConsumerState<StudentSessionDetailScreen> createState() =>
      _StudentSessionDetailScreenState();
}

class _StudentSessionDetailScreenState
    extends ConsumerState<StudentSessionDetailScreen> {
  final TextEditingController _descriptionController = TextEditingController();
  StudentImageEvidence? _evidence;
  bool _uploading = false;
  String? _proofError;

  StudentSessionKey get _key => StudentSessionKey(
    sectionId: widget.sectionId,
    sessionId: widget.sessionId,
  );

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _copyToken(String token) async {
    await Clipboard.setData(ClipboardData(text: token));
    if (!mounted) return;
    CampusToast.showIn(
      context,
      'Class token copied. Share it with your classmates.',
      tone: CampusToastTone.success,
    );
  }

  Future<void> _shareToken(String token) async {
    try {
      await SharePlus.instance.share(
        ShareParams(text: token, subject: 'Polycheck class token'),
      );
    } on Object {
      if (!mounted) return;
      CampusToast.showIn(
        context,
        'The class token could not be shared.',
        tone: CampusToastTone.error,
      );
    }
  }

  Future<void> _pickProofPhoto() async {
    final source = await showCampusBottomSheet<ImageSource>(
      context,
      title: 'Add proof of class',
      child: Builder(
        builder: (sheetContext) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Take a photo'),
                onTap: () => Navigator.of(sheetContext).pop(ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choose from gallery'),
                onTap: () =>
                    Navigator.of(sheetContext).pop(ImageSource.gallery),
              ),
            ],
          );
        },
      ),
    );
    if (source == null || !mounted) return;
    try {
      final evidence = await pickStudentImage(source: source);
      if (!mounted || evidence == null) return;
      setState(() {
        _evidence = evidence;
        _proofError = null;
      });
    } on StudentImageException catch (error) {
      if (!mounted) return;
      setState(() => _proofError = error.message);
    } on Object {
      if (!mounted) return;
      setState(() => _proofError = 'The photo could not be prepared.');
    }
  }

  Future<void> _uploadProof() async {
    final evidence = _evidence;
    if (evidence == null) return;
    setState(() {
      _uploading = true;
      _proofError = null;
    });
    try {
      await ref
          .read(proofsApiProvider)
          .uploadProofOfClass(
            sectionId: widget.sectionId,
            sessionId: widget.sessionId,
            photoData: evidence.dataUrl,
            description: _descriptionController.text.trim().isEmpty
                ? null
                : _descriptionController.text.trim(),
          );
      ref.invalidate(studentSessionDetailProvider(_key));
      if (!mounted) return;
      setState(() {
        _uploading = false;
        _evidence = null;
        _descriptionController.clear();
      });
      CampusToast.showIn(
        context,
        'Proof uploaded. The class photo is now attached to this session.',
        tone: CampusToastTone.success,
      );
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() {
        _uploading = false;
        _proofError = error.message.trim().isEmpty
            ? 'Unable to upload the proof photo.'
            : error.message.trim();
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _uploading = false;
        _proofError = 'Unable to upload the proof photo.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final detailAsync = ref.watch(studentSessionDetailProvider(_key));
    return Scaffold(
      appBar: CampusHeader(
        title: detailAsync.value?.subjectName ?? 'Class session',
        subtitle: detailAsync.value == null
            ? null
            : '${formatSectionHeading(section: detailAsync.value!.section.section, course: detailAsync.value!.section.course)} · ${detailAsync.value!.session.startTime}–${detailAsync.value!.session.endTime}',
        automaticallyImplyLeading: true,
      ),
      body: RefreshIndicator(
        color: tokens.maroon,
        onRefresh: () async {
          ref.invalidate(studentSessionDetailProvider(_key));
        },
        child: detailAsync.when(
          loading: () => const CampusLoading(label: 'Loading session…'),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              CampusCard(
                child: Column(
                  children: <Widget>[
                    Text(
                      'Unable to load this session',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: tokens.onSurface,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      error is ApiRequestError
                          ? error.message
                          : 'Check your connection and try again.',
                      textAlign: TextAlign.center,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                    ),
                    const SizedBox(height: 10),
                    CampusButton(
                      label: 'Try again',
                      variant: CampusButtonVariant.outline,
                      expand: false,
                      onPressed: () =>
                          ref.invalidate(studentSessionDetailProvider(_key)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          data: (detail) => _SessionBody(
            detail: detail,
            sessionKey: _key,
            descriptionController: _descriptionController,
            evidence: _evidence,
            uploading: _uploading,
            proofError: _proofError,
            onPickPhoto: _pickProofPhoto,
            onShareToken: _shareToken,
            onUpload: _uploadProof,
            onCopyToken: _copyToken,
            onClearEvidence: () => setState(() => _evidence = null),
          ),
        ),
      ),
    );
  }
}

class _SessionBody extends StatelessWidget {
  const _SessionBody({
    required this.detail,
    required this.sessionKey,
    required this.descriptionController,
    required this.evidence,
    required this.uploading,
    required this.proofError,
    required this.onPickPhoto,
    required this.onUpload,
    required this.onCopyToken,
    required this.onShareToken,
    required this.onClearEvidence,
  });

  final StudentSessionDetail detail;
  final StudentSessionKey sessionKey;
  final TextEditingController descriptionController;
  final StudentImageEvidence? evidence;
  final bool uploading;
  final String? proofError;
  final Future<void> Function() onPickPhoto;
  final Future<void> Function() onUpload;
  final Future<void> Function(String token) onCopyToken;
  final Future<void> Function(String token) onShareToken;
  final VoidCallback onClearEvidence;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final session = detail.session;
    final activeToken = detail.activeClassToken;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      children: <Widget>[
        CampusCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                'SESSION DETAILS',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.4,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 16,
                runSpacing: 10,
                children: <Widget>[
                  _DetailStat(
                    label: 'Status',
                    value: detail.statusLabel,
                    icon: session.isActive
                        ? Icons.radio_button_checked
                        : Icons.event_outlined,
                  ),
                  _DetailStat(
                    label: 'Time',
                    value:
                        '${formatTime(session.startTime)}–${formatTime(session.endTime)}',
                    icon: Icons.access_time,
                  ),
                  _DetailStat(
                    label: 'Room',
                    value: session.room?.trim().isNotEmpty == true
                        ? session.room!
                        : 'TBA',
                    icon: Icons.meeting_room_outlined,
                  ),
                  _DetailStat(
                    label: 'Mode',
                    value: session.mode == SessionMode.online
                        ? 'Online · no GPS'
                        : 'In person',
                    icon: session.mode == SessionMode.online
                        ? Icons.wifi
                        : Icons.location_on_outlined,
                  ),
                  _DetailStat(
                    label: 'QR validity',
                    value: '${session.qrValidityMinutes} min',
                    icon: Icons.qr_code_2,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (activeToken != null)
          CampusCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  'CLASS QR — SHARE WITH CLASSMATES',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.isDark ? tokens.gold : tokens.maroon,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Live while this session is active. Classmates scan this QR with the Polycheck scanner, or copy the manual-entry token below.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  color: Colors.white,
                  child: Center(
                    child: QrImageView(
                      key: const ValueKey('class-qr-image'),
                      data: activeToken,
                      size: 220,
                      padding: EdgeInsets.zero,
                      backgroundColor: Colors.white,
                      errorCorrectionLevel: QrErrorCorrectLevel.M,
                      semanticsLabel: 'Class attendance QR code',
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'MANUAL ENTRY TOKEN',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.muted,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  constraints: const BoxConstraints(maxHeight: 96),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: tokens.campus,
                    border: Border.all(color: tokens.borderSubtle),
                  ),
                  child: SingleChildScrollView(
                    child: SelectableText(
                      activeToken,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        fontFamily: 'monospace',
                        fontSize: 9,
                        height: 1.35,
                        color: tokens.onSurface,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                CampusButton(
                  key: const ValueKey('copy-class-token'),
                  label: 'Copy class token',
                  icon: Icons.copy_outlined,
                  variant: CampusButtonVariant.outline,
                  onPressed: () => onCopyToken(activeToken),
                ),
                const SizedBox(height: 6),
                CampusButton(
                  label: 'Share class token',
                  icon: Icons.ios_share,
                  variant: CampusButtonVariant.outline,
                  onPressed: () => onShareToken(activeToken),
                ),
              ],
            ),
          )
        else if ((session.endedAt?.isNotEmpty ?? false))
          CampusCard(
            child: Row(
              children: <Widget>[
                Icon(Icons.lock_outline, size: 20, color: tokens.muted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'This session has ended.',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                ),
              ],
            ),
          )
        else
          CampusCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(
                  Icons.lock_clock_outlined,
                  size: 22,
                  color: tokens.isDark ? tokens.gold : tokens.maroon,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Awaiting instructor activation',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: tokens.onSurface,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Your instructor activates this session from their own device — the QR token must be signed with their key. Once active, the class token appears here for the whole class.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 16),
        Text(
          'Proof of class',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: tokens.onSurface,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        if (detail.isQac)
          CampusCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Icon(
                      Icons.camera_alt_outlined,
                      size: 22,
                      color: tokens.isDark ? tokens.gold : tokens.maroon,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'QAC evidence upload',
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  color: tokens.onSurface,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Capture the classroom during this session for the audit record.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (evidence != null) ...<Widget>[
                  Row(
                    children: <Widget>[
                      ClipRect(
                        child: Image.memory(
                          evidence!.bytes,
                          width: 64,
                          height: 64,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Expanded(child: Text('Photo ready to upload')),
                      TextButton(
                        onPressed: uploading ? null : onClearEvidence,
                        child: const Text('Remove'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                ],
                CampusTextField(
                  label: 'Description',
                  hint: 'Optional note about this class photo',
                  controller: descriptionController,
                  maxLines: 2,
                ),
                if (proofError != null) ...<Widget>[
                  const SizedBox(height: 8),
                  Text(
                    proofError!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.isDark ? tokens.gold : tokens.maroon,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: CampusButton(
                        label: evidence == null ? 'Add photo' : 'Replace photo',
                        icon: Icons.add_a_photo_outlined,
                        variant: CampusButtonVariant.outline,
                        onPressed: uploading ? null : onPickPhoto,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: CampusButton(
                        label: uploading ? 'Uploading…' : 'Upload proof',
                        icon: Icons.cloud_upload_outlined,
                        loading: uploading,
                        onPressed: evidence == null || uploading
                            ? null
                            : onUpload,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          )
        else
          CampusCard(
            child: Text(
              'Photos uploaded by the QAC officer will appear here for the class audit.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ),
        const SizedBox(height: 12),
        if (detail.proofs.isEmpty)
          CampusCard(
            child: CampusEmptyState(
              icon: Icons.photo_camera_outlined,
              title: 'No proof photos yet',
              message:
                  'Photos uploaded by the QAC officer will appear here for the class audit.',
            ),
          )
        else
          for (final proof in detail.proofs) ...<Widget>[
            _ProofCard(proof: proof),
            const SizedBox(height: 10),
          ],
      ],
    );
  }
}

class _DetailStat extends StatelessWidget {
  const _DetailStat({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return SizedBox(
      width: 140,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: 16, color: tokens.muted),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  label.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.muted,
                    fontSize: 8,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.7,
                  ),
                ),
                Text(
                  value,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProofCard extends StatelessWidget {
  const _ProofCard({required this.proof});

  final ProofOfClass proof;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      padding: const EdgeInsets.all(10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(width: 86, height: 64, child: _ProofImage(proof: proof)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  proof.uploadedByStudentName.trim().isEmpty
                      ? 'QAC officer'
                      : proof.uploadedByStudentName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  proof.uploadedAt,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.muted,
                    fontSize: 9,
                  ),
                ),
                if (proof.description?.trim().isNotEmpty == true) ...<Widget>[
                  const SizedBox(height: 3),
                  Text(
                    proof.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProofImage extends StatelessWidget {
  const _ProofImage({required this.proof});

  final ProofOfClass proof;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final data = proof.photoData;
    if (data.startsWith('data:')) {
      final comma = data.indexOf(',');
      if (comma > 0) {
        try {
          final bytes = base64Decode(data.substring(comma + 1));
          return Image.memory(bytes, fit: BoxFit.cover);
        } on FormatException {
          // Fall through to the placeholder.
        }
      }
    }
    return ColoredBox(
      color: tokens.campus,
      child: Icon(Icons.image_outlined, color: tokens.muted),
    );
  }
}
