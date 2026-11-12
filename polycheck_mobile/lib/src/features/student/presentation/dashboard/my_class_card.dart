import 'package:flutter/material.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_classes_data.dart';

/// Enrolled-class card shared by the dashboard preview and the full
/// `/student/subjects` list: subject name, `code · Section · teacher`, the
/// per-section attendance-rate bar, and officer chips when the roles snapshot
/// marks the student as president/QAC for that section.
class MyClassCard extends StatelessWidget {
  const MyClassCard({super.key, required this.card, required this.onTap});

  final StudentClassCard card;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final meta = <String>[
      if (card.subjectCode.isNotEmpty) card.subjectCode,
      card.sectionLabel,
      if (card.teacherName.isNotEmpty) card.teacherName,
    ].join(' · ');

    return CampusCard(
      onTap: onTap,
      semanticLabel: 'Open ${card.subjectName} details',
      padding: EdgeInsets.zero,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Container(
              width: 4,
              color: tokens.isDark ? tokens.gold : tokens.maroon,
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: tokens.maroon.withValues(
                          alpha: tokens.isDark ? 0.22 : 0.06,
                        ),
                        border: Border.all(
                          color: tokens.maroon.withValues(alpha: 0.16),
                        ),
                      ),
                      child: Icon(
                        Icons.menu_book_outlined,
                        size: 20,
                        color: tokens.isDark ? tokens.gold : tokens.maroon,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            card.subjectName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  color: tokens.onSurface,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            meta,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                          if (card.isOfficer) ...<Widget>[
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: <Widget>[
                                if (card.isPresident)
                                  CampusBadge(
                                    label: 'President',
                                    background: tokens.maroon,
                                    foreground: Colors.white,
                                    border: tokens.maroon,
                                    icon: Icons.star,
                                    dense: true,
                                  ),
                                if (card.isQac)
                                  CampusBadge(
                                    label: 'QAC',
                                    background: tokens.deepMaroon,
                                    foreground: tokens.gold,
                                    border: tokens.gold,
                                    icon: Icons.camera_alt_outlined,
                                    dense: true,
                                  ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 10),
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: Semantics(
                                  label:
                                      'Attendance rate ${card.ratePercent} percent',
                                  child: _RateBar(
                                    ratePercent: card.ratePercent,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                card.hasRecords ? '${card.ratePercent}%' : '—',
                                style: Theme.of(context).textTheme.labelSmall
                                    ?.copyWith(
                                      color: tokens.muted,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RateBar extends StatelessWidget {
  const _RateBar({required this.ratePercent});

  final int ratePercent;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final fraction = (ratePercent.clamp(0, 100)) / 100;
    return SizedBox(
      height: 8,
      child: Stack(
        children: <Widget>[
          Positioned.fill(child: ColoredBox(color: tokens.borderSubtle)),
          Positioned.fill(
            child: Align(
              alignment: Alignment.centerLeft,
              child: FractionallySizedBox(
                widthFactor: fraction,
                heightFactor: 1,
                child: ColoredBox(color: tokens.gold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
