import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/core/theme/theme_mode_provider.dart';
import 'package:polycheck_mobile/src/core/widgets/theme_mode_toggle.dart';

class _App extends ConsumerWidget {
  const _App();

  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp(
    theme: BrandTheme.light,
    darkTheme: BrandTheme.dark,
    themeMode: ref.watch(themeModeProvider),
    home: Scaffold(appBar: AppBar(actions: const [ThemeModeToggleButton()])),
  );
}

void main() {
  test('parses stored values and falls back to the system setting', () {
    expect(parseThemeMode('dark'), ThemeMode.dark);
    expect(parseThemeMode('light'), ThemeMode.light);
    expect(parseThemeMode('system'), ThemeMode.system);
    expect(parseThemeMode('purple'), ThemeMode.system);
    expect(parseThemeMode(null), ThemeMode.system);
  });

  testWidgets('the toggle flips the theme on screen, both ways', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: _App()));
    await tester.pumpAndSettle();

    Brightness current() =>
        Theme.of(tester.element(find.byType(ThemeModeToggleButton))).brightness;

    expect(current(), Brightness.light);
    await tester.tap(find.byTooltip('Switch to dark theme'));
    await tester.pumpAndSettle();
    expect(current(), Brightness.dark);

    await tester.tap(find.byTooltip('Switch to light theme'));
    await tester.pumpAndSettle();
    expect(current(), Brightness.light);
  });
}
