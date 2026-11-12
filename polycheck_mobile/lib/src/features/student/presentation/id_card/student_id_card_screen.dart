import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_providers.dart';

/// Full-screen digital student ID with the 3D flip, holographic sweep, and a
/// live trusted-clock watermark.
class StudentIdCardScreen extends ConsumerStatefulWidget {
  const StudentIdCardScreen({super.key});

  @override
  ConsumerState<StudentIdCardScreen> createState() =>
      _StudentIdCardScreenState();
}

class _StudentIdCardScreenState extends ConsumerState<StudentIdCardScreen>
    with TickerProviderStateMixin {
  late final AnimationController _flipController;
  late final AnimationController _sweepController;
  Timer? _watermarkTimer;
  bool _reduceMotion = true;
  bool _motionConfigured = false;

  @override
  void initState() {
    super.initState();
    _flipController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _sweepController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 6),
    );
    _watermarkTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    if (_motionConfigured && reduceMotion == _reduceMotion) return;
    _motionConfigured = true;
    _reduceMotion = reduceMotion;
    if (reduceMotion) {
      _sweepController.stop();
      _sweepController.value = 0.35;
    } else if (!_sweepController.isAnimating) {
      _sweepController.repeat();
    }
  }

  @override
  void dispose() {
    _watermarkTimer?.cancel();
    _flipController.dispose();
    _sweepController.dispose();
    super.dispose();
  }

  void _toggleFlip() {
    if (_reduceMotion) {
      setState(() {
        _flipController.value = _flipController.value >= 0.5 ? 0 : 1;
      });
      return;
    }
    if (_flipController.value >= 0.5) {
      _flipController.reverse();
    } else {
      _flipController.forward();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider).user;
    final sections = ref.watch(studentSectionsProvider).value;
    final chip = ref.watch(studentDeviceChipProvider).value;
    final trustedClock = ref.watch(trustedClockProvider);
    final deviceNow = ref.watch(deviceNowProvider);

    if (user == null) {
      return Scaffold(
        appBar: const CampusHeader(title: 'Digital Student ID'),
        body: const CampusLoading(),
      );
    }

    final sectionLabel = (sections != null && sections.isNotEmpty)
        ? formatSectionHeading(
            section: sections.first.section,
            course: sections.first.course,
          )
        : 'Section —';
    final stamp = formatLiveUtcStamp(trustedClock.nowMs(deviceNow: deviceNow));
    final watermark = buildWatermarkLine(stamp, chip ?? maskDeviceChip(null));

    return Scaffold(
      appBar: const CampusHeader(
        title: 'Digital Student ID',
        subtitle: 'Tap the card to flip',
      ),
      backgroundColor: PupColors.surfaceDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: GestureDetector(
                    key: const ValueKey('student-id-card'),
                    onTap: _toggleFlip,
                    child: AspectRatio(
                      aspectRatio: 1.586,
                      child: AnimatedBuilder(
                        animation: Listenable.merge(<Listenable>[
                          _flipController,
                          _sweepController,
                        ]),
                        builder: (context, _) {
                          final angle = _flipController.value * math.pi;
                          final showBack = angle > math.pi / 2;
                          final displayAngle = showBack
                              ? angle - math.pi
                              : angle;
                          return Transform(
                            alignment: Alignment.center,
                            transform: Matrix4.identity()
                              ..setEntry(3, 2, 0.001)
                              ..rotateY(displayAngle),
                            child: showBack
                                ? _IdCardBack(
                                    user: user,
                                    watermark: watermark,
                                    sweep: _sweepController.value,
                                    reduceMotion: _reduceMotion,
                                  )
                                : _IdCardFront(
                                    user: user,
                                    sectionLabel: sectionLabel,
                                    watermark: watermark,
                                    sweep: _sweepController.value,
                                    reduceMotion: _reduceMotion,
                                  ),
                          );
                        },
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                AnimatedBuilder(
                  animation: _flipController,
                  builder: (context, _) => Text(
                    _flipController.value >= 0.5
                        ? 'Tap to view the front'
                        : 'Tap to view the back',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: PupColors.pupGold,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.1,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _IdCardFront extends StatelessWidget {
  const _IdCardFront({
    required this.user,
    required this.sectionLabel,
    required this.watermark,
    required this.sweep,
    required this.reduceMotion,
  });

  final User user;
  final String sectionLabel;
  final String watermark;
  final double sweep;
  final bool reduceMotion;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: tokens.borderSubtle, width: 1.5),
      ),
      child: Column(
        children: <Widget>[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: const BoxDecoration(
              color: PupColors.pupMaroon,
              border: Border(
                bottom: BorderSide(color: PupColors.pupGold, width: 2),
              ),
            ),
            child: Row(
              children: <Widget>[
                Container(
                  width: 34,
                  height: 34,
                  color: Colors.white,
                  alignment: Alignment.center,
                  child: const Text(
                    'PUP',
                    style: TextStyle(
                      color: PupColors.pupMaroon,
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      fontFamily: 'Lora',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'REPUBLIC OF THE PHILIPPINES',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: PupColors.pupGold,
                          fontSize: 6,
                          letterSpacing: 1.1,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'POLYTECHNIC UNIVERSITY OF THE PHILIPPINES',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Colors.white,
                          fontSize: 7.5,
                          letterSpacing: 0.6,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.verified, color: PupColors.pupGold, size: 17),
              ],
            ),
          ),
          Expanded(
            child: Stack(
              children: <Widget>[
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      SizedBox(
                        width: 92,
                        child: Column(
                          children: <Widget>[
                            AspectRatio(
                              aspectRatio: 3 / 4,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: PupColors.campusLight,
                                  border: Border.all(
                                    color: tokens.borderSubtle,
                                    width: 1.5,
                                  ),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  _initials(user.fullName),
                                  style: const TextStyle(
                                    color: PupColors.pupMaroon,
                                    fontSize: 28,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 5),
                            Container(height: 1, color: PupColors.ink),
                            const SizedBox(height: 2),
                            Text(
                              'SIGNATURE',
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: tokens.muted,
                                    fontSize: 5.5,
                                    letterSpacing: 0.7,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            _CardFieldLabel('STUDENT NUMBER'),
                            Text(
                              user.studentId?.trim().isNotEmpty == true
                                  ? user.studentId!
                                  : user.id,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: PupColors.pupMaroon,
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                fontFamily: 'monospace',
                              ),
                            ),
                            const SizedBox(height: 7),
                            _CardFieldLabel('FULL NAME'),
                            Text(
                              user.fullName.toUpperCase(),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: PupColors.ink,
                                fontSize: 12,
                                height: 1.15,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 7),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: <Widget>[
                                      _CardFieldLabel('PROGRAM'),
                                      Text(
                                        user.program?.trim().isNotEmpty == true
                                            ? user.program!
                                            : 'PUP Student',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: PupColors.ink,
                                          fontSize: 8.5,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    _CardFieldLabel('YEAR'),
                                    Text(
                                      '${user.yearLevel ?? 1}',
                                      style: const TextStyle(
                                        color: PupColors.ink,
                                        fontSize: 8.5,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 5),
                            _CardFieldLabel('SECTION'),
                            Text(
                              sectionLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: PupColors.ink,
                                fontSize: 8.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                _HologramSweep(
                  sweep: sweep,
                  reduceMotion: reduceMotion,
                  watermark: watermark,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _IdCardBack extends StatelessWidget {
  const _IdCardBack({
    required this.user,
    required this.watermark,
    required this.sweep,
    required this.reduceMotion,
  });

  final User user;
  final String watermark;
  final double sweep;
  final bool reduceMotion;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final contact = <String>[
      if (user.contactPhone?.trim().isNotEmpty == true) user.contactPhone!,
      if (user.contactEmail?.trim().isNotEmpty == true) user.contactEmail!,
    ];
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: tokens.borderSubtle, width: 1.5),
      ),
      child: Stack(
        children: <Widget>[
          Column(
            children: <Widget>[
              Container(
                height: 30,
                margin: const EdgeInsets.only(top: 12),
                color: PupColors.ink,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            const Text(
                              'CONDITIONS OF USE',
                              style: TextStyle(
                                color: PupColors.pupMaroon,
                                fontSize: 7.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1,
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'This card is non-transferable and must be presented upon entry to the university premises. The finder of this lost card is requested to surrender it to the Office of Student Affairs.',
                              style: TextStyle(
                                color: PupColors.muted,
                                fontSize: 6.5,
                                height: 1.35,
                              ),
                            ),
                            const Spacer(),
                            _CardFieldLabel('EMERGENCY CONTACT'),
                            const SizedBox(height: 3),
                            if (contact.isEmpty) ...<Widget>[
                              _ContactLine(),
                              const SizedBox(height: 5),
                              _ContactLine(),
                            ] else
                              for (final line in contact)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 4),
                                  child: Text(
                                    line,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: PupColors.ink,
                                      fontSize: 7.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        width: 92,
                        padding: const EdgeInsets.only(left: 8),
                        decoration: BoxDecoration(
                          border: Border(
                            left: BorderSide(
                              color: tokens.borderSubtle,
                              width: 1,
                            ),
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: <Widget>[
                            AspectRatio(
                              aspectRatio: 1,
                              child: Container(
                                padding: const EdgeInsets.all(3),
                                color: Colors.white,
                                child: CustomPaint(
                                  painter: _IdQrPlaceholderPainter(
                                    seed:
                                        '${user.id}|${user.studentId ?? ''}|polycheck',
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'SCAN TO VERIFY',
                              style: TextStyle(
                                color: PupColors.muted,
                                fontSize: 6,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.8,
                              ),
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
          _HologramSweep(
            sweep: sweep,
            reduceMotion: reduceMotion,
            watermark: watermark,
          ),
        ],
      ),
    );
  }
}

class _ContactLine extends StatelessWidget {
  const _ContactLine();

  @override
  Widget build(BuildContext context) {
    return Container(height: 1, color: PupColors.borderSubtleLight);
  }
}

class _CardFieldLabel extends StatelessWidget {
  const _CardFieldLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 1),
      child: Text(
        label,
        style: const TextStyle(
          color: PupColors.muted,
          fontSize: 6,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.9,
        ),
      ),
    );
  }
}

class _HologramSweep extends StatelessWidget {
  const _HologramSweep({
    required this.sweep,
    required this.reduceMotion,
    required this.watermark,
  });

  final double sweep;
  final bool reduceMotion;
  final String watermark;

  @override
  Widget build(BuildContext context) {
    final position = reduceMotion ? 0.35 : sweep;
    return Positioned.fill(
      child: IgnorePointer(
        child: Stack(
          children: <Widget>[
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment(-2.2 + position * 4.4, -1),
                    end: Alignment(-1.2 + position * 4.4, 1),
                    colors: <Color>[
                      Colors.transparent,
                      PupColors.pupGold.withValues(alpha: 0.16),
                      PupColors.pupMaroon.withValues(alpha: 0.10),
                      Colors.transparent,
                    ],
                    stops: const <double>[0.25, 0.45, 0.55, 0.75],
                    transform: const GradientRotation(22 * math.pi / 180),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 7,
              right: 7,
              bottom: 4,
              child: Text(
                watermark,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: PupColors.pupDeepMaroon,
                  fontSize: 5.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.45,
                  fontFamily: 'monospace',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Deterministic QR-like matrix for the back face. Deliberately not a real QR
/// (no new dependency): the live token flow never uses the ID-card image.
class _IdQrPlaceholderPainter extends CustomPainter {
  _IdQrPlaceholderPainter({required this.seed});

  final String seed;

  static const int _modules = 21;

  @override
  void paint(Canvas canvas, Size size) {
    final cell = size.width / _modules;
    final paint = Paint()..color = PupColors.ink;
    var state = _fnv1a(seed);
    bool nextBit() {
      state ^= (state << 13) & 0xFFFFFFFF;
      state ^= state >> 17;
      state ^= (state << 5) & 0xFFFFFFFF;
      state &= 0xFFFFFFFF;
      return state & 1 == 1;
    }

    for (var y = 0; y < _modules; y++) {
      for (var x = 0; x < _modules; x++) {
        if (_inFinder(x, y)) continue;
        if (nextBit()) {
          canvas.drawRect(Rect.fromLTWH(x * cell, y * cell, cell, cell), paint);
        }
      }
    }

    void finder(int ox, int oy) {
      canvas.drawRect(
        Rect.fromLTWH(ox * cell, oy * cell, cell * 7, cell * 7),
        paint,
      );
      canvas.drawRect(
        Rect.fromLTWH((ox + 1) * cell, (oy + 1) * cell, cell * 5, cell * 5),
        Paint()..color = Colors.white,
      );
      canvas.drawRect(
        Rect.fromLTWH((ox + 2) * cell, (oy + 2) * cell, cell * 3, cell * 3),
        paint,
      );
    }

    finder(0, 0);
    finder(14, 0);
    finder(0, 14);
  }

  bool _inFinder(int x, int y) {
    final inTopLeft = x < 8 && y < 8;
    final inTopRight = x > 12 && y < 8;
    final inBottomLeft = x < 8 && y > 12;
    return inTopLeft || inTopRight || inBottomLeft;
  }

  int _fnv1a(String value) {
    var hash = 0x811C9DC5;
    for (final code in value.codeUnits) {
      hash ^= code;
      hash = (hash * 0x01000193) & 0xFFFFFFFF;
    }
    return hash == 0 ? 0x9E3779B9 : hash;
  }

  @override
  bool shouldRepaint(covariant _IdQrPlaceholderPainter oldDelegate) =>
      oldDelegate.seed != seed;
}

String _initials(String fullName) {
  final parts = fullName
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList(growable: false);
  if (parts.isEmpty) return '?';
  if (parts.length == 1) {
    return parts.first.substring(0, 1).toUpperCase();
  }
  return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
      .toUpperCase();
}
