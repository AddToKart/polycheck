import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/student_scan_service.dart';
import '../../student_paths.dart';
import 'scan_entry_dialogs.dart';

/// Full-screen QR scanner for student check-in.
///
/// The camera only mounts while this route is alive; leaving the route disposes
/// the controller and invalidates any in-flight operation via a generation
/// counter, so a stale scan can never surface after navigation.
class StudentScanScreen extends ConsumerStatefulWidget {
  const StudentScanScreen({super.key, this.controller});

  /// Scanner-controller seam for widget tests (production builds create and
  /// own their controller). An injected controller stays owned by the caller.
  final MobileScannerController? controller;

  @override
  ConsumerState<StudentScanScreen> createState() => _StudentScanScreenState();
}

class _StudentScanScreenState extends ConsumerState<StudentScanScreen> {
  MobileScannerController? _scannerController;
  bool _ownsScannerController = true;
  bool _processing = false;
  bool _promptOpen = false;
  bool _analyzing = false;
  TorchState _torchState = TorchState.unavailable;
  int _generation = 0;
  StudentScanOutcome? _outcome;
  Timer? _resultTimer;

  @override
  void initState() {
    super.initState();
    final injected = widget.controller;
    _ownsScannerController = injected == null;
    // The torch icon is driven by the controller's own state, never by a
    // local guess: the platform resets the torch on a camera restart, so a
    // cached boolean drifts from the hardware.
    final controller =
        injected ??
        MobileScannerController(
          formats: const <BarcodeFormat>[BarcodeFormat.qrCode],
        );
    _scannerController = controller;
    _torchState = controller.value.torchState;
    controller.addListener(_handleScannerState);
  }

  @override
  void dispose() {
    _generation += 1;
    _resultTimer?.cancel();
    final controller = _scannerController;
    _scannerController = null;
    if (controller != null) {
      controller.removeListener(_handleScannerState);
      if (_ownsScannerController) {
        unawaited(controller.dispose());
      }
    }
    super.dispose();
  }

