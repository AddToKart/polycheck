import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'pup_tokens.dart';

/// Polycheck theme: PUP maroon/gold, Lora headings, DM Sans body, square
/// (zero-radius) surfaces, flat (transparent surface tint), 1px borders.
///
/// Use `PupTheme.of(context)` for the resolved [PupTokens] and
/// `PupTheme.themeOf(context)` when the [ThemeData] itself is needed.
abstract final class PupTheme {
  static const BorderRadius none = BorderRadius.zero;

  static final ThemeData light = _build(Brightness.light, PupTokens.light);
  static final ThemeData dark = _build(Brightness.dark, PupTokens.dark);

  /// Resolved design tokens for the current context.
  static PupTokens of(BuildContext context) {
    final tokens = Theme.of(context).extension<PupTokens>();
    if (tokens != null) return tokens;
    return Theme.of(context).brightness == Brightness.dark
        ? PupTokens.dark
        : PupTokens.light;
  }

  static ThemeData themeOf(BuildContext context) => Theme.of(context);

  static ThemeData forBrightness(Brightness brightness) =>
      brightness == Brightness.dark ? dark : light;

  static ThemeData _build(Brightness brightness, PupTokens tokens) {
    final isDark = brightness == Brightness.dark;
    final scheme = (isDark ? _darkScheme() : _lightScheme()).copyWith(
      surfaceTint: Colors.transparent,
      outline: tokens.borderSubtle,
    );
    final baseTheme = ThemeData(useMaterial3: true, brightness: brightness);
    final textTheme = _textTheme(baseTheme.textTheme);
    final border = BorderSide(color: tokens.borderSubtle, width: 1);
    final squareShape = RoundedRectangleBorder(
      borderRadius: none,
      side: border,
    );
    final squareNoSide = const RoundedRectangleBorder(borderRadius: none);

    return baseTheme.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: tokens.campus,
      canvasColor: tokens.surface,
      dividerColor: tokens.borderSubtle,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      extensions: <ThemeExtension<dynamic>>[tokens],
      splashFactory: NoSplash.splashFactory,
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      hoverColor: Colors.transparent,
      focusColor: Colors.transparent,
      appBarTheme: AppBarTheme(
        backgroundColor: tokens.maroon,
        foregroundColor: tokens.onMaroon,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        shape: squareNoSide,
        iconTheme: IconThemeData(color: tokens.onMaroon),
        actionsIconTheme: IconThemeData(color: tokens.onMaroon),
        titleTextStyle: textTheme.titleLarge?.copyWith(
          color: tokens.onMaroon,
          fontFamily: GoogleFonts.lora().fontFamily,
          fontWeight: FontWeight.w600,
        ),
      ),
      cardTheme: CardThemeData(
        color: tokens.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: squareShape,
        clipBehavior: Clip.antiAlias,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: tokens.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: squareShape,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          color: tokens.onSurface,
          fontFamily: GoogleFonts.lora().fontFamily,
          fontWeight: FontWeight.w600,
        ),
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: tokens.onSurface,
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: tokens.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: tokens.surface,
        modalElevation: 0,
        elevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: none),
        clipBehavior: Clip.antiAlias,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: tokens.surface,
        isDense: false,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
        border: OutlineInputBorder(borderRadius: none, borderSide: border),
        enabledBorder: OutlineInputBorder(
          borderRadius: none,
          borderSide: border,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: none,
          borderSide: BorderSide(color: tokens.maroon, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: none,
          borderSide: BorderSide(color: tokens.maroon, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: none,
          borderSide: BorderSide(color: tokens.maroon, width: 1.5),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: none,
          borderSide: border,
        ),
        labelStyle: textTheme.bodyMedium?.copyWith(color: tokens.muted),
        floatingLabelStyle: textTheme.bodySmall?.copyWith(
          color: tokens.maroon,
          fontWeight: FontWeight.w600,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(color: tokens.muted),
        helperStyle: textTheme.bodySmall?.copyWith(color: tokens.muted),
        errorStyle: textTheme.bodySmall?.copyWith(
          color: isDark ? tokens.gold : tokens.maroon,
          fontWeight: FontWeight.w600,
        ),
        prefixIconColor: tokens.muted,
        suffixIconColor: tokens.muted,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return tokens.muted.withValues(alpha: 0.35);
            }
            if (states.contains(WidgetState.pressed)) {
              return tokens.deepMaroon;
            }
            return tokens.maroon;
          }),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return tokens.muted;
            }
            return tokens.onMaroon;
          }),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          elevation: const WidgetStatePropertyAll(0),
          shadowColor: const WidgetStatePropertyAll(Colors.transparent),
          shape: WidgetStatePropertyAll(squareNoSide),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          ),
          minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
          textStyle: WidgetStatePropertyAll(
            textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
            ),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: const WidgetStatePropertyAll(Colors.transparent),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) return tokens.muted;
            return isDark ? tokens.gold : tokens.maroon;
          }),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          side: WidgetStateProperty.resolveWith((states) {
            final color = states.contains(WidgetState.disabled)
                ? tokens.borderSubtle
                : tokens.maroon;
            return BorderSide(color: color, width: 1);
          }),
          shape: WidgetStatePropertyAll(squareNoSide),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          ),
          minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
          textStyle: WidgetStatePropertyAll(
            textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) return tokens.muted;
            return isDark ? tokens.gold : tokens.maroon;
          }),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          shape: WidgetStatePropertyAll(squareNoSide),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          minimumSize: const WidgetStatePropertyAll(Size(48, 44)),
          textStyle: WidgetStatePropertyAll(
            textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
      ),
      iconTheme: IconThemeData(color: isDark ? tokens.gold : tokens.maroon),
      dividerTheme: DividerThemeData(
        color: tokens.borderSubtle,
        thickness: 1,
        space: 1,
      ),
      listTileTheme: ListTileThemeData(
        shape: const RoundedRectangleBorder(borderRadius: none),
        iconColor: isDark ? tokens.gold : tokens.maroon,
        textColor: tokens.onSurface,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: tokens.surface,
        selectedColor: tokens.gold,
        disabledColor: tokens.campus,
        side: BorderSide(color: tokens.borderSubtle, width: 1),
        shape: const RoundedRectangleBorder(borderRadius: none),
        labelStyle: textTheme.labelMedium?.copyWith(color: tokens.onSurface),
        secondaryLabelStyle: textTheme.labelMedium?.copyWith(
          color: tokens.onGold,
          fontWeight: FontWeight.w600,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: tokens.maroon,
        linearTrackColor: tokens.borderSubtle,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: tokens.deepMaroon,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: tokens.onMaroon,
        ),
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: none),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: tokens.onMaroon,
        unselectedLabelColor: tokens.mutedOnMaroon,
        indicatorColor: tokens.gold,
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: Colors.transparent,
        labelStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        unselectedLabelStyle: textTheme.labelLarge,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: tokens.maroon,
        foregroundColor: tokens.onMaroon,
        elevation: 0,
        focusElevation: 0,
        hoverElevation: 0,
        highlightElevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: none),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: tokens.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: squareShape,
        textStyle: textTheme.bodyMedium?.copyWith(color: tokens.onSurface),
      ),
      checkboxTheme: CheckboxThemeData(
        shape: const RoundedRectangleBorder(borderRadius: none),
        side: BorderSide(color: tokens.muted, width: 1.5),
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return tokens.maroon;
          return Colors.transparent;
        }),
        checkColor: WidgetStatePropertyAll(
          isDark ? tokens.gold : tokens.onMaroon,
        ),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return tokens.maroon;
          return tokens.muted;
        }),
      ),
    );
  }

  static ColorScheme _lightScheme() => const ColorScheme.light(
    primary: PupColors.pupMaroon,
    onPrimary: PupColors.white,
    primaryContainer: PupColors.pupDeepMaroon,
    onPrimaryContainer: PupColors.white,
    secondary: PupColors.pupGold,
    onSecondary: PupColors.pupDeepMaroon,
    secondaryContainer: PupColors.pupGold,
    onSecondaryContainer: PupColors.pupDeepMaroon,
    surface: PupColors.surfaceLight,
    onSurface: PupColors.ink,
    surfaceContainerHighest: PupColors.campusLight,
    onSurfaceVariant: PupColors.muted,
    outline: PupColors.borderSubtleLight,
    error: PupColors.pupMaroon,
    onError: PupColors.white,
  );

  static ColorScheme _darkScheme() => const ColorScheme.dark(
    primary: PupColors.pupGold,
    onPrimary: PupColors.pupDeepMaroon,
    primaryContainer: PupColors.pupMaroon,
    onPrimaryContainer: PupColors.white,
    secondary: PupColors.pupGold,
    onSecondary: PupColors.pupDeepMaroon,
    secondaryContainer: PupColors.pupMaroon,
    onSecondaryContainer: PupColors.white,
    surface: PupColors.surfaceDark,
    onSurface: PupColors.white,
    surfaceContainerHighest: PupColors.campusDark,
    onSurfaceVariant: PupColors.muted,
    outline: PupColors.borderSubtleDark,
    error: PupColors.pupGold,
    onError: PupColors.pupDeepMaroon,
  );

  static TextTheme _textTheme(TextTheme base) {
    final body = GoogleFonts.dmSansTextTheme(base);
    TextStyle? heading(TextStyle? style, FontWeight weight) => GoogleFonts.lora(
      textStyle: style,
      fontWeight: weight,
      letterSpacing: 0,
    );

    return body.copyWith(
      displayLarge: heading(base.displayLarge, FontWeight.w600),
      displayMedium: heading(base.displayMedium, FontWeight.w600),
      displaySmall: heading(base.displaySmall, FontWeight.w600),
      headlineLarge: heading(base.headlineLarge, FontWeight.w600),
      headlineMedium: heading(base.headlineMedium, FontWeight.w600),
      headlineSmall: heading(base.headlineSmall, FontWeight.w600),
      titleLarge: heading(base.titleLarge, FontWeight.w600),
      titleMedium: body.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      titleSmall: body.titleSmall?.copyWith(fontWeight: FontWeight.w600),
    );
  }
}
