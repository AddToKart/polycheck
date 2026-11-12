import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_models.dart';

/// On-device anti-cheat capture (root / hook / emulator) — a 1:1 semantic port
/// of `android/services/device-security.ts` in pure Dart, with no new
/// packages (`dart:io` only).
///
/// Like the RN detector this is a *best-effort heuristic*: it probes well-known
/// su/Magisk paths, Frida/Xposed runtime artifacts and emulator fingerprints,
/// and closes, at worst, to "clean". Hardware-backed attestation (SafetyNet /
/// Play Integrity) is the v2 path; the payload is advisory evidence the server
/// may dispute on (`rooted_device` / `hook_detected` / `emulator_detected`).
///
/// Limits (documented divergence from the RN sources of truth):
/// * hooking detection cannot read JS globals (`__frida`) in Dart, so verdict
///   parity comes from Frida/Xposed environment keys, on-disk artifacts and
///   localhost server ports;
/// * emulator detection cannot read `Platform.constants`
///   (Brand/Model/Fingerprint/...), so it sniffs the same marker regex against
///   `/proc/cpuinfo` + `/system/build.prop` text — advisory only.
///
/// Every probe seam is injectable so tests stay hermetic under
/// `flutter test` (no filesystem, environment or network access required).

/// Well-known root binaries and Magisk/KernelSU package locations
/// (`device-security.ts:8-23`).
const List<String> knownRootPaths = <String>[
  '/system/bin/su',
  '/system/xbin/su',
  '/sbin/su',
  '/system/sd/xbin/su',
  '/system/bin/failsafe/su',
  '/data/local/xbin/su',
  '/data/local/bin/su',
  '/data/local/su',
  '/system/app/Superuser.apk',
  '/system/app/SuperSU.apk',
  '/system/app/Magisk.apk',
  '/sbin/.magisk',
  '/data/adb/magisk',
  '/data/adb/ksu',
];

/// Best-effort jailbreak indicators (`device-security.ts:28-36`).
const List<String> knownJailbreakPaths = <String>[
  '/Applications/Cydia.app',
  '/Applications/Sileo.app',
  '/Library/MobileSubstrate/MobileSubstrate.dylib',
  '/Library/MobileSubstrate/DynamicLibraries',
  '/private/var/lib/apt',
  '/private/var/stash',
  '/usr/sbin/sshd',
];

/// Frida/Xposed on-disk artifacts probed in place of the RN JS-global checks.
const List<String> knownHookArtifacts = <String>[
  '/data/local/tmp/frida-server',
  '/data/local/tmp/re.frida.server',
  '/system/framework/XposedBridge.jar',
  '/system/lib/libxposed_art.jar',
];

const List<String> knownHookEnvironmentKeys = <String>[
  'FRIDA_SERVER',
  'XPOSED',
  'XPOSED_BRIDGE',
];

/// Frida's default host server port pair.
const List<int> knownHookPorts = <int>[27042, 27043];

/// Same marker regex as `device-security.ts:38` (case-insensitive).
final RegExp emulatorMarkers = RegExp(
  r'(?:^|[\s:_/-])'
  r'(generic|unknown|emulator|sdk(?:_gphone)?|goldfish|ranchu|vbox|qemu|x86(?:_64)?)'
  r'(?:$|[\s:_/-])',
  caseSensitive: false,
);

/// True when [fingerprintText] carries a known emulator marker.
bool fingerprintLooksLikeEmulator(String fingerprintText) {
  return emulatorMarkers.hasMatch(fingerprintText);
}

/// Candidate root paths per OS (`checkRootFiles` platform parity).
List<String> rootCandidatePathsFor(String operatingSystem) {
  switch (operatingSystem) {
    case 'android':
      return knownRootPaths;
    case 'ios':
      return knownJailbreakPaths;
    default:
      return const <String>[];
  }
}

/// Best-effort existence probe for one artifact path (`FileSystem
/// getInfoAsync(file://path)` parity); permission errors are inconclusive.
bool artifactExists(String path) {
  try {
    return FileSystemEntity.typeSync(path, followLinks: false) !=
        FileSystemEntityType.notFound;
  } catch (_) {
    return false;
  }
}

/// Reads raw platform fingerprint text (guarded, bounded). Unreadable paths
/// contribute nothing — a missing/unreadable constant is inconclusive exactly
/// like the RN comment says.
String readAndroidFingerprintText({
  int limitBytes = 32 * 1024,
  List<String> candidates = const <String>[
    '/proc/cpuinfo',
    '/system/build.prop',
  ],
}) {
  final parts = <String>[];
  var budget = limitBytes;
  for (final path in candidates) {
    if (budget <= 0) break;
    try {
      final file = File(path);
      if (!file.existsSync()) continue;
      final text = file.readAsStringSync();
      final bounded = text.length > budget ? text.substring(0, budget) : text;
      budget -= bounded.length;
      parts.add(bounded);
    } catch (_) {
      // Missing/unreadable props are inconclusive (RN parity comment).
    }
  }
  return parts.join('\n');
}