  /// Mirrors the controller's reported torch state (including the off reset
  /// after a camera re-initialization) into the header icon.
  void _handleScannerState() {
    final next = _scannerController?.value.torchState ?? TorchState.unavailable;
    if (next == _torchState) return;
    if (!mounted) {
      _torchState = next;
      return;
    }
    setState(() => _torchState = next);
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing ||
        _promptOpen ||
        _analyzing ||
        _outcome != null ||
        !mounted) {
      return;
    }
    String? raw;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue;
      if (value != null && value.trim().isNotEmpty) {
        raw = value;
        break;
      }
    }
    if (raw == null) return;
    await _submitToken(raw, ScanInputChannel.camera);
  }

  Future<void> _submitToken(
    String raw,
    ScanInputChannel channel, {
    String? pin,
  }) async {
    if (!mounted || _processing) return;
    final user = ref.read(sessionProvider).user;
    if (user == null) return;
    final operation = _generation;
    setState(() {
      _processing = true;
      _outcome = null;
    });

    final service = ref.read(studentScanServiceProvider);
    StudentScanOutcome outcome;
    try {
      outcome = await service.submitToken(
        rawToken: raw,
        student: user,
        channel: channel,
        pin: pin,
      );
    } on Object {
      outcome = const StudentScanOutcome(
        kind: ScanOutcomeKind.error,
        title: 'CHECK-IN FAILED',
        message: 'Something went wrong while submitting your check-in.',
      );
    }
    if (!_isCurrent(operation)) return;

    if (outcome.kind == ScanOutcomeKind.pinRequired) {
      final entered = await _promptForPin();
      if (!_isCurrent(operation)) return;
      if (entered == null) {
        setState(() => _processing = false);
        return;
      }
      try {
        outcome = await service.submitToken(
          rawToken: raw,
          student: user,
          channel: channel,
          pin: entered,
        );
      } on Object {
        outcome = const StudentScanOutcome(
          kind: ScanOutcomeKind.error,
          title: 'CHECK-IN FAILED',
          message: 'Something went wrong while submitting your check-in.',
        );
      }
      if (!_isCurrent(operation)) return;
    }

    setState(() {
      _processing = false;
      _outcome = outcome;
    });
    _resultTimer?.cancel();
    _resultTimer = Timer(const Duration(seconds: 8), () {
      if (mounted && _isCurrent(operation)) {
        setState(() => _outcome = null);
      }
    });
  }

  bool _isCurrent(int operation) => mounted && operation == _generation;

  Future<String?> _promptForPin() async {
    _promptOpen = true;
    try {
      // The dialog owns (and disposes) its own controller, so the sheet can
      // finish its exit transition after this future resolves.
      return await showMeetingPinDialog(context);
    } finally {
      _promptOpen = false;
    }
  }

  void _showTransientOutcome(StudentScanOutcome outcome) {
    if (!mounted) return;
    setState(() {
      _analyzing = false;
      _outcome = outcome;
    });
    _resultTimer?.cancel();
    _resultTimer = Timer(const Duration(seconds: 8), () {
      if (mounted) setState(() => _outcome = null);
    });
  }

  /// Uploaded-image fallback: decode with [MobileScannerController.analyzeImage]
  /// and replay the decoded payload through the same local validation pipeline
  /// as the camera (window, PIN, geofence/online mode, offline queue).
  Future<void> _pickQrImage() async {
    if (_processing || _promptOpen || _analyzing) return;
    _promptOpen = true;
    XFile? file;
    try {
      file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 2048,
        maxHeight: 2048,
      );
    } on Object {
      file = null;
    } finally {
      _promptOpen = false;
    }
    if (!mounted || file == null) return;

    final controller = _scannerController;
    if (controller == null) {
      _showTransientOutcome(
        const StudentScanOutcome(
          kind: ScanOutcomeKind.error,
          title: 'IMAGE UPLOAD UNAVAILABLE',
          message: 'The QR decoder is not ready. Scan the live QR instead.',
        ),
      );
      return;
    }

    final operation = _generation;
    setState(() {
      _analyzing = true;
      _outcome = null;
    });

    BarcodeCapture? capture;
    String? failure;
    try {
      capture = await controller.analyzeImage(
        file.path,
        formats: const <BarcodeFormat>[BarcodeFormat.qrCode],
      );
    } on UnsupportedError {
      failure =
          'Image analysis is not supported on this device. Scan the live QR instead.';
    } on MobileScannerBarcodeException {
      failure =
          'The image could not be decoded. Choose a clearer screenshot of the QR.';
    } on Object {
      failure =
          'The image could not be decoded. Choose another image and try again.';
    }
    if (!_isCurrent(operation)) return;
    if (failure != null) {
      _showTransientOutcome(
        StudentScanOutcome(
          kind: ScanOutcomeKind.rejected,
          title: 'IMAGE NOT READ',
          message: failure,
        ),
      );
      return;
    }

    String? raw;
    for (final barcode in capture?.barcodes ?? const <Barcode>[]) {
      final value = barcode.rawValue;
      if (value != null && value.trim().isNotEmpty) {
        raw = value;
        break;
      }
    }
    if (raw == null) {
      _showTransientOutcome(
        const StudentScanOutcome(
          kind: ScanOutcomeKind.rejected,
          title: 'NO QR FOUND',
          message:
              'No attendance QR was found in that image. Choose a clearer screenshot and try again.',
        ),
      );
      return;
    }

    final payload = decodeTokenPayload(raw);
    if (payload != null && !shouldShowScanFallbacks(payload.mode)) {
      _showTransientOutcome(
        const StudentScanOutcome(
          kind: ScanOutcomeKind.rejected,
          title: 'IMAGE UPLOAD DISABLED',
          message:
              'Image upload is disabled for in-person check-in. Scan the live QR or enter the code.',
        ),
      );
      return;
    }

    setState(() => _analyzing = false);
    await _submitToken(raw, ScanInputChannel.image);
  }

  Future<void> _openManualEntry() async {
    if (_processing || _promptOpen || _analyzing) return;
    _promptOpen = true;
    String? token;
    try {
      token = await showManualTokenEntryDialog(context);
    } finally {
      _promptOpen = false;
    }
    if (token == null || token.trim().isEmpty || !mounted) return;
    // Give the dialog one frame of teardown before this screen flips into its
    // submitting state; the dialog (not this State) owns the controller.
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return;
    await _submitToken(token, ScanInputChannel.manual);
  }

  Future<void> _toggleTorch() async {
    final controller = _scannerController;
    if (controller == null) return;
    try {
      // The controller reports the resulting state through its own value
      // stream; [_handleScannerState] flips the icon from that, never from a
      // locally inverted boolean.
      await controller.toggleTorch();
    } on Object {
      // Documented degraded mode: cameras without a torch keep the scan flow
      // working and the icon stays in sync with the controller's real state.
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final outcome = _outcome;
    // The boot offline strip is an overlay above the Navigator; this screen
    // has no AppBar, so reserve its height at the top of the header (SW-7).
    final offlineBannerVisible = ref.watch(offlineBannerProvider);
    return Scaffold(
      backgroundColor: PupColors.surfaceDark,
      body: SafeArea(
        child: Stack(
          children: <Widget>[
            Positioned.fill(
              child: MobileScanner(
                controller: _scannerController,
                onDetect: _onDetect,
                errorBuilder: (context, error) => _CameraError(
                  message:
                      error.errorCode == MobileScannerErrorCode.permissionDenied
                      ? 'Camera permission was denied. Enable it in system settings and reopen the scanner.'
                      : 'The camera could not start on this device.',
                ),
              ),
            ),
            Positioned.fill(
              child: IgnorePointer(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final side = math.min(constraints.maxWidth * 0.78, 320.0);
                    final center = Offset(
                      constraints.maxWidth / 2,
                      constraints.maxHeight / 2 - 24,
                    );
                    final hole = Rect.fromCenter(
                      center: center,
                      width: side,
                      height: side,
                    );
                    return CustomPaint(
                      painter: _ScannerOverlayPainter(
                        hole: hole,
                        gold: PupColors.pupGold,
                      ),
                    );
                  },
                ),
              ),
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                key: const ValueKey('scan-header'),
                padding: EdgeInsets.fromLTRB(
                  8,
                  8 + (offlineBannerVisible ? offlineBannerHeight : 0),
                  8,
                  10,
                ),
                color: PupColors.surfaceDark.withValues(alpha: 0.82),
                child: Row(
                  children: <Widget>[
                    IconButton(
                      key: const ValueKey('scan-close'),
                      tooltip: 'Close scanner',
                      color: Colors.white,
                      onPressed: () => context.go(StudentPaths.dashboard),
                      icon: const Icon(Icons.close),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'POLYCHECK SCANNER',
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: PupColors.pupGold,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.4,
                                ),
                          ),
                          Text(
                            'Live attendance check',
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      key: const ValueKey('scan-torch'),
                      tooltip: _torchState == TorchState.on
                          ? 'Turn flashlight off'
                          : 'Turn flashlight on',
                      color: PupColors.pupGold,
                      onPressed: _toggleTorch,
                      icon: Icon(
                        _torchState == TorchState.on
                            ? Icons.flash_on
                            : Icons.flash_off_outlined,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                decoration: BoxDecoration(
                  color: PupColors.surfaceDark.withValues(alpha: 0.9),
                  border: Border(
                    top: BorderSide(
                      color: Colors.white.withValues(alpha: 0.14),
                    ),
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    if (outcome != null) ...<Widget>[
                      _ResultCard(
                        outcome: outcome,
                        onDismiss: () {
                          _resultTimer?.cancel();
                          setState(() => _outcome = null);
                        },
                        onScanAgain: () {
                          _resultTimer?.cancel();
                          setState(() => _outcome = null);
                        },
                      ),
                      const SizedBox(height: 10),
                    ],
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: OutlinedButton.icon(
                            key: const ValueKey('scan-manual-open'),
                            onPressed: _processing || _analyzing
                                ? null
                                : _openManualEntry,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: BorderSide(
                                color: Colors.white.withValues(alpha: 0.35),
                              ),
                              minimumSize: const Size(0, 46),
                            ),
                            icon: const Icon(Icons.keyboard_outlined, size: 18),
                            label: const Text('Enter code'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            key: const ValueKey('scan-upload-open'),
                            onPressed: _processing || _analyzing
                                ? null
                                : _pickQrImage,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: BorderSide(
                                color: Colors.white.withValues(alpha: 0.35),
                              ),
                              minimumSize: const Size(0, 46),
                            ),
                            icon: const Icon(Icons.image_outlined, size: 18),
                            label: const Text('Upload QR'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Center the instructor QR inside the gold frame. Online '
                      'classes do not require location access. Image upload '
                      'follows the online / opt-in fallback policy.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.72),
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if ((_processing || _analyzing) && outcome == null)
              Positioned(
                left: 0,
                right: 0,
                top: 90,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    color: PupColors.surfaceDark.withValues(alpha: 0.9),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: tokens.gold,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _analyzing
                              ? 'Reading QR image…'
                              : 'Verifying check-in…',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({
    required this.outcome,
    required this.onDismiss,
    required this.onScanAgain,
  });

  final StudentScanOutcome outcome;
  final VoidCallback onDismiss;
  final VoidCallback onScanAgain;

  @override
  Widget build(BuildContext context) {
    final positive =
        outcome.kind == ScanOutcomeKind.success ||
        outcome.kind == ScanOutcomeKind.offlineQueued ||
        outcome.kind == ScanOutcomeKind.pinRequired;
    final background = positive ? PupColors.pupGold : PupColors.pupDeepMaroon;
    final foreground = positive ? PupColors.pupDeepMaroon : Colors.white;
    return Semantics(
      liveRegion: true,
      child: Container(
        key: const ValueKey('scan-result'),
        padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
        decoration: BoxDecoration(
          color: background,
          border: Border.all(
            color: positive ? PupColors.pupGold : PupColors.pupGold,
            width: 1.5,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(
              outcome.kind == ScanOutcomeKind.offlineQueued
                  ? Icons.cloud_upload_outlined
                  : positive
                  ? Icons.check_circle_outline
                  : Icons.error_outline,
              size: 20,
              color: foreground,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    outcome.title,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: foreground,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    outcome.message,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: foreground.withValues(alpha: 0.9),
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: <Widget>[
                      TextButton(
                        onPressed: onScanAgain,
                        style: TextButton.styleFrom(
                          foregroundColor: foreground,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          minimumSize: const Size(0, 32),
                        ),
                        child: const Text('Scan another'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Dismiss result',
              onPressed: onDismiss,
              icon: Icon(Icons.close, size: 18, color: foreground),
            ),
          ],
        ),
      ),
    );
  }
}

class _CameraError extends StatelessWidget {
  const _CameraError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: PupColors.surfaceDark,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const Icon(
                Icons.camera_alt_outlined,
                size: 34,
                color: PupColors.pupGold,
              ),
              const SizedBox(height: 12),
              Text(
                'Camera access needed',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Enable camera permission to scan live class attendance codes. ($message)',
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: Colors.white70),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScannerOverlayPainter extends CustomPainter {
  const _ScannerOverlayPainter({required this.hole, required this.gold});

  final Rect hole;
  final Color gold;

  @override
  void paint(Canvas canvas, Size size) {
    final mask = Path()
      ..addRect(Offset.zero & size)
      ..addRect(hole)
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(
      mask,
      Paint()..color = Colors.black.withValues(alpha: 0.48),
    );

    final bracket = Paint()
      ..color = gold
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.square
      ..style = PaintingStyle.stroke;
    const length = 34.0;
    final left = hole.left;
    final right = hole.right;
    final top = hole.top;
    final bottom = hole.bottom;

    canvas.drawPath(
      Path()
        ..moveTo(left, top + length)
        ..lineTo(left, top)
        ..lineTo(left + length, top),
      bracket,
    );
    canvas.drawPath(
      Path()
        ..moveTo(right - length, top)
        ..lineTo(right, top)
        ..lineTo(right, top + length),
      bracket,
    );
    canvas.drawPath(
      Path()
        ..moveTo(left, bottom - length)
        ..lineTo(left, bottom)
        ..lineTo(left + length, bottom),
      bracket,
    );
    canvas.drawPath(
      Path()
        ..moveTo(right - length, bottom)
        ..lineTo(right, bottom)
        ..lineTo(right, bottom - length),
      bracket,
    );
  }

  @override
  bool shouldRepaint(covariant _ScannerOverlayPainter oldDelegate) =>
      oldDelegate.hole != hole || oldDelegate.gold != gold;
}
