/// Thrown when the API sends an enum or union member this client does not
/// know about.
///
/// The Polycheck contract mirrors the backend exactly (plan K11). A silent
/// fallback to a default member would misrepresent server data on attendance
/// screens, so unknown wire values fail loudly instead.
class UnknownApiValue implements Exception {
  const UnknownApiValue(this.source, this.value, [this.detail]);

  /// The contract name that rejected the value, e.g. `AttendanceStatus`.
  final String source;

  /// The raw value received from the API.
  final Object? value;

  /// Optional context (route, field, or payload id).
  final String? detail;

  @override
  String toString() {
    final suffix = detail == null ? '' : ' ($detail)';
    return 'UnknownApiValue: $source received "$value"$suffix';
  }
}