/// Async on-device security snapshot contract. RN is async too
/// (`getDeviceSecuritySnapshot` awaits the file sweep).
abstract interface class DeviceSecurityProber {
  Future<DeviceSecurityEvidence> probe();
}

/// A snapshot where every field is resolved (RN `Required<{
/// DeviceSecurityEvidence}>`).
const DeviceSecurityEvidence _cleanEvidence = DeviceSecurityEvidence(
  rootDetected: false,
  hookDetected: false,
  emulatorDetected: false,
);

/// Default prober wired to the real platform. Fill any constructor parameter
/// with a fake to make [probe] hermetic.
class DefaultDeviceSecurityProber implements DeviceSecurityProber {
  const DefaultDeviceSecurityProber({
    this.readOperatingSystem,
    this.readEnvironment,
    this.readFingerprint,
    this.pathProbe,
    this.hookPortProbe,
  });

  final String Function()? readOperatingSystem;
  final Map<String, String> Function()? readEnvironment;
  final String Function()? readFingerprint;
  final bool Function(String path)? pathProbe;
  final bool Function(int port)? hookPortProbe;

  String get operatingSystem =>
      readOperatingSystem?.call() ?? Platform.operatingSystem;
  Map<String, String> get environment =>
      readEnvironment?.call() ?? Platform.environment;
  String get fingerprintText =>
      readFingerprint?.call() ?? readAndroidFingerprintText();
  bool carriesArtifact(String path) =>
      pathProbe?.call(path) ?? artifactExists(path);

  Future<bool> carriesHookPort(int port) async =>
      hookPortProbe?.call(port) ?? (await probeHookPort(port));

  /// `checkRootFiles` parity — su/Magisk/jailbreak path sweep, closed safe.
  bool get rootDetected {
    final os = operatingSystem;
    if (os != 'android' && os != 'ios') return false;
    for (final path in rootCandidatePathsFor(os)) {
      if (carriesArtifact(path)) return true;
    }
    return false;
  }

  /// `checkHooking` parity — Dart-side verdict via environment keys, artifacts
  /// and server ports (mirror of the RN exclusions: non-mobile platforms pass).
  Future<bool> get hookDetected async {
    final os = operatingSystem;
    if (os != 'android' && os != 'ios') return false;
    for (final key in knownHookEnvironmentKeys) {
      final value = environment[key];
      if (value != null && value.isNotEmpty) return true;
    }
    for (final path in knownHookArtifacts) {
      if (carriesArtifact(path)) return true;
    }
    for (final port in knownHookPorts) {
      if (await carriesHookPort(port)) return true;
    }
    return false;
  }

  /// `checkEmulator` parity — the same marker list over build/cpuinfo text;
  /// `FLUTTER_TEST` mirrors RN's `constants.isTesting` opt-out.
  bool get emulatorDetected {
    if (operatingSystem != 'android') return false;
    if (environment.containsKey('FLUTTER_TEST')) return false;
    final text = fingerprintText;
    if (text.isEmpty) return false;
    return fingerprintLooksLikeEmulator(text);
  }

  @override
  Future<DeviceSecurityEvidence> probe() async {
    final os = operatingSystem;
    if (os == 'web') {
      // `device-security.ts:127-133` parity: the web build is clean.
      return _cleanEvidence;
    }
    return DeviceSecurityEvidence(
      rootDetected: rootDetected,
      hookDetected: await hookDetected,
      emulatorDetected: emulatorDetected,
    );
  }
}

/// True when any flag fired — the branch shape the scan pipeline consumes.
bool isDeviceSecurityFlagged(DeviceSecurityEvidence? evidence) {
  if (evidence == null) return false;
  return (evidence.rootDetected ?? false) ||
      (evidence.hookDetected ?? false) ||
      (evidence.emulatorDetected ?? false);
}

/// Attempts a bounded localhost connect to a hooking-server port. Any failure
/// (refused, timeout, loopback unreachable) is simply "not detected".
Future<bool> probeHookPort(
  int port, {
  Duration timeout = const Duration(milliseconds: 150),
}) async {
  try {
    final socket = await Socket.connect(
      InternetAddress.loopbackIPv4,
      port,
      timeout: timeout,
    );
    socket.destroy();
    return true;
  } on Object {
    return false;
  }
}

final deviceSecurityProberProvider = Provider<DefaultDeviceSecurityProber>(
  (ref) => const DefaultDeviceSecurityProber(),
);
