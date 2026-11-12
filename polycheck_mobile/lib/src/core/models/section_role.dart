import 'package:freezed_annotation/freezed_annotation.dart';

import 'support/wire_enum.dart';

part 'section_role.freezed.dart';
part 'section_role.g.dart';

/// Mirrors `shared/src/types/section-role.ts`.
enum SectionRoleType {
  president('president'),
  qac('qac');

  const SectionRoleType(this.wire);

  final String wire;

  static final Map<String, SectionRoleType> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static SectionRoleType fromWire(String value) =>
      decodeWireEnum('SectionRoleType', value, byWire);

  static SectionRoleType? tryParse(String value) => byWire[value];
}

class SectionRoleTypeConverter extends JsonConverter<SectionRoleType, String> {
  const SectionRoleTypeConverter();

  @override
  SectionRoleType fromJson(String json) => SectionRoleType.fromWire(json);

  @override
  String toJson(SectionRoleType object) => object.wire;
}

@freezed
abstract class SectionRole with _$SectionRole {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [SectionRoleTypeConverter()],
  )
  const factory SectionRole({
    required String id,
    required String sectionId,
    required String studentId,
    @Default('') String studentName,
    required SectionRoleType role,
    @Default('') String grantedBy,
    @Default('') String grantedAt,
  }) = _SectionRole;

  factory SectionRole.fromJson(Map<String, dynamic> json) =>
      _$SectionRoleFromJson(json);
}

@freezed
abstract class SessionPermission with _$SessionPermission {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory SessionPermission({
    required String id,
    required String sectionId,
    required String studentId,
    @Default('') String grantedBy,
    @Default('') String grantedAt,
    required String expiresAt,
    @Default(false) bool isActive,
  }) = _SessionPermission;

  factory SessionPermission.fromJson(Map<String, dynamic> json) =>
      _$SessionPermissionFromJson(json);
}

@freezed
abstract class ProofOfClass with _$ProofOfClass {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory ProofOfClass({
    required String id,
    required String sectionId,
    required String sessionId,
    required String uploadedBy,
    @Default('') String uploadedByStudentName,
    @Default('') String photoData,
    @Default('') String uploadedAt,
    String? description,
  }) = _ProofOfClass;

  factory ProofOfClass.fromJson(Map<String, dynamic> json) =>
      _$ProofOfClassFromJson(json);
}
