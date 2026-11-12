import 'unknown_api_value.dart';

/// Looks up [value] in a wire-name table, throwing a typed [UnknownApiValue]
/// when the member is not part of the mirrored contract.
T decodeWireEnum<T>(String enumName, String value, Map<String, T> byWire) {
  final decoded = byWire[value];
  if (decoded == null) {
    throw UnknownApiValue(enumName, value);
  }
  return decoded;
}

/// Builds the wire-name lookup used by [decodeWireEnum].
Map<String, T> wireLookup<T>(Iterable<T> values, String Function(T) wire) {
  return {for (final value in values) wire(value): value};
}
