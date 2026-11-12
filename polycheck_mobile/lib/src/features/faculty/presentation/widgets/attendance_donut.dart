import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/pup_theme.dart';
import '../../data/faculty_logic.dart';

/// Square donut chart for attendance totals (CustomPainter, no dependency).
class AttendanceDonut extends StatelessWidget {
  const AttendanceDonut({
    super.key,
    required this.segments,
    this.size = 168,
    this.strokeWidth = 22,
  });

  final List<DonutSegment> segments;
  final double size;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final total = segments.fold<int>(0, (sum, segment) => sum + segment.value);
    return Semantics(
      label:
          'Attendance donut: ${segments.map((segment) => '${segment.label} ${segment.value}').join(', ')}',
      child: SizedBox(
        width: size,
        height: size,
        child: CustomPaint(
          painter: _DonutPainter(
            segments: segments,
            total: total,
            strokeWidth: strokeWidth,
            emptyColor: tokens.borderSubtle,
          ),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$total',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  'records',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({
    required this.segments,
    required this.total,
    required this.strokeWidth,
    required this.emptyColor,
  });

  final List<DonutSegment> segments;
  final int total;
  final double strokeWidth;
  final Color emptyColor;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromCircle(
      center: Offset(size.width / 2, size.height / 2),
      radius: (math.min(size.width, size.height) - strokeWidth) / 2,
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;
    if (total <= 0) {
      canvas.drawArc(
        rect,
        -math.pi / 2,
        math.pi * 2,
        false,
        paint..color = emptyColor,
      );
      return;
    }
    var start = -math.pi / 2;
    for (final segment in segments) {
      if (segment.value <= 0) continue;
      final sweep = math.pi * 2 * (segment.value / total);
      canvas.drawArc(rect, start, sweep, false, paint..color = segment.color);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) {
    return oldDelegate.total != total ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.segments.length != segments.length ||
        !_sameSegments(oldDelegate.segments, segments);
  }

  bool _sameSegments(List<DonutSegment> left, List<DonutSegment> right) {
    for (var index = 0; index < left.length; index += 1) {
      if (left[index].value != right[index].value ||
          left[index].color != right[index].color) {
        return false;
      }
    }
    return true;
  }
}

/// Legend under the donut.
class DonutLegend extends StatelessWidget {
  const DonutLegend({super.key, required this.segments});

  final List<DonutSegment> segments;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Wrap(
      spacing: 12,
      runSpacing: 6,
      children: [
        for (final segment in segments)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 10, height: 10, color: segment.color),
              const SizedBox(width: 5),
              Text(
                '${segment.label} ${segment.value}',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.muted),
              ),
            ],
          ),
      ],
    );
  }
}
