import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/presentation/scan/student_scan_screen.dart';

import '../../helpers/auth_harness.dart';
import 'student_test_harness.dart';

/// DD-F11: the header torch control reads the controller's reported torch
/// state, so a camera restart (which resets the torch) can never leave the
/// icon claiming the flashlight is on.
class _FakeScannerController extends MobileScannerController {
  _FakeScannerController()
    : super(
        // No platform session exists in widget tests.
        autoStart: false,
        formats: const <BarcodeFormat>[BarcodeFormat.qrCode],
      );

  int toggles = 0;
  bool rejectToggles = false;

  @override
  Future<void> toggleTorch() async {
    toggles += 1;
    if (rejectToggles) {
      throw const MobileScannerException(
        errorCode: MobileScannerErrorCode.unsupported,
      );
    }
    value = value.copyWith(
      torchState: value.torchState == TorchState.on
          ? TorchState.off
          : TorchState.on,
    );
  }

  /// The platform resets the torch to off when the camera restarts.
  void simulateCameraReinit() {
    value = value.copyWith(torchState: TorchState.off);
  }
}

class _OnlineBanner extends OfflineBannerController {
  @override
  bool build() => false;
}

IconData _torchIcon(WidgetTester tester) {
  final icon = tester.widget<Icon>(
    find.descendant(
      of: find.byKey(const ValueKey('scan-torch')),
      matching: find.byType(Icon),
    ),
  );
  return icon.icon!;
}

Future<void> _pumpScanner(
  WidgetTester tester,
  MobileScannerController controller,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sessionProvider.overrideWith(() => FakeSessionController(studentUser)),
        offlineBannerProvider.overrideWith(_OnlineBanner.new),
      ],
      child: MaterialApp(
        theme: PupTheme.light,
        home: StudentScanScreen(controller: controller),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('the torch icon follows the controller through a re-init', (
    tester,
  ) async {
    final controller = _FakeScannerController();
    await _pumpScanner(tester, controller);

    expect(_torchIcon(tester), Icons.flash_off_outlined);

    await tester.tap(find.byKey(const ValueKey('scan-torch')));
    await tester.pump();

    expect(controller.toggles, 1);
    expect(_torchIcon(tester), Icons.flash_on);

    // Camera re-initialization: the controller publishes the reset torch
    // state and the icon must follow it back to off.
    controller.simulateCameraReinit();
    await tester.pump();
    expect(_torchIcon(tester), Icons.flash_off_outlined);

    // Toggling again still works after the restart.
    await tester.tap(find.byKey(const ValueKey('scan-torch')));
    await tester.pump();
    expect(controller.toggles, 2);
    expect(_torchIcon(tester), Icons.flash_on);
  });

  testWidgets('a rejected torch toggle leaves the icon on the real state', (
    tester,
  ) async {
    final controller = _FakeScannerController()..rejectToggles = true;
    await _pumpScanner(tester, controller);

    await tester.tap(find.byKey(const ValueKey('scan-torch')));
    await tester.pump();

    expect(controller.toggles, 1);
    expect(tester.takeException(), isNull);
    // The old local toggle flipped the icon even though the torch never lit.
    expect(_torchIcon(tester), Icons.flash_off_outlined);
  });
}
