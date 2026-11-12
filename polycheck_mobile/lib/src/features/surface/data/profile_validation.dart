import 'dart:io';
import 'dart:ui';

import 'package:flutter/foundation.dart';

import '../../../core/app_info.dart';
import '../../../core/models/system_report.dart';
import '../../../core/utils/password_policy.dart';

/// Form validation + telemetry helpers for the profile surface.

class PasswordFormErrors {
  const PasswordFormErrors({
    this.currentPassword,
    this.newPassword,
    this.confirmation,
  });

  final String? currentPassword;
  final String? newPassword;
  final String? confirmation;

  bool get isEmpty =>
      currentPassword == null && newPassword == null && confirmation == null;
}

PasswordFormErrors validatePasswordForm({
  required String currentPassword,
  required String newPassword,
  required String confirmation,
  bool requireCurrent = true,
}) {
  String? currentError;
  String? newError;
  String? confirmationError;

  if (requireCurrent && currentPassword.isEmpty) {
    currentError = 'Enter your current password.';
  }
  if (newPassword.isEmpty) {
    newError = 'Enter a new password.';
  } else {
    newError = validatePasswordPolicy(newPassword);
  }
  if (confirmation.isEmpty) {
    confirmationError = 'Re-enter the new password.';
  } else if (confirmation != newPassword) {
    confirmationError = 'The password confirmation does not match.';
  }

  return PasswordFormErrors(
    currentPassword: currentError,
    newPassword: newError,
    confirmation: confirmationError,
  );
}

const int reportTitleMinLength = 5;
const int reportTitleMaxLength = 120;
const int reportDescriptionMinLength = 10;
const int reportDescriptionMaxLength = 4000;

String? validateReportTitle(String value) {
  final trimmed = value.trim();
  if (trimmed.length < reportTitleMinLength ||
      trimmed.length > reportTitleMaxLength) {
    return 'Summarize the issue in $reportTitleMinLength-'
        '$reportTitleMaxLength characters.';
  }
  return null;
}

String? validateReportDescription(String value) {
  final trimmed = value.trim();
  if (trimmed.length < reportDescriptionMinLength) {
    return 'Describe the issue in at least $reportDescriptionMinLength '
        'characters.';
  }
  if (trimmed.length > reportDescriptionMaxLength) {
    return 'Keep the description under $reportDescriptionMaxLength '
        'characters.';
  }
  return null;
}

const Map<ReportCategory, String> reportCategoryHints = {
  ReportCategory.scannerCamera:
      'QR camera not opening, unreadable codes, black screen.',
  ReportCategory.geofenceGps:
      'False outside-geofence, poor location accuracy, GPS timeout.',
  ReportCategory.uiDisplay: 'Layout glitch, cut-off text, dark mode contrast.',
  ReportCategory.enrollmentRoster:
      'Invalid section code, missing from the class list.',
  ReportCategory.accountLogin: 'Session dropped, device binding / cooldown.',
  ReportCategory.feedbackSuggestion: 'Feature ideas and general feedback.',
};

/// Best-effort device label matching the Android report telemetry.
String buildSurfaceDeviceLabel() {
  if (kIsWeb) return 'Web browser';
  try {
    final os = Platform.operatingSystem == 'ios' ? 'iOS' : 'Android';
    final version = Platform.operatingSystemVersion.trim();
    final shortVersion = version.isEmpty ? '' : ' ${version.split(' ').first}';
    return '$os$shortVersion';
  } catch (_) {
    return 'Mobile device';
  }
}

String buildSurfaceAppVersion() => 'Flutter v$appVersion';

/// `expo-network` was deferred on Android; this wave keeps the same
/// `unknown` contract instead of guessing.
const String surfaceNetworkType = 'unknown';

/// Colors for a "My reports" status pill.
@immutable
class ReportStatusTone {
  const ReportStatusTone({
    required this.background,
    required this.foreground,
    required this.border,
  });

  final Color background;
  final Color foreground;
  final Color border;
}

ReportStatusTone reportStatusTone(ReportStatus status, {required bool isDark}) {
  switch (status) {
    case ReportStatus.open:
      return const ReportStatusTone(
        background: Color(0xFF7B1113),
        foreground: Color(0xFFFFFFFF),
        border: Color(0xFF7B1113),
      );
    case ReportStatus.inReview:
      return const ReportStatusTone(
        background: Color(0xFFFFDF00),
        foreground: Color(0xFF4A0A0B),
        border: Color(0xFF4A0A0B),
      );
    case ReportStatus.resolved:
      return ReportStatusTone(
        background: isDark ? const Color(0xFF14532D) : const Color(0xFF047857),
        foreground: const Color(0xFFFFFFFF),
        border: isDark ? const Color(0xFF22C55E) : const Color(0xFF047857),
      );
    case ReportStatus.dismissed:
      return ReportStatusTone(
        background: isDark ? const Color(0xFF3F3F46) : const Color(0xFF52525B),
        foreground: const Color(0xFFFAFAFA),
        border: isDark ? const Color(0xFF3F3F46) : const Color(0xFF52525B),
      );
  }
}
