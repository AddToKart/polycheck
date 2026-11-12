import 'package:freezed_annotation/freezed_annotation.dart';

import 'support/wire_enum.dart';

part 'user.freezed.dart';
part 'user.g.dart';

/// Mirrors `shared/src/types/user.ts`.
///
/// The TypeScript contract narrows `Student`, `Teacher`, and `SuperAdmin` from
/// `User`. Dart keeps one immutable account model that accepts every field any
/// account payload can carry (the union of those shapes) so no server data is
/// dropped, and exposes `Student`/`Teacher`/`SuperAdmin` as typedefs for
/// call-site readability. Fields the backend omits on list endpoints are
/// optional, exactly like the TS optional markers.
enum UserRole {
  superAdmin('super_admin'),
  teacher('teacher'),
  student('student');

  const UserRole(this.wire);

  final String wire;

  static final Map<String, UserRole> byWire = wireLookup(values, (v) => v.wire);

  static UserRole fromWire(String value) =>
      decodeWireEnum('UserRole', value, byWire);

  static UserRole? tryParse(String value) => byWire[value];
}

class UserRoleConverter extends JsonConverter<UserRole, String> {
  const UserRoleConverter();

  @override
  UserRole fromJson(String json) => UserRole.fromWire(json);

  @override
  String toJson(UserRole object) => object.wire;
}

/// Minimal capability carrier used by the designation helpers.
abstract interface class PolyUser {
  UserRole get role;

  String? get department;

  bool? get isItCoordinator;

  bool? get isDepartmentHead;

  bool? get isUserRegistrar;
}

@freezed
abstract class DelegatedTeacherPermissions with _$DelegatedTeacherPermissions {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory DelegatedTeacherPermissions({
    required bool canResetStudentPasswords,
    required bool canEmergencyUnbindDevices,
  }) = _DelegatedTeacherPermissions;

  factory DelegatedTeacherPermissions.fromJson(Map<String, dynamic> json) =>
      _$DelegatedTeacherPermissionsFromJson(json);
}

@freezed
abstract class User with _$User implements PolyUser {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [UserRoleConverter()],
  )
  const factory User({
    required String id,
    String? studentId,
    required String fullName,
    String? email,

    /// Roster rows (`GET /sections/:id/students`) and other list endpoints
    /// omit `role` entirely; every such row is a student by construction.
    /// Absent or explicit-null decodes to [UserRole.student]; a present
    /// unknown wire value still throws [UnknownApiValue].
    @Default(UserRole.student) UserRole role,
    String? program,
    int? yearLevel,
    String? department,
    String? photoUrl,
    @Default(true) bool isActive,
    String? privacyConsentVersion,
    String? privacyConsentedAt,
    @Default(false) bool mustChangePassword,
    String? boundDeviceId,
    String? deviceBoundAt,
    String? deviceCooldownUntil,
    String? cooldownDeviceId,
    bool? canResetStudentPasswords,
    bool? canEmergencyUnbindDevices,
    DelegatedTeacherPermissions? delegatedPermissions,
    @Default(false) bool isItCoordinator,
    @Default(false) bool isDepartmentHead,
    @Default(false) bool isUserRegistrar,
    String? contactEmail,
    String? contactPhone,
    @Default(<String>[]) List<String> enrolledSectionIds,
    String? scope,
    @Default('') String createdAt,
    @Default('') String updatedAt,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}

/// Students are [User] payloads plus `enrolledSectionIds`.
typedef Student = User;

/// Teachers are [User] payloads with `role: teacher`.
typedef Teacher = User;

/// Super admins are [User] payloads with an institution/department `scope`.
typedef SuperAdmin = User;
