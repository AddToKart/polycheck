import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/app_info.dart';

void main() {
  // The portal footer once read "Version 1.0.0" in any build made without the
  // APP_VERSION override, whatever the real release was.
  test('the default version label matches pubspec.yaml', () {
    final version = RegExp(
      r'^version:\s*([0-9.]+)',
      multiLine: true,
    ).firstMatch(File('pubspec.yaml').readAsStringSync())!.group(1);

    expect(appVersion, version);
  });
}
