import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/branding/branding.dart';

void main() {
  group('deriveShortName', () {
    test('takes initials and skips connector words', () {
      expect(
        deriveShortName('Example Polytechnic of the Province'),
        'EPP',
      );
      expect(deriveShortName('University of Santo Tomas'), 'UST');
    });

    test('falls back to a trimmed name when initials are too short', () {
      expect(deriveShortName('Harvard'), 'Harvard');
    });
  });

  group('InstitutionBranding.resolve', () {
    test('returns the neutral defaults for nothing configured', () {
      expect(InstitutionBranding.resolve(null), InstitutionBranding.defaults);
      expect(
        InstitutionBranding.resolve(<String, dynamic>{}),
        InstitutionBranding.defaults,
      );
    });

    test(
      'derives the short name from the name but honours an explicit one',
      () {
        final derived = InstitutionBranding.resolve(<String, dynamic>{
          'name': 'Example Polytechnic of the Province',
        });
        expect(derived.shortName, 'EPP');
        final explicit = InstitutionBranding.resolve(<String, dynamic>{
          'name': 'Example Polytechnic of the Province',
          'shortName': 'EPP-SM',
          'campus': ' Santa Maria ',
        });
        expect(explicit.shortName, 'EPP-SM');
        expect(explicit.campus, 'Santa Maria');
        expect(explicit.label, 'EPP-SM · Santa Maria');
      },
    );

    test('round-trips through json and treats an empty logo as none', () {
      final branding = InstitutionBranding.resolve(<String, dynamic>{
        'name': 'A University',
        'shortName': 'AU',
        'campus': '',
        'logoDataUrl': '',
      });
      expect(branding.logoDataUrl, isNull);
      expect(branding.label, 'AU');
      expect(InstitutionBranding.resolve(branding.toJson()), branding);
    });
  });

  test('monogram is 1-4 uppercase characters', () {
    expect(brandingMonogram('EPP'), 'EPP');
    expect(brandingMonogram('St. Mary'), 'STMA');
    expect(brandingMonogram(''), 'IN');
  });

  testWidgets('BrandingScope.of falls back to defaults and follows updates', (
    tester,
  ) async {
    late InstitutionBranding seen;
    Widget host(InstitutionBranding? branding) {
      final probe = Builder(
        builder: (context) {
          seen = BrandingScope.of(context);
          return const SizedBox.shrink();
        },
      );
      return Directionality(
        textDirection: TextDirection.ltr,
        child: branding == null
            ? probe
            : BrandingScope(branding: branding, child: probe),
      );
    }

    await tester.pumpWidget(host(null));
    expect(seen, InstitutionBranding.defaults);

    const configured = InstitutionBranding(
      name: 'A University',
      shortName: 'AU',
      campus: 'Main',
    );
    await tester.pumpWidget(host(configured));
    expect(seen.name, 'A University');
    expect(seen.monogram, 'AU');
  });
}
