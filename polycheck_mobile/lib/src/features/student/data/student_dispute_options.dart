import 'package:polycheck_mobile/src/core/polycheck_core.dart';

/// Matches the backend `@MinLength(10)` on `POST /disputes`.
const int disputeDescriptionMinLength = 10;

/// Matches the backend `@MaxLength(1000)` on `POST /disputes`.
const int disputeDescriptionMaxLength = 1000;

const String disputeSubmitFallbackMessage =
    'Unable to submit your dispute. Check your connection and try again.';

class StudentDisputeOption {
  const StudentDisputeOption({
    required this.reason,
    required this.label,
    required this.description,
  });

  final DisputeReason reason;
  final String label;
  final String description;
}

/// The EXACT seven reasons a student may submit (`StudentDisputeReason`).
/// System-only reasons are never offered here.
const List<StudentDisputeOption> studentDisputeOptions = <StudentDisputeOption>[
  StudentDisputeOption(
    reason: DisputeReason.outsideGeofence,
    label: 'Location was incorrect',
    description: 'You were in class but the location check failed.',
  ),
  StudentDisputeOption(
    reason: DisputeReason.expiredToken,
    label: 'Time was incorrect',
    description: 'The QR code or attendance window was still valid.',
  ),
  StudentDisputeOption(
    reason: DisputeReason.duplicateSubmission,
    label: 'I was present',
    description: 'Your valid check-in was treated as a duplicate.',
  ),
  StudentDisputeOption(
    reason: DisputeReason.invalidSignature,
    label: 'QR technical issue',
    description: 'The class QR code could not be verified.',
  ),
  StudentDisputeOption(
    reason: DisputeReason.deviceMismatch,
    label: 'Account or device issue',
    description: 'The device check did not match your account.',
  ),
  StudentDisputeOption(
    reason: DisputeReason.suspiciousCoordinates,
    label: 'Suspicious location data',
    description: 'Your genuine location was flagged as suspicious.',
  ),
  StudentDisputeOption(
    reason: DisputeReason.other,
    label: 'Other issue',
    description: 'Something else went wrong with this attendance record.',
  ),
];

String studentDisputeReasonLabel(DisputeReason reason) {
  for (final option in studentDisputeOptions) {
    if (option.reason == reason) return option.label;
  }
  return reason.wire;
}

String? validateDisputeDescription(String value) {
  final trimmed = value.trim();
  if (trimmed.length < disputeDescriptionMinLength) {
    return 'Please describe the issue in at least $disputeDescriptionMinLength characters.';
  }
  if (value.length > disputeDescriptionMaxLength) {
    return 'Keep the description under $disputeDescriptionMaxLength characters.';
  }
  return null;
}

bool isDisputeDescriptionValid(String value) =>
    validateDisputeDescription(value) == null;

/// Typed API failures keep the server's business message; transport failures
/// fall back to a neutral retry hint so no raw `DioException` leaks to users.
String describeDisputeSubmitError(Object error) {
  if (error is ApiRequestError && error.message.trim().isNotEmpty) {
    return error.message.trim();
  }
  return disputeSubmitFallbackMessage;
}
