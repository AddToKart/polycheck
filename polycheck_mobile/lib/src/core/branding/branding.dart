import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/api_base.dart';
import '../network/dio_client.dart';

/// Institution identity shown across the app. Mirrors `shared/src/types/branding.ts`:
/// Polycheck is the product name; the institution's name, short name and campus are
/// administrator-editable runtime data served by the public `GET /branding` endpoint.
@immutable
class InstitutionBranding {
  const InstitutionBranding({
    required this.name,
    required this.shortName,
    required this.campus,
    this.logoDataUrl,
  });

  /// Shown until an administrator configures the institution.
  static const InstitutionBranding defaults = InstitutionBranding(
    name: 'Your Institution',
    shortName: 'Institution',
    campus: '',
  );

  final String name;
  final String shortName;
  final String campus;

  /// Uploaded logo (PNG/JPEG/WebP data URL). The app currently renders the
  /// monogram medallion; the logo is managed and shown on the web console.
  final String? logoDataUrl;

  /// 1-4 character monogram for the medallions on ID cards and portal screens.
  String get monogram => brandingMonogram(shortName);

  /// `Short name · Campus`, collapsing without a campus.
  String get label => campus.isEmpty ? shortName : '$shortName · $campus';

  factory InstitutionBranding.resolve(Map<String, dynamic>? json) {
    final name = (json?['name'] as String?)?.trim() ?? '';
    final shortRaw = (json?['shortName'] as String?)?.trim() ?? '';
    final campus = (json?['campus'] as String?)?.trim() ?? '';
    final logo = json?['logoDataUrl'];
    if (name.isEmpty) {
      return InstitutionBranding(
        name: defaults.name,
        shortName: shortRaw.isEmpty ? defaults.shortName : shortRaw,
        campus: campus,
        logoDataUrl: logo is String && logo.isNotEmpty ? logo : null,
      );
    }
    return InstitutionBranding(
      name: name,
      shortName: shortRaw.isEmpty ? deriveShortName(name) : shortRaw,
      campus: campus,
      logoDataUrl: logo is String && logo.isNotEmpty ? logo : null,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'name': name,
    'shortName': shortName,
    'campus': campus,
    'logoDataUrl': logoDataUrl,
  };

  @override
  bool operator ==(Object other) =>
      other is InstitutionBranding &&
      other.name == name &&
      other.shortName == shortName &&
      other.campus == campus &&
      other.logoDataUrl == logoDataUrl;

  @override
  int get hashCode => Object.hash(name, shortName, campus, logoDataUrl);
}

const Set<String> _shortNameStopWords = <String>{
  'of', 'the', 'and', 'for', 'in', 'at', 'de', 'ng', //
};

/// "Example Polytechnic of the Province" -> "EPP". Used only when no short name is stored.
String deriveShortName(String name) {
  final initials = name
      .split(RegExp(r'\s+'))
      .where(
        (w) => w.isNotEmpty && !_shortNameStopWords.contains(w.toLowerCase()),
      )
      .map((w) => w[0].toUpperCase())
      .join();
  if (initials.length >= 2) {
    return initials.length > 8 ? initials.substring(0, 8) : initials;
  }
  final trimmed = name.trim();
  return trimmed.length > 8 ? trimmed.substring(0, 8) : trimmed;
}

/// 1-4 uppercase letters/digits for a medallion.
String brandingMonogram(String shortName) {
  final letters = shortName
      .replaceAll(RegExp(r'[^A-Za-z0-9]'), '')
      .toUpperCase();
  if (letters.isEmpty) return 'IN';
  return letters.length > 4 ? letters.substring(0, 4) : letters;
}

/// Public institution identity endpoint (`backend/src/settings/branding.controller.ts`).
class BrandingApi extends ApiBase {
  BrandingApi(super.dio);

  Future<InstitutionBranding> fetch() async {
    final data = await getJson('/branding');
    return InstitutionBranding.resolve(asMap(data));
  }
}

final brandingApiProvider = Provider<BrandingApi>(
  (ref) => BrandingApi(ref.watch(dioProvider)),
);

const String _cacheKey = 'polycheck.branding.v1';

/// Last known institution identity. Starts from the neutral defaults, applies the
/// locally cached copy (so an offline start still shows the right name), then
/// refreshes from the server. A failed refresh keeps whatever was last known.
class BrandingNotifier extends Notifier<InstitutionBranding> {
  @override
  InstitutionBranding build() {
    Future<void>.microtask(_load);
    return InstitutionBranding.defaults;
  }

  Future<void> _load() async {
    try {
      final cached = await const FlutterSecureStorage().read(key: _cacheKey);
      if (cached != null && ref.mounted) {
        final decoded = jsonDecode(cached);
        if (decoded is Map<String, dynamic>) {
          state = InstitutionBranding.resolve(decoded);
        }
      }
    } on Object {
      // Secure storage can be unavailable; the network refresh below still applies.
    }
    await refresh();
  }

  /// Fetches the current identity; failures are silent (the last known value stays).
  Future<void> refresh() async {
    try {
      final fresh = await ref.read(brandingApiProvider).fetch();
      if (!ref.mounted) return;
      state = fresh;
      await const FlutterSecureStorage().write(
        key: _cacheKey,
        value: jsonEncode(fresh.toJson()),
      );
    } on DioException {
      // Offline or the server is down: keep the cached/default identity.
    } on Object {
      // Never let branding take a screen down.
    }
  }
}

final brandingProvider =
    NotifierProvider<BrandingNotifier, InstitutionBranding>(
      BrandingNotifier.new,
    );

/// Gives leaf widgets the current branding without Riverpod, the same way
/// `BrandTheme.of(context)` works. Without a scope (unit tests) the neutral
/// defaults apply.
class BrandingScope extends InheritedWidget {
  const BrandingScope({
    super.key,
    required this.branding,
    required super.child,
  });

  final InstitutionBranding branding;

  static InstitutionBranding of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<BrandingScope>()?.branding ??
      InstitutionBranding.defaults;

  @override
  bool updateShouldNotify(BrandingScope oldWidget) =>
      oldWidget.branding != branding;
}
