import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const String _storageKey = 'polycheck.theme-mode.v1';

/// The person's chosen appearance. Starts on the phone's own setting
/// ([ThemeMode.system]), applies the remembered choice once it loads, and
/// remembers every change so the app reopens the way it was left.
class ThemeModeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    Future<void>.microtask(_load);
    return ThemeMode.system;
  }

  Future<void> _load() async {
    try {
      final stored = await const FlutterSecureStorage().read(key: _storageKey);
      if (stored != null && ref.mounted) state = parseThemeMode(stored);
    } on Object {
      // Secure storage can be unavailable; the system setting still applies.
    }
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    try {
      await const FlutterSecureStorage().write(
        key: _storageKey,
        value: mode.name,
      );
    } on Object {
      // The choice still applies for this session.
    }
  }
}

/// Unknown or corrupt stored values fall back to following the system.
ThemeMode parseThemeMode(String? value) {
  for (final mode in ThemeMode.values) {
    if (mode.name == value) return mode;
  }
  return ThemeMode.system;
}

final themeModeProvider = NotifierProvider<ThemeModeNotifier, ThemeMode>(
  ThemeModeNotifier.new,
);
