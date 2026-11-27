import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../data/student_models.dart';
import '../../../../core/utils/proof_window.dart';
import '../../../../core/widgets/proof_photo_grid.dart';
import '../../data/student_providers.dart';
import 'host_session_panel.dart';
import 'proof_uploader.dart';

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
  StudentSessionKey get _key => StudentSessionKey(
    sectionId: widget.sectionId,
    sessionId: widget.sessionId,
  );

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
        ShareParams(text: token, subject: 'PolyCheck class token'),
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

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
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
            onShareToken: _shareToken,
            onCopyToken: _copyToken,
          ),
        ),
      ),
    );
  }
}

class _SessionBody extends ConsumerWidget {
  const _SessionBody({
    required this.detail,
    required this.sessionKey,
    required this.onCopyToken,
    required this.onShareToken,
  });

  final StudentSessionDetail detail;
  final StudentSessionKey sessionKey;
  final Future<void> Function(String token) onCopyToken;
  final Future<void> Function(String token) onShareToken;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = BrandTheme.of(context);
    final session = detail.session;
    final currentUserId = ref.watch(
      sessionProvider.select((state) => state.user?.id),
    );
    void onUploaded() =>
        ref.invalidate(studentSessionDetailProvider(sessionKey));
    // The president who created this session runs it from here.
    final isHost =
        currentUserId != null && session.hostStudentId == currentUserId;
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
        if (isHost)
          HostSessionPanel(sessionId: session.id, onChanged: onUploaded)
        else if (activeToken != null)
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
                  'Live while this session is active. Classmates scan this QR with the PolyCheck scanner, or copy the manual-entry token below.',
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
                Text(
                  'QAC evidence upload',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                isProofWindowOpen(
                      date: session.date,
                      startTime: session.startTime,
                      endTime: session.endTime,
                      isActive: session.isActive,
                      now: ref.watch(trustedClockProvider).now(),
                    )
                    ? ProofUploader(
                        sectionId: sessionKey.sectionId,
                        sessionId: sessionKey.sessionId,
                        alreadyUploaded: detail.proofs
                            .where((proof) => proof.uploadedBy == currentUserId)
                            .length,
                        onUploaded: onUploaded,
                      )
                    : Text(
                        'Photos can be added while this class is ongoing, until '
                        '$proofGraceAfterClassMinutes minutes after it ends.',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tokens.muted),
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
          ProofPhotoGrid(proofs: detail.proofs),
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
    final tokens = BrandTheme.of(context);
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
