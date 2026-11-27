import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../../../core/models/qac_section.dart';
import '../../../../core/widgets/proof_photo_grid.dart';
import '../../../../core/utils/proof_window.dart';
import 'proof_uploader.dart';

final qacSectionsProvider = FutureProvider.autoDispose<List<QacSection>>(
  (ref) => ref.read(proofsApiProvider).getMyQacSections(),
);

/// The signed-in officer's own photos for one session.
final myProofPhotosProvider = FutureProvider.autoDispose
    .family<List<ProofOfClass>, String>((ref, sessionId) async {
      final userId = ref.watch(
        sessionProvider.select((state) => state.user?.id),
      );
      final all = await ref.read(proofsApiProvider).getProofsOfClass(sessionId);
      return all
          .where((proof) => proof.uploadedBy == userId)
          .toList(growable: false);
    });

String _heading(QacSection section) =>
    formatSectionHeading(section: section.section, course: section.course);

String _times(QacSessionSlot slot) {
  final room = slot.room?.trim() ?? '';
  return '${formatTime(slot.startTime)} to ${formatTime(slot.endTime)}'
      '${room.isEmpty ? '' : ' · $room'}';
}

/// QAC officers' own page: the classes they cover, and photo upload for the
/// class that is happening now.
class QacPhotosScreen extends ConsumerStatefulWidget {
  const QacPhotosScreen({super.key});

  @override
  ConsumerState<QacPhotosScreen> createState() => _QacPhotosScreenState();
}

class _QacPhotosScreenState extends ConsumerState<QacPhotosScreen> {
  String? _selected;

  Future<void> _refresh() async {
    ref.invalidate(qacSectionsProvider);
    ref.invalidate(myProofPhotosProvider);
    await ref
        .read(qacSectionsProvider.future)
        .catchError((_) => const <QacSection>[]);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final sections = ref.watch(qacSectionsProvider);
    final section = sections.value
        ?.where((item) => item.sectionId == _selected)
        .firstOrNull;
    return PopScope(
      canPop: section == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _selected = null);
      },
      child: Scaffold(
        appBar: CampusHeader(
          title: 'Class photos',
          subtitle: section?.subjectName ?? 'Quality Assurance Coordinator',
          automaticallyImplyLeading: false,
          leading: section == null
              ? null
              : IconButton(
                  tooltip: 'All my QAC classes',
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => setState(() => _selected = null),
                ),
          actions: <Widget>[
            IconButton(
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh),
              onPressed: _refresh,
            ),
          ],
        ),
        body: RefreshIndicator(
          color: tokens.maroon,
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: sections.when(
              loading: () => const <Widget>[
                CampusLoading(label: 'Loading your classes…'),
              ],
              error: (error, _) => <Widget>[
                CampusCard(
                  child: Column(
                    children: <Widget>[
                      Text(
                        error is ApiRequestError
                            ? error.message
                            : 'Check your connection and try again.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 10),
                      CampusButton(
                        label: 'Try again',
                        variant: CampusButtonVariant.outline,
                        expand: false,
                        onPressed: _refresh,
                      ),
                    ],
                  ),
                ),
              ],
              data: (items) => section != null
                  ? _sectionView(context, section)
                  : _sectionList(context, items),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _sectionList(BuildContext context, List<QacSection> items) {
    final tokens = BrandTheme.of(context);
    if (items.isEmpty) {
      return const <Widget>[
        CampusCard(
          child: CampusEmptyState(
            icon: Icons.photo_camera_outlined,
            title: 'No QAC classes',
            message:
                'You are not a QAC in any class. Your professor gives this '
                'role.',
          ),
        ),
      ];
    }
    return <Widget>[
      for (final item in items) ...<Widget>[
        CampusCard(
          key: ValueKey('qac-section-${item.sectionId}'),
          onTap: () => setState(() => _selected = item.sectionId),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      item.subjectName,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: tokens.onSurface,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      '${item.subjectCode} · ${_heading(item)} · '
                      '${item.teacherName}',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.hasOpenSession
                          ? 'Class is ongoing — add photos'
                          : 'No class is ongoing',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: item.hasOpenSession
                            ? (tokens.isDark ? tokens.gold : tokens.maroon)
                            : tokens.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: tokens.muted),
            ],
          ),
        ),
        const SizedBox(height: 10),
      ],
    ];
  }

  List<Widget> _sectionView(BuildContext context, QacSection section) {
    final tokens = BrandTheme.of(context);
    final open = section.sessions.where((slot) => slot.open).toList();
    final closed = section.sessions.where((slot) => !slot.open).toList();
    final muted = Theme.of(
      context,
    ).textTheme.bodySmall?.copyWith(color: tokens.muted);
    return <Widget>[
      Text(
        '${section.subjectCode} · ${_heading(section)} · '
        '${section.teacherName}',
        style: muted,
      ),
      const SizedBox(height: 10),
      for (final slot in open) ...<Widget>[
        _OpenSessionCard(sectionId: section.sectionId, slot: slot),
        const SizedBox(height: 10),
      ],
      if (open.isEmpty)
        CampusCard(
          child: Text(
            'No class is ongoing right now. Photos can be added during class, '
            'until $proofGraceAfterClassMinutes minutes after it ends.',
            style: muted,
          ),
        ),
      if (closed.isNotEmpty) ...<Widget>[
        const SizedBox(height: 12),
        Text('OTHER CLASSES TODAY', style: muted),
        for (final slot in closed)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              '${_times(slot)} · ${slot.myPhotoCount} photo'
              '${slot.myPhotoCount == 1 ? '' : 's'} from you',
              style: muted,
            ),
          ),
      ],
    ];
  }
}

class _OpenSessionCard extends ConsumerWidget {
  const _OpenSessionCard({required this.sectionId, required this.slot});

  final String sectionId;
  final QacSessionSlot slot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = BrandTheme.of(context);
    final photos = ref.watch(myProofPhotosProvider(slot.id));
    final mine = photos.value ?? const <ProofOfClass>[];
    final count = mine.length > slot.myPhotoCount
        ? mine.length
        : slot.myPhotoCount;
    return CampusCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'HAPPENING NOW',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.isDark ? tokens.gold : tokens.maroon,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          Text(
            _times(slot),
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          ProofUploader(
            sectionId: sectionId,
            sessionId: slot.id,
            alreadyUploaded: count,
            onUploaded: () {
              ref.invalidate(myProofPhotosProvider(slot.id));
              ref.invalidate(qacSectionsProvider);
            },
          ),
          if (photos.hasError) ...<Widget>[
            const SizedBox(height: 8),
            const Text('Your photos could not be loaded. Pull down to retry.'),
          ],
          if (mine.isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            ProofPhotoGrid(proofs: mine),
          ],
        ],
      ),
    );
  }
}
