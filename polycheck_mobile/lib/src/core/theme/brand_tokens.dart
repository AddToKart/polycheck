import 'package:flutter/material.dart';

/// Brand design tokens (K10: zero theme drift from web/RN).
///
/// Raw palette values live here once; every widget reads resolved tokens from
/// the `BrandTokens` theme extension instead of hard-coded hex literals.
abstract final class BrandColors {
  static const Color brandMaroon = Color(0xFF7B1113);
  static const Color brandDeepMaroon = Color(0xFF4A0A0B);
  static const Color brandGold = Color(0xFFFFDF00);

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
class BrandTokens extends ThemeExtension<BrandTokens> {
  const BrandTokens({
    required this.maroon,
    required this.deepMaroon,
    required this.gold,
    required this.surface,
    required this.campus,
    required this.borderSubtle,
    required this.muted,
    required this.isDark,
  });

  static const BrandTokens light = BrandTokens(
    maroon: BrandColors.brandMaroon,
    deepMaroon: BrandColors.brandDeepMaroon,
    gold: BrandColors.brandGold,
    surface: BrandColors.surfaceLight,
    campus: BrandColors.campusLight,
    borderSubtle: BrandColors.borderSubtleLight,
    muted: BrandColors.muted,
    isDark: false,
  );

  static const BrandTokens dark = BrandTokens(
    maroon: BrandColors.brandMaroon,
    deepMaroon: BrandColors.brandDeepMaroon,
    gold: BrandColors.brandGold,
    surface: BrandColors.surfaceDark,
    campus: BrandColors.campusDark,
    borderSubtle: BrandColors.borderSubtleDark,
    muted: BrandColors.muted,
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

  Color get onSurface => isDark ? BrandColors.white : BrandColors.ink;

  Color get onMaroon => BrandColors.white;

  Color get onGold => deepMaroon;

  /// Text color that stays legible on a filled maroon surface.
  Color get mutedOnMaroon => BrandColors.white.withValues(alpha: 0.72);

  @override
  BrandTokens copyWith({
    Color? maroon,
    Color? deepMaroon,
    Color? gold,
    Color? surface,
    Color? campus,
    Color? borderSubtle,
    Color? muted,
    bool? isDark,
  }) {
    return BrandTokens(
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
  BrandTokens lerp(ThemeExtension<BrandTokens>? other, double t) {
    if (other is! BrandTokens) return this;
    return BrandTokens(
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
