import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/widgets/assistant_markdown.dart';

void main() {
  Widget wrap(Widget child) {
    return MaterialApp(
      theme: PupTheme.light,
      home: Scaffold(body: SingleChildScrollView(child: child)),
    );
  }

  testWidgets('renders markdown text without throwing', (tester) async {
    await tester.pumpWidget(
      wrap(
        const AssistantMarkdown(
          content:
              '# Heading\n\n**Bold** and *italic* with `code`.\n\n'
              '- First item\n- Second item\n\n> Quoted text',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(MarkdownBody), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('renders GFM tables with the token table renderer', (
    tester,
  ) async {
    await tester.pumpWidget(
      wrap(
        const AssistantMarkdown(
          content:
              '| Student | Status |\n'
              '| --- | --- |\n'
              '| Maria | Present |\n'
              '| Juan | Late |\n',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(Table), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
