import 'package:flutter/material.dart';

/// PUP design tokens (K10: zero theme drift from web/RN).
///
/// Raw palette values live here once; every widget reads resolved tokens from
/// the `PupTokens` theme extension instead of hard-coded hex literals.
abstract final class PupColors {
  static const Color pupMaroon = Color(0xFF7B1113);
  static const Color pupDeepMaroon = Color(0xFF4A0A0B);
  static const Color pupGold = Color(0xFFFFDF00);

  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color surfaceDark = Color(0xFF0A0A0A);
  static const Color borderSubtleLight = Color(0xFFE5E5E5);
  static const Color borderSubtleDark = Color(0xFF262626);
  static const Color campusLight = Color(0xFFF7F6F6);
  static const Color campusDark = Color(0xFF0B0B0E);
  static const Color muted = Color(0xFF777177);

  static const Color white = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF0A0A0A);
}

/// Resolved palette for the active brightness.
@immutable
class PupTokens extends ThemeExtension<PupTokens> {
  const PupTokens({
    required this.maroon,
    required this.deepMaroon,
    required this.gold,
    required this.surface,
    required this.campus,
    required this.borderSubtle,
    required this.muted,
    required this.isDark,
  });

  static const PupTokens light = PupTokens(
    maroon: PupColors.pupMaroon,
    deepMaroon: PupColors.pupDeepMaroon,
    gold: PupColors.pupGold,
    surface: PupColors.surfaceLight,
    campus: PupColors.campusLight,
    borderSubtle: PupColors.borderSubtleLight,
    muted: PupColors.muted,
    isDark: false,
  );

  static const PupTokens dark = PupTokens(
    maroon: PupColors.pupMaroon,
    deepMaroon: PupColors.pupDeepMaroon,
    gold: PupColors.pupGold,
    surface: PupColors.surfaceDark,
    campus: PupColors.campusDark,
    borderSubtle: PupColors.borderSubtleDark,
    muted: PupColors.muted,
    isDark: true,
  );

  final Color maroon;
  final Color deepMaroon;
  final Color gold;
  final Color surface;
  final Color campus;
  final Color borderSubtle;
  final Color muted;
  final bool isDark;

  Color get onSurface => isDark ? PupColors.white : PupColors.ink;

  Color get onMaroon => PupColors.white;

  Color get onGold => deepMaroon;

  /// Text color that stays legible on a filled maroon surface.
  Color get mutedOnMaroon => PupColors.white.withValues(alpha: 0.72);

  @override
  PupTokens copyWith({
    Color? maroon,
    Color? deepMaroon,
    Color? gold,
    Color? surface,
    Color? campus,
    Color? borderSubtle,
    Color? muted,
    bool? isDark,
  }) {
    return PupTokens(
      maroon: maroon ?? this.maroon,
      deepMaroon: deepMaroon ?? this.deepMaroon,
      gold: gold ?? this.gold,
      surface: surface ?? this.surface,
      campus: campus ?? this.campus,
      borderSubtle: borderSubtle ?? this.borderSubtle,
      muted: muted ?? this.muted,
      isDark: isDark ?? this.isDark,
    );
  }

  @override
  PupTokens lerp(ThemeExtension<PupTokens>? other, double t) {
    if (other is! PupTokens) return this;
    return PupTokens(
      maroon: Color.lerp(maroon, other.maroon, t)!,
      deepMaroon: Color.lerp(deepMaroon, other.deepMaroon, t)!,
      gold: Color.lerp(gold, other.gold, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      campus: Color.lerp(campus, other.campus, t)!,
      borderSubtle: Color.lerp(borderSubtle, other.borderSubtle, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      isDark: t < 0.5 ? isDark : other.isDark,
    );
  }
}
