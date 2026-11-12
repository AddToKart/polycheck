import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/features/admin/presentation/widgets/credential_result_dialog.dart';

void main() {
  testWidgets('copy flow writes the one-time password to the clipboard', (
    tester,
  ) async {
    final calls = <MethodCall>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        calls.add(call);
        return null;
      },
    );
    addTearDown(() {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      );
    });

    await tester.pumpWidget(
      MaterialApp(
        theme: PupTheme.light,
        home: const Scaffold(
          body: CredentialResultDialog(
            accountName: 'Maria Santos',
            identifier: '2024-00001-MN-0',
            temporaryPassword: 'PUP-AB12CD34-EF!',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Maria Santos'), findsOneWidget);
    expect(find.text('PUP-AB12CD34-EF!'), findsOneWidget);
    expect(find.text('Copy password'), findsOneWidget);

    await tester.tap(find.text('Copy password'));
    await tester.pumpAndSettle();

    final clipboardCall = calls.firstWhere(
      (call) => call.method == 'Clipboard.setData',
    );
    expect(
      (clipboardCall.arguments as Map<dynamic, dynamic>)['text'],
      'PUP-AB12CD34-EF!',
    );
    expect(find.text('Copied'), findsOneWidget);
  });
}
