import 'package:polycheck_mobile/src/core/polycheck_core.dart';

class ExcuseReasonOption {
  const ExcuseReasonOption({required this.reason, required this.label});

  final ExcuseReason reason;
  final String label;
}

const List<ExcuseReasonOption> excuseReasonOptions = <ExcuseReasonOption>[
  ExcuseReasonOption(
    reason: ExcuseReason.medical,
    label: 'Medical or health reason',
  ),
  ExcuseReasonOption(
    reason: ExcuseReason.familyEmergency,
    label: 'Family emergency',
  ),
  ExcuseReasonOption(
    reason: ExcuseReason.schoolActivity,
    label: 'Official school activity',
  ),
  ExcuseReasonOption(
    reason: ExcuseReason.transportation,
    label: 'Transportation problem',
  ),
  ExcuseReasonOption(reason: ExcuseReason.bereavement, label: 'Bereavement'),
  ExcuseReasonOption(reason: ExcuseReason.other, label: 'Other reason'),
];

String excuseReasonLabel(ExcuseReason? reason) {
  if (reason == null) return '';
  for (final option in excuseReasonOptions) {
    if (option.reason == reason) return option.label;
  }
  return reason.wire;
}

String excuseStatusLabel(ExcuseStatus? status) => switch (status) {
  ExcuseStatus.requested => 'Requested',
  ExcuseStatus.approved => 'Approved',
  ExcuseStatus.rejected => 'Rejected',
  null => '',
};

/// Students may file an excuse for a synced absent/late/incomplete record.
/// A rejected request may be filed again; open/approved requests may not.
bool isExcuseEligible(AttendanceRecord? record) {
  if (record == null || !record.isSynced) return false;
  final status = record.status;
  if (status != AttendanceStatus.absent &&
      status != AttendanceStatus.late &&
      status != AttendanceStatus.incomplete) {
    return false;
  }
  return record.excuseStatus == null ||
      record.excuseStatus == ExcuseStatus.rejected;
}

String? validateExcuseForm({
  required ExcuseReason? reason,
  required String description,
}) {
  if (reason == null) return 'Select a reason for the absence or lateness.';
  final trimmed = description.trim();
  if (trimmed.length < 10) {
    return 'Describe the reason in at least 10 characters.';
  }
  if (trimmed.length > 1000) {
    return 'Keep the description under 1,000 characters.';
  }
  return null;
}
