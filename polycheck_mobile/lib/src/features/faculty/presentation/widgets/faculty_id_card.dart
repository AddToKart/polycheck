import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/polycheck_core.dart';

/// Faculty-local flippable PUP ID card.
///
/// The student feature owns the canonical holographic card; this variant is a
/// deliberately local copy so the faculty wave never edits the student
/// feature directory. Tap to flip between identity and conditions faces.
class FacultyIdCard extends StatefulWidget {
  const FacultyIdCard({super.key, required this.student, this.sectionLabel});

  final User student;
  final String? sectionLabel;

  @override
  State<FacultyIdCard> createState() => _FacultyIdCardState();
}

class _FacultyIdCardState extends State<FacultyIdCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 480),
  );
  late final Animation<double> _turn = Tween<double>(
    begin: 0,
    end: math.pi,
  ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggle() {
    if (_controller.isAnimating) return;
    if (_controller.value < 0.5) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Student ID card. Tap to flip.',
      child: GestureDetector(
        onTap: _toggle,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            final height = (width * 0.62).clamp(180.0, 300.0);
            return SizedBox(
              height: height,
              child: AnimatedBuilder(
                animation: _turn,
                builder: (context, child) {
                  final angle = _turn.value;
                  final showBack = angle > math.pi / 2;
                  final transform = Matrix4.identity()
                    ..setEntry(3, 2, 0.0012)
                    ..rotateY(angle);
                  return Transform(
                    alignment: Alignment.center,
                    transform: transform,
                    child: showBack
                        ? Transform(
                            alignment: Alignment.center,
                            transform: Matrix4.identity()..rotateY(math.pi),
                            child: _IdBack(student: widget.student),
                          )
                        : _IdFront(
                            student: widget.student,
                            sectionLabel: widget.sectionLabel,
                          ),
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

class _IdFront extends StatelessWidget {
  const _IdFront({required this.student, this.sectionLabel});

  final User student;
  final String? sectionLabel;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: tokens.surface,
        border: Border.all(color: tokens.maroon, width: 2),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: tokens.maroon,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: tokens.gold,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    'PUP',
                    style: TextStyle(
                      color: tokens.deepMaroon,
                      fontWeight: FontWeight.w800,
                      fontSize: 8,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'POLYTECHNIC UNIVERSITY OF THE PHILIPPINES',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 9,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 74,
                    height: 88,
                    decoration: BoxDecoration(
                      color: tokens.campus,
                      border: Border.all(color: tokens.borderSubtle),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      _initials(student.fullName),
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            color: tokens.maroon,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          student.fullName,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                color: tokens.deepMaroon,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          student.studentId ?? '—',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: tokens.maroon,
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          student.program ?? '—',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                        ),
                        if (student.yearLevel != null)
                          Text(
                            'Year ${student.yearLevel}',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        const Spacer(),
                        if ((sectionLabel ?? '').isNotEmpty)
                          Text(
                            sectionLabel!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: tokens.deepMaroon,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Container(
            color: tokens.gold,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            child: Text(
              'TAP TO FLIP · VALID FOR THIS SEMESTER',
              style: TextStyle(
                color: tokens.deepMaroon,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
                fontSize: 8,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _IdBack extends StatelessWidget {
  const _IdBack({required this.student});

  final User student;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: tokens.surface,
        border: Border.all(color: tokens.maroon, width: 2),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(height: 18, color: Colors.black87),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CONDITIONS OF USE',
                  style: TextStyle(
                    color: tokens.maroon,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    fontSize: 9,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'This digital ID is bound to the verified account and device '
                  'installation. It cannot be transferred or screenshotted for '
                  'proxy attendance.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.muted,
                    height: 1.35,
                    fontSize: 10,
                  ),
                ),
                const SizedBox(height: 8),
                _BackRow(label: 'Program', value: student.program ?? '—'),
                _BackRow(
                  label: 'Year level',
                  value: student.yearLevel == null
                      ? '—'
                      : '${student.yearLevel}',
                ),
                _BackRow(
                  label: 'Emergency contact',
                  value: student.contactPhone?.isNotEmpty == true
                      ? (student.contactPhone ?? '—')
                      : 'Not on file',
                ),
                const Spacer(),
                Text(
                  'PUP Santa Maria · Bulacan',
                  style: TextStyle(
                    color: tokens.maroon,
                    fontWeight: FontWeight.w700,
                    fontSize: 9,
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

class _BackRow extends StatelessWidget {
  const _BackRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1.5),
      child: Row(
        children: [
          SizedBox(
            width: 104,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.muted,
                fontSize: 10,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _initials(String name) {
  final parts = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList(growable: false);
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
      .toUpperCase();
}
