import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/utils/device_security.dart';

void main() {
  group('DefaultDeviceSecurityProber (injected seams)', () {
    test('a root candidate hit flags the device and shapes evidence', () async {
      final prober = DefaultDeviceSecurityProber(
        readOperatingSystem: () => 'android',
        readEnvironment: () => const <String, String>{},
        readFingerprint: () => '',
        pathProbe: (path) => path == '/data/adb/magisk',
      );

      final evidence = await prober.probe();

      expect(evidence.rootDetected, isTrue);
      expect(evidence.hookDetected, isFalse);
      expect(evidence.emulatorDetected, isFalse);
    });

    test('a jailbreak candidate is checked on iOS', () async {
      final prober = DefaultDeviceSecurityProber(
        readOperatingSystem: () => 'ios',
        readEnvironment: () => const <String, String>{},
        readFingerprint: () => '',
        pathProbe: (path) => path == '/private/var/lib/apt',
      );

      final evidence = await prober.probe();

      expect(evidence.rootDetected, isTrue);
    });

    test('a clean device shapes the fully-resolved clean evidence', () async {
      final prober = DefaultDeviceSecurityProber(
        readOperatingSystem: () => 'android',
        readEnvironment: () => const <String, String>{},
        readFingerprint: () => '',
        pathProbe: (path) => false,
        hookPortProbe: (port) => false,
      );

      final evidence = await prober.probe();

      expect(evidence.rootDetected, isFalse);
      expect(evidence.hookDetected, isFalse);
      expect(evidence.emulatorDetected, isFalse);
      // The server's DeviceSecurityEvidenceDto accepts all three booleans.
      expect(evidence.toJson(), <String, dynamic>{
        'rootDetected': false,
        'hookDetected': false,
        'emulatorDetected': false,
      });
    });

    test(
      'hooking verdicts come from environment keys, artifacts and ports',
      () async {
        final envProber = DefaultDeviceSecurityProber(
          readOperatingSystem: () => 'android',
          readEnvironment: () => <String, String>{'XPOSED_BRIDGE': 'classic'},
          readFingerprint: () => '',
          pathProbe: (path) => false,
        );
        expect((await envProber.probe()).hookDetected, isTrue);

        final artifactProber = DefaultDeviceSecurityProber(
          readOperatingSystem: () => 'android',
          readEnvironment: () => const <String, String>{},
          readFingerprint: () => '',
          pathProbe: (path) => path == '/data/local/tmp/frida-server',
        );
        expect((await artifactProber.probe()).hookDetected, isTrue);

        final portProber = DefaultDeviceSecurityProber(
          readOperatingSystem: () => 'android',
          readEnvironment: () => const <String, String>{},
          readFingerprint: () => '',
          pathProbe: (path) => false,
          hookPortProbe: (port) => port == 27042,
        );
        expect((await portProber.probe()).hookDetected, isTrue);
      },
    );

    test('emulator fingerprints match the RN marker list', () {
      expect(
        fingerprintLooksLikeEmulator(
          'google/sdk_gphone64_arm64/emulator64-arm64:16/UDSC1.261114.001:user/dev-keys',
        ),
        isTrue,
      );
      expect(
        fingerprintLooksLikeEmulator(
          'rtl generic/ranchu model goldfish_ranchu',
        ),
        isTrue,
      );
      expect(
        fingerprintLooksLikeEmulator(
          'samsung/beyond1/beyond1:15/AP3A/Beyond1:Tesla',
        ),
        isFalse,
      );
      expect(
        fingerprintLooksLikeEmulator('Google Pixel 9 Pro (dev, testing)'),
        isFalse,
      );
    });

    test('real system probes stay closed-safe off the test seams', () async {
      // The unmodified prober must never throw: on a clean test host every
      // platform path is absent (and the FLUTTER_TEST key suppresses the
      // emulator sniff, mirroring RN's constants.isTesting).
      final prober = DefaultDeviceSecurityProber(
        readOperatingSystem: () => Platform.isAndroid ? 'android' : 'other',
      );

      final evidence = await prober.probe();

      expect(evidence.rootDetected, anyOf(isTrue, isFalse));
      expect(evidence.hookDetected, anyOf(isTrue, isFalse));
      expect(
        evidence.emulatorDetected,
        isFalse,
        reason: 'FLUTTER_TEST mirrors RN constants.isTesting',
      );
    });
  });

  group('isDeviceSecurityFlagged', () {
    test(
      'shapes the RN offline branch verdict (`device-security.ts` parity)',
      () {
        expect(
          isDeviceSecurityFlagged(
            const DeviceSecurityEvidence(
              rootDetected: false,
              hookDetected: false,
              emulatorDetected: false,
            ),
          ),
          isFalse,
        );
        expect(
          isDeviceSecurityFlagged(
            const DeviceSecurityEvidence(rootDetected: true),
          ),
          isTrue,
        );
        expect(
          isDeviceSecurityFlagged(
            const DeviceSecurityEvidence(hookDetected: true),
          ),
          isTrue,
        );
        expect(
          isDeviceSecurityFlagged(
            const DeviceSecurityEvidence(emulatorDetected: true),
          ),
          isTrue,
        );
        expect(isDeviceSecurityFlagged(null), isFalse);
      },
    );
  });
}
