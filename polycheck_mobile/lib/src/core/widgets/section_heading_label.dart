import 'package:flutter/material.dart';

import '../theme/pup_theme.dart';
import '../utils/section_label.dart';

/// Canonical section label (`Section 4-1 · BSIT`).
///
/// Uses the shared `formatSectionHeading` rule so every roster, cockpit, and
/// report surface renders identical section names.
class SectionHeadingLabel extends StatelessWidget {
  const SectionHeadingLabel({
    super.key,
    required this.section,
    this.course,
    this.style,
    this.maxLines = 1,
  });

  final String section;
  final String? course;
  final TextStyle? style;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final text = formatSectionHeading(section: section, course: course);
    return Text(
      text,
      maxLines: maxLines,
      overflow: maxLines == 1 ? TextOverflow.ellipsis : null,
      style:
          style ??
          Theme.of(context).textTheme.titleSmall?.copyWith(
            color: tokens.onSurface,
            fontWeight: FontWeight.w600,
          ),
    );
  }
}
